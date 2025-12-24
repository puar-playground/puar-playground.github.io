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

<!-- Unified initialization script - loads all dependencies and initializes modules -->
<!-- Pass audio URLs via data attributes for Jekyll template processing -->
<script 
  data-vocals-url="https://puar-playground.github.io/assets/audio/atmos_night/vocals.mp3"
  data-instrumental-url="https://puar-playground.github.io/assets/audio/atmos_night/instrumental.mp3"
  data-audio-a-url="https://puar-playground.github.io/assets/audio/Hello.mp3"
  data-audio-b-url="https://puar-playground.github.io/assets/audio/Hello_enhanced.mp3"
  src="{{ '/assets/js/sound-lab-init.js' | relative_url }}"></script>


---
### Ambisonic Viewer

<div id="ambisonicViewer"></div>

<br>
The **Ambisonic Viewer** displays a 3D sphere with an equiangular grid that responds to audio in real-time. You can upload or specify up to 3 audio tracks, each with its own spatial position (defined by spherical coordinates theta and phi). As each track plays, the sphere creates Gaussian-distributed bulges at the track's position, with the bulge height proportional to the track's audio volume. Multiple tracks play simultaneously and mix together, creating a spatial audio visualization where each sound source is represented as a "mountain peak" on the sphere. The sphere's center remains fixed while you can drag with your mouse (or touch on mobile) to rotate the camera around it in any direction. When idle, the camera automatically returns to the front view and the sphere slowly auto-rotates.

---
### A/B Test

<!-- ✅ JS 会在这里注入所有 UI -->
<div id="abRoot" data-initialized="false"></div>

<br>
The **A/B Test** module supports precise, interactive playback control. Users can click directly on the progress bar to jump to any position in the audio, enabling fast navigation and focused listening. The progress bar also visualizes signal magnitude over time, providing a compact view of loudness structure while listening. Combined with smooth crossfading between two time-aligned audio tracks via a continuous slider, the tool is designed for careful, repeatable audio evaluation.

