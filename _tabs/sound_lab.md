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
  data-vocals-url="{{ '/assets/audio/atmos_night/vocals.mp3' | relative_url }}"
  data-instrumental-url="{{ '/assets/audio/atmos_night/instrumental.mp3' | relative_url }}"
  data-audio-a-url="{{ '/assets/audio/Hello.mp3' | relative_url }}"
  data-audio-b-url="{{ '/assets/audio/Hello_enhanced.mp3' | relative_url }}"
  src="{{ '/assets/js/sound-lab-init.js' | relative_url }}"></script>


---
### Ambisonic Viewer

<div id="ambisonicViewer"></div>

<br>
Ambisonic Viewer (Browser-first Approximation)

The Ambisonic Viewer is a browser-first, real-time visualization for spatial audio on the sphere. It is designed to run entirely on the client side—no backend rendering, no server-side DSP—so the interaction stays responsive and portable.

To make this feasible in the browser, the current implementation uses a Gaussian density kernel as a lightweight perceptual surrogate for spherical harmonic basis functions. This provides an intuitive “energy-on-the-sphere” view of object-based spatial audio (conceptually related to Atmos-to-Ambisonic mapping), while avoiding the computational cost of evaluating and rendering true spherical-harmonic fields at interactive frame rates.

As a result, the visualization is not a physically exact HOA reconstruction and is not intended to recover Ambisonic coefficients. Instead, it prioritizes clarity and real-time feedback: sound sources appear as smooth, localized peaks whose height follows the relative audio energy, mixing naturally when multiple sources play together.

The sphere remains fixed at the center while you can rotate the camera via mouse or touch; when idle, the view recenters and the sphere slowly auto-rotates to preserve spatial context.

---
### A/B Test

<!-- ✅ JS 会在这里注入所有 UI -->
<div id="abRoot" data-initialized="false"></div>

<br>
The **A/B Test** module supports precise, interactive playback control. Users can click directly on the progress bar to jump to any position in the audio, enabling fast navigation and focused listening. The progress bar also visualizes signal magnitude over time, providing a compact view of loudness structure while listening. Combined with smooth crossfading between two time-aligned audio tracks via a continuous slider, the tool is designed for careful, repeatable audio evaluation.

**Implementation Note:** Unlike the Ambisonic Viewer which uses HTMLAudioElement with MediaElementSource (enabling playback in iOS silent mode), the A/B Test module uses Web Audio API's BufferSource for precise sample-level synchronization and crossfading control. This approach provides better audio synchronization between the two tracks but comes with the limitation that audio **will not play** when iOS devices are in **silent mode**. This trade-off prioritizes audio precision and synchronization accuracy over iOS silent mode compatibility.

