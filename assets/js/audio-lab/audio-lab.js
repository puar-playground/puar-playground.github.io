/* assets/js/audio-lab.js
 * Configurable Audio Lab UI for AB Testing
 * 
 * Usage:
 *   initAudioLab({
 *     rootId: 'abRoot',
 *     defaultAudioA: '/assets/audio/Hello.mp3',
 *     defaultAudioB: '/assets/audio/Hello_enhanced.mp3',
 *     allowUpload: true,
 *     waveformColorA: '#FF2600',
 *     waveformColorB: '#659BC8'
 *   });
 * 
 * Dependencies (load in order):
 *   1. audio-lab-alignment.js
 *   2. audio-lab-waveforms.js
 *   3. audio-lab-ui.js
 *   4. audio-lab.js (this file)
 */

function initAudioLab(config = {}) {
  // Default configuration
  const {
    rootId = 'abRoot',
    defaultAudioA = null,
    defaultAudioB = null,
    allowUpload = true,
    waveformColorA = '#FF2600',
    waveformColorB = '#659BC8',
    waveformBackground = '#f5f5f5'
  } = config;

  // Waveform colors from config
  const WAVEFORM_COLOR_A = waveformColorA;
  const WAVEFORM_COLOR_B = waveformColorB;
  const WAVEFORM_BACKGROUND = waveformBackground;

  // ---------- UI Setup ----------
  const root = document.getElementById(rootId);
  if (!root) {
    console.error(`AudioLab: #${rootId} not found. Add <div id='${rootId}'></div> to the page.`);
    return;
  }

  root.innerHTML = AudioLabUI.generateHTML(allowUpload);

  const $ = (id) => document.getElementById(id);
  const fileA = allowUpload ? $("fileA") : null;
  const fileB = allowUpload ? $("fileB") : null;
  const labelA = allowUpload ? $("labelA") : null;
  const labelB = allowUpload ? $("labelB") : null;
  const btnPlay = $("btnPlay");
  const btnRestart = $("btnRestart");
  const mix = $("mix");
  const mixLabelTop = $("mixLabelTop");
  const mixLabelBottom = $("mixLabelBottom");
  const canvasA = $("waveformA");
  const canvasB = $("waveformB");
  const playheadA = $("playheadA");
  const playheadB = $("playheadB");

  const PLAY_ICON = "▶︎";
  const PAUSE_ICON = "⏸";
  const setStatus = (msg) => { /* Status text removed - no-op */ };
  const setPlayIcon = (playing) => { btnPlay.textContent = playing ? PAUSE_ICON : PLAY_ICON; };

  // ---------- WebAudio State ----------
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
  let waveformDataA = null;
  let waveformDataB = null;
  let commonDuration = 0;
  let lagSec = 0;

  // ---------- Audio Context Management ----------
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
      
      // Update playhead position on waveforms (both use common duration)
      if (commonDuration > 0) {
        const currentTime = Math.max(0, Math.min(t, commonDuration));
        const progress = currentTime / commonDuration;
        
        const containerA = playheadA.parentElement;
        const containerB = playheadB.parentElement;
        if (containerA) {
          playheadA.style.left = `${progress * 100}%`;
        }
        if (containerB) {
          playheadB.style.left = `${progress * 100}%`;
        }
      }
      
      raf = requestAnimationFrame(loop);
    };
    loop();
  };

  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

  // ---------- Mix Control ----------
  const setMix = (sliderValue0to100) => {
    makeGraphIfNeeded();
    // Horizontal slider: left (0) is A 100%, right (100) is B 100%
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
    const bPct = 100 - aPct;
    // Update labels at top and bottom of slider
    if (mixLabelTop) mixLabelTop.textContent = `A ${aPct}%`;
    if (mixLabelBottom) mixLabelBottom.textContent = `B ${bPct}%`;

    // Update waveform opacity based on mix ratio
    if (waveformDataA && waveformDataB) {
      AudioLabWaveforms.drawWaveform(canvasA, waveformDataA, WAVEFORM_COLOR_A, WAVEFORM_BACKGROUND, aRatio);
      AudioLabWaveforms.drawWaveform(canvasB, waveformDataB, WAVEFORM_COLOR_B, WAVEFORM_BACKGROUND, bRatio);
    }
  };

  // ---------- Playback Control ----------
  const seekTo = (timeSec) => {
    const wasPlaying = isPlaying;
    if (isPlaying) {
      pause();
    }
    const maxSeek = commonDuration > 0 ? commonDuration : Math.min(bufA.duration, bufB.duration);
    startOffset = Math.max(0, Math.min(timeSec, maxSeek));
    
    if (commonDuration > 0) {
      const progress = Math.min(1, startOffset / commonDuration);
      playheadA.style.left = `${progress * 100}%`;
      playheadB.style.left = `${progress * 100}%`;
    }
    
    if (wasPlaying) {
      play();
    } else {
      setMix(parseInt(mix.value, 10));
      startTicker();
    }
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

  // ---------- Audio Loading ----------
  const decodeAudioFile = async (fileOrUrl) => {
    ensureCtx();
    let arrayBuffer;
    
    if (fileOrUrl instanceof File) {
      arrayBuffer = await fileOrUrl.arrayBuffer();
    } else {
      const res = await fetch(fileOrUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
      arrayBuffer = await res.arrayBuffer();
    }
    
    return await new Promise((resolve, reject) => {
      ctx.decodeAudioData(arrayBuffer, resolve, reject);
    });
  };

  const loadPairFromFiles = async (fileA, fileB, sourceName) => {
    teardownSources();
    isPlaying = false;
    setPlayIcon(false);
    startOffset = 0;

    setStatus("Decoding ...");
    const [da, db] = await Promise.all([
      decodeAudioFile(fileA),
      decodeAudioFile(fileB)
    ]);
    bufA = da; bufB = db;

    setStatus("Aligning ...");
    const est = AudioLabAlignment.estimateAlignment(bufA, bufB);
    lagSec = est.lagSec;

    // Calculate common duration (trimmed to shorter file)
    commonDuration = Math.min(
      bufA.duration - (lagSec < 0 ? -lagSec : 0),
      bufB.duration - (lagSec > 0 ? lagSec : 0)
    );

    setStatus("Rendering waveforms ...");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const targetWidth = Math.max(canvasA.offsetWidth || 800, 400);
        waveformDataA = AudioLabWaveforms.extractWaveform(bufA, targetWidth, commonDuration);
        waveformDataB = AudioLabWaveforms.extractWaveform(bufB, targetWidth, commonDuration);
        const currentMix = parseInt(mix.value, 10);
        const aRatio = 1 - (currentMix / 100);
        const bRatio = currentMix / 100;
        AudioLabWaveforms.drawWaveform(canvasA, waveformDataA, WAVEFORM_COLOR_A, WAVEFORM_BACKGROUND, aRatio);
        AudioLabWaveforms.drawWaveform(canvasB, waveformDataB, WAVEFORM_COLOR_B, WAVEFORM_BACKGROUND, bRatio);
        setStatus("Ready.");
      });
    });
    
    // Setup scrubbing (use common duration for both)
    const commonBuffer = { duration: commonDuration };
    AudioLabWaveforms.setupWaveformScrubbing(canvasA, commonBuffer, playheadA, seekTo);
    AudioLabWaveforms.setupWaveformScrubbing(canvasB, commonBuffer, playheadB, seekTo);

    btnPlay.disabled = false;
    btnRestart.disabled = false;

    mix.value = "0";
    setMix(0);
    startTicker();
  };

  const loadDefaultPair = async () => {
    if (!defaultAudioA || !defaultAudioB) {
      setStatus("No default audio files configured.");
      return;
    }

    const scriptTag = document.querySelector('script[src*="audio-lab.js"]');
    const scriptSrc = scriptTag ? scriptTag.getAttribute('src') : '/assets/js/audio-lab/audio-lab.js';
    const basePath = scriptSrc.replace(/\/audio-lab\/audio-lab\.js$/, '').replace(/\/audio-lab\.js$/, '');
    
    const resolvePath = (path) => {
      if (path.startsWith('http://') || path.startsWith('https://')) {
        return path;
      }
      if (path.startsWith('/')) {
        if (path.startsWith('/assets/')) {
          return path;
        }
        return path;
      }
      return `${basePath}${path.startsWith('.') ? path : '/' + path}`;
    };

    defaultAUrl = resolvePath(defaultAudioA);
    defaultBUrl = resolvePath(defaultAudioB);

    if (allowUpload && labelA && labelB) {
      labelA.textContent = "";
      labelB.textContent = "";
    }

    await loadPairFromFiles(defaultAUrl, defaultBUrl, "default");
  };

  // ---------- File Upload Handling ----------
  let defaultAUrl = null;
  let defaultBUrl = null;

  const autoLoadFiles = async () => {
    if (!allowUpload) return;
    
    let fileAObj = fileA && fileA.files[0] ? fileA.files[0] : null;
    let fileBObj = fileB && fileB.files[0] ? fileB.files[0] : null;
    
    if (!fileAObj && defaultAUrl) {
      fileAObj = defaultAUrl;
    }
    if (!fileBObj && defaultBUrl) {
      fileBObj = defaultBUrl;
    }

    if (!fileAObj && !fileBObj) {
      return;
    }

    setStatus("Loading ...");

    try {
      if (fileA && fileA.files[0] && labelA) {
        labelA.textContent = fileA.files[0].name;
      } else if (labelA) {
        labelA.textContent = "";
      }
      if (fileB && fileB.files[0] && labelB) {
        labelB.textContent = fileB.files[0].name;
      } else if (labelB) {
        labelB.textContent = "";
      }

      await loadPairFromFiles(fileAObj, fileBObj, "uploaded");
    } catch (e) {
      console.error(e);
      setStatus(`Error: ${e.message}`);
    }
  };

  // ---------- Event Wiring ----------
  if (allowUpload) {
    fileA.addEventListener("change", (e) => {
      if (e.target.files[0]) {
        labelA.textContent = e.target.files[0].name;
        autoLoadFiles();
      }
    });

    fileB.addEventListener("change", (e) => {
      if (e.target.files[0]) {
        labelB.textContent = e.target.files[0].name;
        autoLoadFiles();
      }
    });
  }

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

  // Redraw waveforms on window resize
  let resizeTimeout;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      if (waveformDataA && waveformDataB) {
        const targetWidth = Math.max(canvasA.offsetWidth || 800, 400);
        waveformDataA = AudioLabWaveforms.extractWaveform(bufA, targetWidth, commonDuration);
        waveformDataB = AudioLabWaveforms.extractWaveform(bufB, targetWidth, commonDuration);
        const currentMix = parseInt(mix.value, 10);
        const aRatio = 1 - (currentMix / 100);
        const bRatio = currentMix / 100;
        AudioLabWaveforms.drawWaveform(canvasA, waveformDataA, WAVEFORM_COLOR_A, WAVEFORM_BACKGROUND, aRatio);
        AudioLabWaveforms.drawWaveform(canvasB, waveformDataB, WAVEFORM_COLOR_B, WAVEFORM_BACKGROUND, bRatio);
      }
    }, 250);
  });

  // ---------- Initialization ----------
  mix.value = "0";
  makeGraphIfNeeded();
  setMix(0);
  setPlayIcon(false);

  setStatus("Loading default ...");
  startTicker();

  if (defaultAudioA && defaultAudioB) {
    loadDefaultPair().catch((e) => {
      console.error(e);
      setStatus(`Default load failed: ${e.message}`);
    });
  } else {
    setStatus("Configure default audio files to start.");
  }
}

// Auto-initialize on DOMContentLoaded if abRoot exists (backward compatibility)
document.addEventListener("DOMContentLoaded", () => {
  const root = document.getElementById('abRoot');
  if (root && !root.dataset.initialized) {
    initAudioLab({
      rootId: 'abRoot',
      defaultAudioA: '/assets/audio/Hello.mp3',
      defaultAudioB: '/assets/audio/Hello_enhanced.mp3',
      allowUpload: true
    });
    root.dataset.initialized = 'true';
  }
});
