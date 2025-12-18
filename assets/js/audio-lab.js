/* assets/js/audio-lab.js
 * Minimal Audio Lab UI + Default Pair
 * - Default audio pair loaded on page open (never overwritten)
 * - User uploads switch playback to user pair (per-tab id), without touching default
 * - No pair id display, no notes/debug/shortcuts text
 * - Upload / Play-Pause / Restart in ONE row
 * - Slider: left = 100% A, right = 100% B, default left
 * - Play button toggles icon ▶︎ / ⏸
 * - Show labels next to file inputs:
 *     default: "Hello" / "Hello Enhanced"
 *     uploaded: show actual file names
 */

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "https://audiolab-production.up.railway.app";

  // Per-tab id (user uploads key). Does NOT affect default pair.
  const PAIR_KEY = "audiolab_pair_id_v1";
  const getTabPairId = () => {
    let id = sessionStorage.getItem(PAIR_KEY);
    if (!id) {
      id = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
      sessionStorage.setItem(PAIR_KEY, id);
    }
    return id;
  };
  const userPairId = getTabPairId();

  // ---------- UI ----------
  const root = document.getElementById("abRoot");
  if (!root) {
    console.error("AudioLab: #abRoot not found. Add <div id='abRoot'></div> to the page.");
    return;
  }

  root.innerHTML = `
    <style>
      .ab-wrap { display: grid; gap: 12px; }
      .ab-card { border: 1px solid rgba(0,0,0,.15); border-radius: 12px; padding: 12px; }
      .ab-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
      .small { font-size: 0.9em; opacity: 0.85; }
      button { padding: 8px 12px; border-radius: 10px; border: 1px solid rgba(0,0,0,.2); cursor: pointer; }
      button:disabled { opacity: 0.5; cursor: not-allowed; }
      .iconbtn {
        width: 44px; height: 44px;
        border-radius: 12px;
        border: 1px solid rgba(0,0,0,.2);
        background: rgba(0,0,0,.04);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        line-height: 1;
        cursor: pointer;
        user-select: none;
      }
      .iconbtn:disabled { opacity: 0.5; cursor: not-allowed; }
      .label { min-width: 50px; display:inline-block; }
      input[type="range"]{ vertical-align: middle; }
      .fileLabel { margin-top: 6px; }
    </style>

    <div class="ab-wrap">
      <div class="ab-card">
        <div class="ab-row">
          <div style="min-width:260px">
            <div><b>Audio A</b></div>
            <input id="fileA" type="file" accept="audio/*" />
            <div class="small fileLabel" id="labelA">Hello</div>
          </div>
          <div style="min-width:260px">
            <div><b>Audio B</b></div>
            <input id="fileB" type="file" accept="audio/*" />
            <div class="small fileLabel" id="labelB">Hello Enhanced</div>
          </div>
        </div>

        <div class="ab-row" style="margin-top:12px">
          <button id="btnUpload">Upload</button>
          <button id="btnPlay" class="iconbtn" disabled aria-label="Play/Pause" title="Play/Pause">▶︎</button>
          <button id="btnRestart" class="iconbtn" disabled aria-label="Restart" title="Restart">↺</button>
          <span class="small">Now: <b id="now">-</b> | t=<span id="t">0.00</span>s</span>
          <span class="small" id="sourceTag"></span>
        </div>

        <div class="ab-row" style="margin-top:10px">
          <span class="small label">Mix</span>
          <input id="mix" type="range" min="0" max="100" value="0" style="width:320px" />
          <span class="small"><b id="mixLabel">A 100% / B 0%</b></span>
        </div>

        <div class="small" id="status" style="margin-top:10px"></div>
      </div>
    </div>
  `;

  const $ = (id) => document.getElementById(id);
  const fileA = $("fileA");
  const fileB = $("fileB");
  const labelA = $("labelA");
  const labelB = $("labelB");
  const btnUpload = $("btnUpload");
  const btnPlay = $("btnPlay");
  const btnRestart = $("btnRestart");
  const nowEl = $("now");
  const tEl = $("t");
  const statusEl = $("status");
  const mix = $("mix");
  const mixLabel = $("mixLabel");
  const sourceTag = $("sourceTag");

  const PLAY_ICON = "▶︎";
  const PAUSE_ICON = "⏸";
  const setStatus = (msg) => { statusEl.textContent = msg; };
  const setPlayIcon = (playing) => { btnPlay.textContent = playing ? PAUSE_ICON : PLAY_ICON; };
  const setSourceTag = (s) => { sourceTag.textContent = s ? `(${s})` : ""; };

  // ---------- WebAudio ----------
  let ctx = null;
  let bufA = null;
  let bufB = null;

  let gainA = null;
  let gainB = null;
  let srcA = null;
  let srcB = null;

  let isPlaying = false;
  let startCtxTime = 0;
  let startOffset = 0;
  let raf = null;

  // alignment: lagSec = tB - tA
  let lagSec = 0;

  const ensureCtx = () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: "interactive" });
    return ctx;
  };

  const makeGraphIfNeeded = () => {
    ensureCtx();
    if (!gainA || !gainB) {
      gainA = ctx.createGain();
      gainB = ctx.createGain();
      gainA.gain.value = 0;
      gainB.gain.value = 0;
      gainA.connect(ctx.destination);
      gainB.connect(ctx.destination);
    }
  };

  const teardownSources = () => {
    try { if (srcA) srcA.stop(); } catch {}
    try { if (srcB) srcB.stop(); } catch {}
    srcA = null; srcB = null;
  };

  const stopTicker = () => { if (raf) cancelAnimationFrame(raf); raf = null; };

  const startTicker = () => {
    stopTicker();
    const loop = () => {
      let t = startOffset;
      if (ctx && isPlaying) t = (ctx.currentTime - startCtxTime + startOffset);
      tEl.textContent = (t >= 0 ? t : 0).toFixed(2);
      raf = requestAnimationFrame(loop);
    };
    loop();
  };

  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

  // Slider: 0 => A 100%, 100 => B 100%
  const setMix = (sliderValue0to100) => {
    makeGraphIfNeeded();
    const p = clamp(sliderValue0to100, 0, 100);
    const bRatio = p / 100;
    const aRatio = 1 - bRatio;

    const theta = bRatio * Math.PI * 0.5;
    const gA = Math.cos(theta);
    const gB = Math.sin(theta);

    const t = ctx.currentTime;
    const RAMP = 0.01;

    gainA.gain.cancelScheduledValues(t);
    gainB.gain.cancelScheduledValues(t);
    gainA.gain.setValueAtTime(gainA.gain.value, t);
    gainB.gain.setValueAtTime(gainB.gain.value, t);
    gainA.gain.linearRampToValueAtTime(gA, t + RAMP);
    gainB.gain.linearRampToValueAtTime(gB, t + RAMP);

    const aPct = Math.round(aRatio * 100);
    mixLabel.textContent = `A ${aPct}% / B ${100 - aPct}%`;

    if (aPct === 100) nowEl.textContent = "A";
    else if (aPct === 0) nowEl.textContent = "B";
    else nowEl.textContent = "Mix";
  };

  const startBothAt = (commonOffsetSec) => {
    teardownSources();
    makeGraphIfNeeded();

    srcA = ctx.createBufferSource();
    srcB = ctx.createBufferSource();
    srcA.buffer = bufA;
    srcB.buffer = bufB;
    srcA.connect(gainA);
    srcB.connect(gainB);

    const offA = commonOffsetSec + (lagSec < 0 ? -lagSec : 0);
    const offB = commonOffsetSec + (lagSec > 0 ?  lagSec : 0);

    const offA2 = clamp(offA, 0, Math.max(0, bufA.duration - 0.001));
    const offB2 = clamp(offB, 0, Math.max(0, bufB.duration - 0.001));

    const START_IN = 0.08;
    startCtxTime = ctx.currentTime + START_IN;
    startOffset = commonOffsetSec;

    srcA.start(startCtxTime, offA2);
    srcB.start(startCtxTime, offB2);

    isPlaying = true;
    setPlayIcon(true);
    setMix(parseInt(mix.value, 10));
    startTicker();

    const durCommon = Math.min(
      bufA.duration - (lagSec < 0 ? -lagSec : 0),
      bufB.duration - (lagSec > 0 ?  lagSec : 0)
    );
    const endAt = startCtxTime + Math.max(0, durCommon - commonOffsetSec);

    const markEnded = () => {
      if (ctx.currentTime >= endAt - 0.05) {
        isPlaying = false;
        setPlayIcon(false);
        setStatus("Ended.");
      }
    };
    srcA.onended = markEnded;
    srcB.onended = markEnded;
  };

  const pause = () => {
    if (!isPlaying) return;
    const cur = (ctx.currentTime - startCtxTime + startOffset);
    startOffset = Math.max(0, cur);
    teardownSources();
    isPlaying = false;
    setPlayIcon(false);
    setStatus("Paused.");
    startTicker();
  };

  const play = async () => {
    ensureCtx();
    await ctx.resume();
    if (!bufA || !bufB) return;
    if (isPlaying) return;
    startBothAt(startOffset);
    setStatus("Playing.");
  };

  const restart = () => {
    startOffset = 0;
    if (isPlaying) {
      startBothAt(0);
      setStatus("Restarted.");
    } else {
      setMix(parseInt(mix.value, 10));
      setStatus("Restarted.");
      startTicker();
    }
  };

  // ---------- Alignment (energy envelope xcorr) ----------
  const monoFromBuffer = (buf) => {
    const ch = buf.numberOfChannels;
    const L = buf.length;
    if (ch === 1) return buf.getChannelData(0);
    const a = buf.getChannelData(0);
    const b = buf.getChannelData(1);
    const out = new Float32Array(L);
    for (let i = 0; i < L; i++) out[i] = 0.5 * (a[i] + b[i]);
    return out;
  };

  const envDownsample = (x, sr, targetSr = 200) => {
    const step = Math.max(1, Math.floor(sr / targetSr));
    const n = Math.floor(x.length / step);
    const y = new Float32Array(n);
    let acc = 0, k = 0;
    for (let i = 0; i < x.length; i++) {
      acc += Math.abs(x[i]);
      if ((i + 1) % step === 0) { y[k++] = acc / step; acc = 0; }
    }
    let m = 0;
    for (let i = 0; i < y.length; i++) m += y[i];
    m /= Math.max(1, y.length);
    for (let i = 0; i < y.length; i++) y[i] -= m;
    return { y, sr: sr / step };
  };

  const bestLagEnv = (a, b, sr, maxLagSec = 1.5) => {
    const maxLag = Math.floor(maxLagSec * sr);
    const norm = (v) => {
      let s = 0;
      for (let i = 0; i < v.length; i++) s += v[i] * v[i];
      return Math.sqrt(s) + 1e-8;
    };
    const na = norm(a), nb = norm(b);

    let bestLag = 0, best = -1e18;
    for (let lag = -maxLag; lag <= maxLag; lag++) {
      let sum = 0;
      const t0 = Math.max(0, -lag);
      const t1 = Math.min(a.length, b.length - lag);
      for (let t = t0; t < t1; t++) sum += a[t] * b[t + lag];
      sum = sum / (na * nb);
      if (sum > best) { best = sum; bestLag = lag; }
    }
    return { lagSamples: bestLag, score: best };
  };

  const estimateAlignment = (aBuf, bBuf) => {
    const MAX_LAG_SEC = 1.5;
    const xa = monoFromBuffer(aBuf);
    const xb = monoFromBuffer(bBuf);
    const ea = envDownsample(xa, aBuf.sampleRate, 200);
    const eb = envDownsample(xb, bBuf.sampleRate, 200);
    const r = bestLagEnv(ea.y, eb.y, ea.sr, MAX_LAG_SEC);
    return { lagSec: r.lagSamples / ea.sr, score: r.score };
  };

  // ---------- Backend helpers ----------
  const fetchJson = async (url) => {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
    return await res.json();
  };

  const fetchAndDecode = async (absUrl) => {
    ensureCtx();
    const res = await fetch(absUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
    const ab = await res.arrayBuffer();
    return await new Promise((resolve, reject) => {
      ctx.decodeAudioData(ab, resolve, reject);
    });
  };

  const uploadOne = async (file, label) => {
    const fd = new FormData();
    fd.append("file", file);
    const u = `${API_BASE}/api/upload_one?front_end_id=${encodeURIComponent(userPairId)}&label=${label}`;
    const res = await fetch(u, { method: "POST", body: fd });
    if (!res.ok) throw new Error(await res.text());
    return await res.json(); // expects {url: "/api/audio/....mp3"}
  };

  // ---------- Loaders ----------
  const loadPairFromUrls = async (aUrlAbs, bUrlAbs, sourceName) => {
    teardownSources();
    isPlaying = false;
    setPlayIcon(false);
    startOffset = 0;

    setStatus("Decoding ...");
    const [da, db] = await Promise.all([fetchAndDecode(aUrlAbs), fetchAndDecode(bUrlAbs)]);
    bufA = da; bufB = db;

    setStatus("Aligning ...");
    const est = estimateAlignment(bufA, bufB);
    lagSec = est.lagSec;

    btnPlay.disabled = false;
    btnRestart.disabled = false;

    // reset slider left (100% A)
    mix.value = "0";
    setMix(0);

    setSourceTag(sourceName);
    setStatus("Ready.");
    startTicker();
  };

  const loadDefaultPair = async () => {
    // Backend:
    // GET /api/default_pair -> {a_url:"/api/default_audio/default_A.mp3", b_url:"/api/default_audio/default_B.mp3"}
    const meta = await fetchJson(`${API_BASE}/api/default_pair`);
    const aAbs = `${API_BASE}${meta.a_url}`;
    const bAbs = `${API_BASE}${meta.b_url}`;

    // Labels for default pair (your requested names)
    labelA.textContent = "Hello";
    labelB.textContent = "Hello Enhanced";

    await loadPairFromUrls(aAbs, bAbs, "default");
  };

  const loadUserUploadedPair = async (ra, rb) => {
    const aAbs = `${API_BASE}${ra.url}`;
    const bAbs = `${API_BASE}${rb.url}`;
    await loadPairFromUrls(aAbs, bAbs, "uploaded");
  };

  // ---------- Actions ----------
  const doUploadAndSwitch = async () => {
    if (!fileA.files[0] || !fileB.files[0]) {
      setStatus("Please select both files.");
      return;
    }

    btnUpload.disabled = true;
    setStatus("Uploading ...");

    try {
      // show uploaded file names immediately
      labelA.textContent = fileA.files[0].name;
      labelB.textContent = fileB.files[0].name;

      const [ra, rb] = await Promise.all([
        uploadOne(fileA.files[0], "A"),
        uploadOne(fileB.files[0], "B"),
      ]);

      await loadUserUploadedPair(ra, rb);
    } catch (e) {
      console.error(e);
      setStatus(`Error: ${e.message}`);
    } finally {
      btnUpload.disabled = false;
    }
  };

  // ---------- Wiring ----------
  btnUpload.onclick = () => { doUploadAndSwitch(); };

  btnPlay.onclick = async () => {
    try {
      if (isPlaying) pause();
      else await play();
    } catch (e) {
      setStatus(`Play error: ${e.message}`);
    }
  };

  btnRestart.onclick = () => restart();

  mix.addEventListener("input", () => {
    setMix(parseInt(mix.value, 10));
  });

  window.addEventListener("keydown", (e) => {
    if (e.target && ["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
    if (e.code === "Space") { e.preventDefault(); btnPlay.click(); }
  });

  // ---------- Init ----------
  mix.value = "0";
  makeGraphIfNeeded();
  setMix(0);
  setPlayIcon(false);
  setSourceTag("");

  setStatus("Loading default ...");
  startTicker();

  loadDefaultPair().catch((e) => {
    console.error(e);
    setSourceTag("");
    setStatus(`Default load failed: ${e.message}`);
  });
});

