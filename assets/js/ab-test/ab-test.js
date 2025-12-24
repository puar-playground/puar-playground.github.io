/* assets/js/ab-test.js
 * Configurable AB Test UI for Audio Comparison
 * 
 * Usage:
 *   initABTest({
 *     rootId: 'abRoot',
 *     defaultAudioA: '/assets/audio/Hello.mp3',
 *     defaultAudioB: '/assets/audio/Hello_enhanced.mp3',
 *     allowUpload: true,
 *     waveformColorA: '#FF2600',
 *     waveformColorB: '#659BC8'
 *   });
 * 
 * Dependencies (load in order):
 *   1. ab-test-alignment.js
 *   2. ab-test-waveforms.js
 *   3. ab-test-ui.js
 *   4. ab-test.js (this file)
 */

function initABTest(config = {}) {
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
    console.error(`ABTest: #${rootId} not found. Add <div id='${rootId}'></div> to the page.`);
    return;
  }

  root.innerHTML = ABTestUI.generateHTML(allowUpload);

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

  const setStatus = (msg) => { /* Status text removed - no-op */ };
  const setPlayIcon = (playing) => {
    const playIcon = document.getElementById('playIcon');
    const pauseIcon = document.getElementById('pauseIcon');
    if (playIcon && pauseIcon) {
      playIcon.style.display = playing ? 'none' : 'block';
      pauseIcon.style.display = playing ? 'block' : 'none';
    } else {
      // Fallback for old text-based icons
      btnPlay.textContent = playing ? '⏸' : '▶︎';
    }
  };

  // ---------- WebAudio State ----------
  let ctx = null;
  let bufA = null;
  let bufB = null;
  let gainA = null;
  let gainB = null;
  let audioA = null; // HTMLAudioElement for track A
  let audioB = null; // HTMLAudioElement for track B
  let sourceA = null; // MediaElementSource for track A
  let sourceB = null; // MediaElementSource for track B
  let isPlaying = false;
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

  // iOS audio unlock: resume context and unlock silent mode
  const unlockAudio = async () => {
    ensureCtx();
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
        console.log('Audio context resumed');
      } catch (e) {
        console.warn('Failed to resume audio context:', e);
      }
    }
    
    // iOS: Unlock silent mode by playing a very short silent audio via HTMLAudioElement
    // This allows Web Audio API to play even when device is in silent mode
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    if (isIOS) {
      // Create a global unlock function that only runs once
      if (!window._abTestAudioUnlocked) {
        window._abTestAudioUnlocked = false;
        
        try {
          // Create a very short silent audio buffer (1 sample at 44.1kHz = ~0.000023 seconds)
          const sampleRate = 44100;
          const length = 1;
          const audioBuffer = ctx.createBuffer(1, length, sampleRate);
          
          // Create a source and play it immediately to unlock audio
          const unlockSource = ctx.createBufferSource();
          unlockSource.buffer = audioBuffer;
          unlockSource.connect(ctx.destination);
          unlockSource.start(0);
          unlockSource.stop(0.001); // Stop immediately
          
          // Also try HTMLAudioElement method as backup
          const silentAudio = new Audio();
          // Use a data URI for a minimal silent audio (1 sample)
          silentAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
          silentAudio.volume = 0.0001; // Very quiet but not zero
          
          const playPromise = silentAudio.play();
          if (playPromise !== undefined) {
            playPromise.then(() => {
              silentAudio.pause();
              silentAudio.currentTime = 0;
              window._abTestAudioUnlocked = true;
              console.log('iOS audio unlocked (silent mode bypass)');
            }).catch(() => {
              // Ignore errors - Web Audio method may have worked
              window._abTestAudioUnlocked = true;
            });
          } else {
            window._abTestAudioUnlocked = true;
          }
        } catch (e) {
          console.warn('Error unlocking iOS audio:', e);
          window._abTestAudioUnlocked = true; // Mark as attempted
        }
      }
    }
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
    // Pause audio elements instead of stopping BufferSource
    try { if (audioA) audioA.pause(); } catch {}
    try { if (audioB) audioB.pause(); } catch {}
    // Note: MediaElementSource persists, we just pause the audio elements
  };

  const stopTicker = () => { if (raf) cancelAnimationFrame(raf); raf = null; };

  const startTicker = () => {
    stopTicker();
    const loop = () => {
      let t = startOffset;
      // Use audio element currentTime instead of AudioContext time
      if (isPlaying && audioA && audioB) {
        // Use the earlier of the two audio times (accounting for lag)
        const timeA = audioA.currentTime - (lagSec < 0 ? -lagSec : 0);
        const timeB = audioB.currentTime - (lagSec > 0 ? lagSec : 0);
        t = Math.max(0, Math.min(timeA, timeB));
      }
      
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
      ABTestWaveforms.drawWaveform(canvasA, waveformDataA, WAVEFORM_COLOR_A, WAVEFORM_BACKGROUND, aRatio);
      ABTestWaveforms.drawWaveform(canvasB, waveformDataB, WAVEFORM_COLOR_B, WAVEFORM_BACKGROUND, bRatio);
    }
  };

  // ---------- Playback Control ----------
  const seekTo = async (timeSec) => {
    await unlockAudio(); // Unlock audio on waveform interaction (iOS)
    const wasPlaying = isPlaying;
    if (isPlaying) {
      pause();
    }
    const maxSeek = commonDuration > 0 ? commonDuration : Math.min(bufA.duration, bufB.duration);
    startOffset = Math.max(0, Math.min(timeSec, maxSeek));
    
    // Update audio element positions
    if (audioA && audioB) {
      const offA = startOffset + (lagSec < 0 ? -lagSec : 0);
      const offB = startOffset + (lagSec > 0 ? lagSec : 0);
      audioA.currentTime = clamp(offA, 0, Math.max(0, bufA.duration - 0.001));
      audioB.currentTime = clamp(offB, 0, Math.max(0, bufB.duration - 0.001));
    }
    
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

  const startBothAt = async (commonOffsetSec) => {
    if (!audioA || !audioB) {
      console.error('Audio elements not initialized');
      return;
    }
    
    teardownSources();
    makeGraphIfNeeded();

    const offA = commonOffsetSec + (lagSec < 0 ? -lagSec : 0);
    const offB = commonOffsetSec + (lagSec > 0 ?  lagSec : 0);

    const offA2 = clamp(offA, 0, Math.max(0, bufA.duration - 0.001));
    const offB2 = clamp(offB, 0, Math.max(0, bufB.duration - 0.001));

    startOffset = commonOffsetSec;
    
    // Set currentTime and play HTMLAudioElements (works in iOS silent mode)
    audioA.currentTime = offA2;
    audioB.currentTime = offB2;
    
    try {
      const playPromises = [audioA.play(), audioB.play()];
      await Promise.all(playPromises);
      
      isPlaying = true;
      setPlayIcon(true);
      setMix(parseInt(mix.value, 10));
      startTicker();
      
      // Set up end detection
      const durCommon = Math.min(
        bufA.duration - (lagSec < 0 ? -lagSec : 0),
        bufB.duration - (lagSec > 0 ? lagSec : 0)
      );
      
      const checkEnded = () => {
        if (!isPlaying) return;
        const timeA = audioA.currentTime - (lagSec < 0 ? -lagSec : 0);
        const timeB = audioB.currentTime - (lagSec > 0 ? lagSec : 0);
        const currentTime = Math.max(0, Math.min(timeA, timeB));
        
        if (currentTime >= durCommon - 0.05 || audioA.ended || audioB.ended) {
          isPlaying = false;
          setPlayIcon(false);
          setStatus("Ended.");
        } else {
          setTimeout(checkEnded, 100);
        }
      };
      
      audioA.addEventListener('ended', () => {
        if (isPlaying) {
          isPlaying = false;
          setPlayIcon(false);
          setStatus("Ended.");
        }
      });
      audioB.addEventListener('ended', () => {
        if (isPlaying) {
          isPlaying = false;
          setPlayIcon(false);
          setStatus("Ended.");
        }
      });
      
    } catch (e) {
      console.error('Failed to play audio:', e);
      isPlaying = false;
      setPlayIcon(false);
      setStatus("Play error.");
    }
  };

  const pause = () => {
    if (!isPlaying) return;
    // Get current time from audio elements
    if (audioA && audioB) {
      const timeA = audioA.currentTime - (lagSec < 0 ? -lagSec : 0);
      const timeB = audioB.currentTime - (lagSec > 0 ? lagSec : 0);
      startOffset = Math.max(0, Math.min(timeA, timeB));
    }
    teardownSources();
    isPlaying = false;
    setPlayIcon(false);
    setStatus("Paused.");
    startTicker();
  };

  const play = async () => {
    await unlockAudio();
    if (!bufA || !bufB || !audioA || !audioB) return;
    if (isPlaying) return;
    await startBothAt(startOffset);
    setStatus("Playing.");
  };

  const restart = async () => {
    await unlockAudio();
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

    // Get URLs for audio files
    let urlA, urlB;
    if (fileA instanceof File) {
      urlA = URL.createObjectURL(fileA);
    } else {
      urlA = fileA;
    }
    if (fileB instanceof File) {
      urlB = URL.createObjectURL(fileB);
    } else {
      urlB = fileB;
    }

    setStatus("Decoding ...");
    const [da, db] = await Promise.all([
      decodeAudioFile(fileA),
      decodeAudioFile(fileB)
    ]);
    bufA = da; bufB = db;

    // Create HTMLAudioElement for iOS silent mode support
    ensureCtx();
    makeGraphIfNeeded();
    
    // Create or reuse audio elements
    if (!audioA) {
      audioA = document.createElement('audio');
      audioA.style.display = 'none';
      audioA.preload = 'auto';
      document.body.appendChild(audioA);
    }
    if (!audioB) {
      audioB = document.createElement('audio');
      audioB.style.display = 'none';
      audioB.preload = 'auto';
      document.body.appendChild(audioB);
    }
    
    audioA.src = urlA;
    audioB.src = urlB;
    
    // Create MediaElementSource if not exists
    if (!sourceA) {
      try {
        sourceA = ctx.createMediaElementSource(audioA);
        sourceA.connect(gainA);
      } catch (e) {
        console.warn('MediaElementSource A may already exist:', e);
      }
    }
    if (!sourceB) {
      try {
        sourceB = ctx.createMediaElementSource(audioB);
        sourceB.connect(gainB);
      } catch (e) {
        console.warn('MediaElementSource B may already exist:', e);
      }
    }

    setStatus("Aligning ...");
    const est = ABTestAlignment.estimateAlignment(bufA, bufB);
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
        waveformDataA = ABTestWaveforms.extractWaveform(bufA, targetWidth, commonDuration);
        waveformDataB = ABTestWaveforms.extractWaveform(bufB, targetWidth, commonDuration);
        const currentMix = parseInt(mix.value, 10);
        const aRatio = 1 - (currentMix / 100);
        const bRatio = currentMix / 100;
        ABTestWaveforms.drawWaveform(canvasA, waveformDataA, WAVEFORM_COLOR_A, WAVEFORM_BACKGROUND, aRatio);
        ABTestWaveforms.drawWaveform(canvasB, waveformDataB, WAVEFORM_COLOR_B, WAVEFORM_BACKGROUND, bRatio);
        setStatus("Ready.");
      });
    });
    
    // Setup scrubbing (use common duration for both)
    const commonBuffer = { duration: commonDuration };
    ABTestWaveforms.setupWaveformScrubbing(canvasA, commonBuffer, playheadA, seekTo);
    ABTestWaveforms.setupWaveformScrubbing(canvasB, commonBuffer, playheadB, seekTo);

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

    const scriptTag = document.querySelector('script[src*="ab-test.js"]');
    const scriptSrc = scriptTag ? scriptTag.getAttribute('src') : '/assets/js/ab-test/ab-test.js';
    const basePath = scriptSrc.replace(/\/ab-test\/ab-test\.js$/, '').replace(/\/ab-test\.js$/, '');
    
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
      await unlockAudio();
      if (isPlaying) pause();
      else await play();
    } catch (e) {
      setStatus(`Play error: ${e.message}`);
    }
  };

  btnRestart.onclick = async () => {
    await unlockAudio();
    await restart();
  };

  mix.addEventListener("input", () => {
    setMix(parseInt(mix.value, 10));
  });

  // iOS audio unlock: one-time unlock on first user interaction
  let audioUnlocked = false;
  const unlockAudioOnce = async (e) => {
    if (!audioUnlocked) {
      await unlockAudio();
      audioUnlocked = true;
      // Remove listeners after first unlock
      document.removeEventListener('touchstart', unlockAudioOnce);
      document.removeEventListener('touchend', unlockAudioOnce);
      document.removeEventListener('click', unlockAudioOnce);
    }
  };
  // Add listeners for iOS audio unlock
  document.addEventListener('touchstart', unlockAudioOnce, { once: true, passive: true });
  document.addEventListener('touchend', unlockAudioOnce, { once: true, passive: true });
  document.addEventListener('click', unlockAudioOnce, { once: true });

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
        waveformDataA = ABTestWaveforms.extractWaveform(bufA, targetWidth, commonDuration);
        waveformDataB = ABTestWaveforms.extractWaveform(bufB, targetWidth, commonDuration);
        const currentMix = parseInt(mix.value, 10);
        const aRatio = 1 - (currentMix / 100);
        const bRatio = currentMix / 100;
        ABTestWaveforms.drawWaveform(canvasA, waveformDataA, WAVEFORM_COLOR_A, WAVEFORM_BACKGROUND, aRatio);
        ABTestWaveforms.drawWaveform(canvasB, waveformDataB, WAVEFORM_COLOR_B, WAVEFORM_BACKGROUND, bRatio);
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
    initABTest({
      rootId: 'abRoot',
      defaultAudioA: '/assets/audio/Hello.mp3',
      defaultAudioB: '/assets/audio/Hello_enhanced.mp3',
      allowUpload: true
    });
    root.dataset.initialized = 'true';
  }
});

