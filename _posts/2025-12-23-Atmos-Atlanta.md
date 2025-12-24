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

<!-- Use unified initialization script -->
<script 
  data-vocals-url="assets/audio/atmos_night/vocals.mp3"
  data-instrumental-url="assets/audio/atmos_night/instrumental.mp3"
  src="{{ '/assets/js/sound-lab-init.js' | relative_url }}"></script>

<br>