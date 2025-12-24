---
title: 🪩 Atmos Night in Spherical Harmonics
date: 2025-12-23 00:00:00 +100
categories: [Music, AI]
tags: [feature, music]
---
![demo]({{ '/assets/img/2025-12-23/studio.jpg' | relative_url }})

### Atmos Night
This song, [“Atmos Night”](https://suno.com/s/GoYJcm5TnUual65I), was created through a joint effort between myself, GPT, and SUNO, written for personal reflection and as a small birthday project.

The song reflects many late nights similar to those described in the lyrics, though not always focused on music itself. Glowing screens, AI-assisted coding, guitars resting in the room, and getting through the night with a can of Monster. It’s less a narrative than a snapshot: a brief record of learning and quiet focus.

---
<div id="ambisonicViewer"></div>

<!-- Use unified initialization script -->
<script 
  data-vocals-url="{{ '/assets/audio/atmos_night/vocals.mp3' | relative_url }}"
  data-instrumental-url="{{ '/assets/audio/atmos_night/instrumental.mp3' | relative_url }}"
  src="{{ '/assets/js/sound-lab-init.js' | relative_url }}"></script>

<br>


#### lyrics:
```
[Verse 1]
A can of Monster, cold and still  
On a desk in Midtown Atlanta  
Windows glowing soft against the sky  
Spherical harmonics spin on the screen  
Pulling sound into the monitors  
He talks to the cursor  
Line by line

[Verse 2]
He’s mixing dreams in Atmos  
Rhythm drifts, the melody dances  
Reverb echoes reaching in from afar  
Every note takes its own track to open up the space

[Chorus]
Starlight overhead, lakalaka, slow and bright  
Drumbeats flooding the ground, boom boom alive
The Les Paul soaring at nine o’clock in the sky  
While the Taylor on the right gently weeps
Humming close, soft and slow  
whisper the secret only he knows

[Guitar solo]

[Outro]
The night weighs heavy on his eyes  
Every dream he never named  
Still flickers inside the sound he made  

Whisper a secret only he knows  
…only he knows

```

---
### Ambisonic Viewer

The Ambisonic Viewer has been added to the Sound Lab collection. It is a browser-first, real-time visualization for spatial audio on the sphere, designed to run entirely on the client without backend computation. To achieve interactive performance in the browser, the viewer uses Gaussian density kernels as a lightweight perceptual approximation of spherical harmonic bases, providing an intuitive, non-exact representation of Atmos-to-Ambisonic spatial mapping. The focus is on clarity and spatial intuition rather than physically exact HOA reconstruction, making it suitable for inspection, exploration, and demonstration of spatial audio behavior in real time.