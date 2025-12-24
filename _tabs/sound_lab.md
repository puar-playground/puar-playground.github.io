---
title: Sound Lab
layout: page
permalink: /sound_lab/
icon: fas fa-headphones
order: 3
---

<style>
.ab-wrap { display: grid; gap: 12px; }
.ab-card { border: 1px solid rgba(0,0,0,.15); border-radius: 12px; padding: 12px; }
.ab-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.small { font-size: 0.9em; opacity: 0.85; }
code { padding: 2px 6px; border-radius: 6px; background: rgba(0,0,0,.06); }
button { padding: 8px 12px; border-radius: 10px; border: 1px solid rgba(0,0,0,.2); cursor: pointer; }
button:disabled { opacity: 0.5; cursor: not-allowed; }
</style>

**Sound Lab** is an experimental space for exploring sound through the web. It hosts interactive tools for audio visualization, comparison, and critical listening, designed to make sound structures, transformations, and perceptual differences easier to see and hear. This lab serves both as a technical playground and a listening desk—where signal processing ideas, audio models, and sound design concepts can be inspected, tested, and experienced directly in the browser.

---
### A/B Test

<!-- ✅ JS 会在这里注入所有 UI -->
<div id="abRoot" data-initialized="false"></div>

<!-- ✅ 关键：用 defer，保证 DOM 在 JS 前就绪 -->
<!-- Load dependencies in order -->
<script src="{{ '/assets/js/ab-test/ab-test-alignment.js' | relative_url }}" defer></script>
<script src="{{ '/assets/js/ab-test/ab-test-waveforms.js' | relative_url }}" defer></script>
<script src="{{ '/assets/js/ab-test/ab-test-ui.js' | relative_url }}" defer></script>
<script src="{{ '/assets/js/ab-test/ab-test.js' | relative_url }}" defer></script>
<script>
(function() {
  function initABTestModule() {
    // Check if initABTest is loaded
    if (typeof initABTest === 'undefined') {
      console.error('ABTest: initABTest function not found');
      return false;
    }
    
    const root = document.getElementById('abRoot');
    if (!root) {
      console.error('ABTest: Container element not found');
      return false;
    }
    
    try {
      root.dataset.initialized = 'true';
      initABTest({
        rootId: 'abRoot',
        // defaultAudioA: '/assets/audio/Hello.mp3',
        // defaultAudioB: '/assets/audio/Hello_enhanced.mp3',
        defaultAudioA: "{{ '/assets/audio/Hello.mp3' | relative_url }}",
        defaultAudioB: "{{ '/assets/audio/Hello_enhanced.mp3' | relative_url }}",
        allowUpload: true,
        waveformColorA: '#FF2600',
        waveformColorB: '#659BC8'
      });
      return true;
    } catch (error) {
      console.error('ABTest: Initialization error:', error);
      return false;
    }
  }
  
  // Try to initialize when DOM is ready
  function tryInitABTest() {
    if (!initABTestModule()) {
      // If initialization failed, retry after a short delay
      // This handles the case where defer scripts are still loading
      setTimeout(tryInitABTest, 100);
    }
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryInitABTest);
  } else {
    // DOM is already ready, but defer scripts might still be loading
    setTimeout(tryInitABTest, 50);
  }
})();
</script>

<br>
The **A/B Test** module supports precise, interactive playback control. Users can click directly on the progress bar to jump to any position in the audio, enabling fast navigation and focused listening. The progress bar also visualizes signal magnitude over time, providing a compact view of loudness structure while listening. Combined with smooth crossfading between two time-aligned audio tracks via a continuous slider, the tool is designed for careful, repeatable audio evaluation.
