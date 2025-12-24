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
### Ambisonic Viewer

<div id="ambisonicViewer"></div>

<!-- Load Three.js from CDN -->
<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>
<script src="{{ '/assets/js/audio-lab/ambisonic-viewer.js' | relative_url }}"></script>
<script>
(function() {
  function initViewer() {
    // Check if Three.js and initAmbisonicViewer are loaded
    if (typeof THREE === 'undefined') {
      console.error('AmbisonicViewer: Three.js not loaded');
      return;
    }
    if (typeof initAmbisonicViewer === 'undefined') {
      console.error('AmbisonicViewer: initAmbisonicViewer function not found');
      return;
    }
    
    const viewer = document.getElementById('ambisonicViewer');
    if (!viewer) {
      console.error('AmbisonicViewer: Container element not found');
      return;
    }
    
    initAmbisonicViewer('ambisonicViewer', {
      // Support up to 2 audio files, each can be split into left/right channels (4 tracks total)
      // Position can be specified as:
      //   - position_az_el: "(-135.0, 10.0)" (azimuth in degrees, elevation in degrees)
      //   - left_position_az_el / right_position_az_el: separate positions for stereo channels
      defaultTracks: [
        {
          url: "{{ '/assets/audio/atmos_night/vocals.mp3' | relative_url }}",,
          // If stereo split is enabled, use left/right positions:
          left_position_az_el: '(-90.0, 10.0)',   // Left channel position
          right_position_az_el: '(90.0, -10.0)'     // Right channel position
        },
        {
          url: "{{ '/assets/audio/atmos_night/instrumental.mp3' | relative_url }}",
          left_position_az_el: '(45.0, -20.0)',
          right_position_az_el: '(-45.0, 20.0)'
        }
      ], 
      sphereColor: 0xcccccc,
      track1BulgeColor: 0xff6b9d, // 杰尼蓝
      track2BulgeColor: 0xb9cce2,  // 桃红色
      gridColor: 0xcccccc, // Light gray, semi-transparent
      baseRadius: 1.0,
      maxRadiusMultiplier: 1.2, // Max 20% radius increase = 20% diameter increase
      gaussianSigma: 0.3, // Controls bulge width (default: 0.3)
      gridSegments: 32, // Number of segments for sphere grid (default: 64, higher = finer grid)
      initialAzimuth: 0.0,      // 水平角度（默认：0.0度）
      initialElevation: -30.0,
    });
  }
  
  // Try to initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initViewer);
  } else {
    // DOM is already ready
    initViewer();
  }
})();
</script>

<br>
The **Ambisonic Viewer** displays a 3D sphere with an equiangular grid that responds to audio in real-time. You can upload or specify up to 3 audio tracks, each with its own spatial position (defined by spherical coordinates theta and phi). As each track plays, the sphere creates Gaussian-distributed bulges at the track's position, with the bulge height proportional to the track's audio volume. Multiple tracks play simultaneously and mix together, creating a spatial audio visualization where each sound source is represented as a "mountain peak" on the sphere. The sphere's center remains fixed while you can drag with your mouse (or touch on mobile) to rotate the camera around it in any direction. When idle, the camera automatically returns to the front view and the sphere slowly auto-rotates.


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
document.addEventListener("DOMContentLoaded", () => {
  const root = document.getElementById('abRoot');
  if (root) {
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
  }
}); 
</script>

<br>
The **A/B Test** module supports precise, interactive playback control. Users can click directly on the progress bar to jump to any position in the audio, enabling fast navigation and focused listening. The progress bar also visualizes signal magnitude over time, providing a compact view of loudness structure while listening. Combined with smooth crossfading between two time-aligned audio tracks via a continuous slider, the tool is designed for careful, repeatable audio evaluation.
