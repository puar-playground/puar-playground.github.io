---
title: Sound Lab
layout: page
permalink: /ab/
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
The **A/B Test** module supports precise, interactive playback control. Users can click directly on the progress bar to jump to any position in the audio, enabling fast navigation and focused listening. The progress bar also visualizes signal magnitude over time, providing a compact view of loudness structure while listening. Combined with smooth crossfading between two time-aligned audio tracks via a continuous slider, the tool is designed for careful, repeatable audio evaluation.

<!-- ✅ JS 会在这里注入所有 UI -->
<div id="abRoot" data-initialized="false"></div>

<!-- ✅ 关键：用 defer，保证 DOM 在 JS 前就绪 -->
<!-- Load dependencies in order -->
<script src="{{ '/assets/js/ab-test/ab-test-alignment.js' | relative_url }}" defer></script>
<script src="{{ '/assets/js/ab-test/ab-test-waveforms.js' | relative_url }}" defer></script>
<script src="{{ '/assets/js/ab-test/ab-test-ui.js' | relative_url }}" defer></script>
<script src="{{ '/assets/js/ab-test/ab-test.js' | relative_url }}" defer></script>
<script>
document.addEventListener("DOMContentLoaded", () => {
  const root = document.getElementById('abRoot');
  if (root) {
    root.dataset.initialized = 'true';
    initABTest({
      rootId: 'abRoot',
      defaultAudioA: '/assets/audio/Hello.mp3',
      defaultAudioB: '/assets/audio/Hello_enhanced.mp3',
      allowUpload: true,
      waveformColorA: '#FF2600',
      waveformColorB: '#659BC8'
    });
  }
}); 
</script>

---
