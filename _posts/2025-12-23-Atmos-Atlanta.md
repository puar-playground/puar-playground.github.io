---
title: 🪩 Ambisonic Viewer 
date: 2025-12-23 00:00:00 +500
categories: [News, Features]
tags: [feature, music]
---

### Ambisonic Viewer

The **Ambisonic Viewer** displays a 3D sphere with an equiangular grid that responds to audio in real-time. You can upload or specify up to 3 audio tracks, each with its own spatial position (defined by spherical coordinates theta and phi). As each track plays, the sphere creates Gaussian-distributed bulges at the track's position, with the bulge height proportional to the track's audio volume. Multiple tracks play simultaneously and mix together, creating a spatial audio visualization where each sound source is represented as a "mountain peak" on the sphere. The sphere's center remains fixed while you can drag with your mouse (or touch on mobile) to rotate the camera around it in any direction. When idle, the camera automatically returns to the front view and the sphere slowly auto-rotates.

---
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
      return false;
    }
    if (typeof window.initAmbisonicViewer === 'undefined') {
      console.error('AmbisonicViewer: initAmbisonicViewer function not found');
      return false;
    }
    
    const viewer = document.getElementById('ambisonicViewer');
    if (!viewer) {
      console.error('AmbisonicViewer: Container element not found');
      return false;
    }
    
    try {
      window.initAmbisonicViewer('ambisonicViewer', {
      // Support up to 2 audio files, each can be split into left/right channels (4 tracks total)
      // Position can be specified as:
      //   - position_az_el: "(-135.0, 10.0)" (azimuth in degrees, elevation in degrees)
      //   - left_position_az_el / right_position_az_el: separate positions for stereo channels
      defaultTracks: [
        {
          url: "{{ '/assets/audio/atmos_night/vocals.mp3' | relative_url }}",
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
      track1BulgeColor: 0xff6b9d, 
      track2BulgeColor: 0xb9cce2, 
      gridColor: 0xcccccc, // Light gray, semi-transparent
      baseRadius: 1.0,
      maxRadiusMultiplier: 1.2, // Max 20% radius increase = 20% diameter increase
      gaussianSigma: 0.3, // Controls bulge width (default: 0.3)
      gridSegments: 32, // Number of segments for sphere grid (default: 64, higher = finer grid)
      initialAzimuth: 0.0,    
      initialElevation: -30.0,
      });
      return true;
    } catch (error) {
      console.error('AmbisonicViewer: Initialization error:', error);
      return false;
    }
  }
  
  // Try to initialize when DOM is ready
  function tryInit() {
    if (!initViewer()) {
      // If initialization failed, retry after a short delay
      setTimeout(tryInit, 100);
    }
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryInit);
  } else {
    // DOM is already ready, but scripts might still be loading
    setTimeout(tryInit, 50);
  }
})();
</script>

<br>