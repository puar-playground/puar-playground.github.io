/* audio-lab-waveforms.js
 * Waveform extraction and visualization
 */

const AudioLabWaveforms = (function() {
  'use strict';

  function extractWaveform(buffer, targetWidth = 800, maxDuration = null) {
    const mono = AudioLabAlignment.monoFromBuffer(buffer);
    const sampleRate = buffer.sampleRate;
    let samples = mono.length;
    
    // Trim to maxDuration if specified
    if (maxDuration !== null && maxDuration > 0) {
      const maxSamples = Math.floor(maxDuration * sampleRate);
      samples = Math.min(samples, maxSamples);
    }
    
    const step = Math.max(1, Math.floor(samples / targetWidth));
    const points = Math.floor(samples / step);
    const waveform = [];
    
    for (let i = 0; i < points; i++) {
      let min = 1, max = -1;
      let sum = 0, count = 0;
      const start = i * step;
      const end = Math.min(start + step, samples);
      for (let j = start; j < end; j++) {
        const val = mono[j];
        if (val < min) min = val;
        if (val > max) max = val;
        sum += Math.abs(val);
        count++;
      }
      const rms = count > 0 ? Math.sqrt(sum / count) : 0;
      waveform.push({ min, max, rms });
    }
    return waveform;
  }

  function drawWaveform(canvas, waveform, color = "#FF98DD", backgroundColor = "#f5f5f5", alpha = 1.0) {
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const displayWidth = rect.width;
    const displayHeight = rect.height;
    
    // Set canvas size accounting for device pixel ratio
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    
    // Scale context to handle high DPI
    ctx.scale(dpr, dpr);
    
    // Clear and fill background
    ctx.clearRect(0, 0, displayWidth, displayHeight);
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, displayWidth, displayHeight);
    
    if (!waveform || waveform.length === 0) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      return;
    }
    
    const centerY = displayHeight / 2;
    const step = displayWidth / waveform.length;
    const barWidth = Math.max(0.5, step * 0.85);
    
    // Convert hex color to RGB and apply alpha
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Draw filled waveform bars (DAW style) with alpha
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    
    for (let i = 0; i < waveform.length; i++) {
      const x = i * step;
      const min = waveform[i].min;
      const max = waveform[i].max;
      const rms = waveform[i].rms;
      
      // Use RMS for magnitude, with min/max for range
      const magnitude = Math.max(Math.abs(min), Math.abs(max), rms * 1.5);
      const barHeight = Math.max(0.5, magnitude * displayHeight * 0.9);
      
      // Draw symmetric waveform from center
      const top = centerY - barHeight / 2;
      
      ctx.fillRect(x, top, barWidth, barHeight);
    }
    
    // Reset transform
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function setupWaveformScrubbing(canvas, buffer, playheadEl, onSeek) {
    let isDragging = false;
    
    const getPositionFromEvent = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      return Math.max(0, Math.min(1, x / rect.width));
    };
    
    const seekToPosition = (pos) => {
      const time = pos * buffer.duration;
      onSeek(time);
    };
    
    canvas.addEventListener("mousedown", (e) => {
      isDragging = true;
      const pos = getPositionFromEvent(e);
      seekToPosition(pos);
    });
    
    canvas.addEventListener("mousemove", (e) => {
      if (isDragging) {
        const pos = getPositionFromEvent(e);
        seekToPosition(pos);
      }
    });
    
    canvas.addEventListener("mouseup", () => {
      isDragging = false;
    });
    
    canvas.addEventListener("mouseleave", () => {
      isDragging = false;
    });
    
    // Touch support
    canvas.addEventListener("touchstart", (e) => {
      e.preventDefault();
      isDragging = true;
      const touch = e.touches[0];
      const pos = getPositionFromEvent(touch);
      seekToPosition(pos);
    });
    
    canvas.addEventListener("touchmove", (e) => {
      e.preventDefault();
      if (isDragging) {
        const touch = e.touches[0];
        const pos = getPositionFromEvent(touch);
        seekToPosition(pos);
      }
    });
    
    canvas.addEventListener("touchend", () => {
      isDragging = false;
    });
  }

  return {
    extractWaveform,
    drawWaveform,
    setupWaveformScrubbing
  };
})();

