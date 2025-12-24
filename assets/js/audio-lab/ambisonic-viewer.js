/* ambisonic-viewer.js
 * 3D rotating sphere with equiangular grid that responds to audio volume
 * Uses Three.js for 3D rendering and Web Audio API for audio analysis
 */

(function() {
  'use strict';

  function initAmbisonicViewer(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`AmbisonicViewer: #${containerId} not found`);
      return;
    }

    const {
      defaultTracks = [], // Array of {url, theta, phi} or {url, position_az_el} for up to 2 audio files
      // theta: polar angle from y-axis (0 to PI, PI/2 = equator)
      // phi: azimuthal angle in xz plane (0 to 2*PI)
      // position_az_el: string like "(-135.0, 10.0)" where first is azimuth in degrees, second is elevation in degrees
      sphereColor = null, // Auto-detect from theme
      gridColor = null, // Auto-detect from theme
      baseRadius = 1.0,
      maxRadiusMultiplier = 1.2, // Max 20% radius increase at peak bulge
      gaussianSigma = 0.5, // Standard deviation for Gaussian distribution (controls bulge width)
      gridSegments = 64, // Number of segments for sphere grid (default: 64, higher = finer grid)
      autoReturnDelay = 300, // ms before starting to return to front view after mouse release (default: 1000ms = 1 second
      autoReturnSpeed = 0.05, // interpolation speed for auto return (default: 0.05, higher = faster)
      bulgeColor = 0xff6b9d, // Color for sphere bulge (default: 0xff6b9d peach pink, 桃红色) - used for single track or as fallback
      track1BulgeColor = 0xb9cce2, // Color for track 1 bulge (default: 0xff6b9d peach pink, 桃红色)
      track2BulgeColor = 0xff6b9d, // Color for track 2 bulge (default: 0x4a90e2 sea blue, 海蓝色)
      minBulgeAlpha = 0.01, // Minimum alpha for bulge visibility (default: 0.05, lower = more transparent at low heights)
      gridLineOpacity = 0.9, // Opacity for grid lines (default: 0.3, range: 0.0 to 1.0)
      initialAzimuth = 0.0, // Initial camera azimuth angle in degrees (default: 0.0)
      initialElevation = -30.0 // Initial camera elevation angle in degrees (default: 45.0, 45度向下俯视)
    } = options;
    
    // Detect theme (dark/light)
    function getTheme() {
      const root = document.documentElement;
      // Check data-mode attribute first
      const mode = root.getAttribute('data-mode');
      if (mode === 'dark') return 'dark';
      if (mode === 'light') return 'light';
      // Check sessionStorage as fallback (set by theme toggle)
      try {
        const storedMode = sessionStorage.getItem('mode');
        if (storedMode === 'dark' || storedMode === 'light') {
          return storedMode;
        }
      } catch (e) {
        // Ignore storage errors
      }
      // Fallback to prefers-color-scheme
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
      return 'light';
    }
    
    // Get theme-adaptive colors
    function getThemeColors() {
      const theme = getTheme();
      if (theme === 'dark') {
        return {
          grid: 0x888888, // Medium gray for dark theme
          gridBase: 0x666666 // Darker gray for base
        };
      } else {
        return {
          grid: 0x000000, // Black for light theme (bright theme)
          gridBase: 0x333333 // Dark gray for base
        };
      }
    }
    
    // Initialize theme colors - ensure we get the current theme
    // Call getThemeColors() right before creating grid to ensure latest theme
    let themeColors = getThemeColors();
    let finalGridColor = gridColor !== null ? gridColor : themeColors.grid;
    
    const maxTracks = 4; // Support up to 2 stereo audio files (4 tracks total)
    
    // Convert azimuth-elevation to spherical coordinates (theta, phi)
    // This function is used for BOTH camera and audio track positions
    // azimuth: degrees, 0-360 (0 = front/x-axis, positive = counterclockwise)
    // elevation: degrees, -90 to 90 (0 = horizontal, positive = down/俯视, negative = up/仰视)
    // 
    // For CAMERA: elevation = 0 is horizontal, positive = down (俯视), negative = up (仰视)
    // For AUDIO TRACKS: elevation = 0 is horizontal, positive = above horizon, negative = below
    function azElToSpherical(azimuthDeg, elevationDeg, forCamera = false) {
      // Convert degrees to radians
      let azimuth = (azimuthDeg * Math.PI) / 180;
      const elevation = (elevationDeg * Math.PI) / 180;
      
      // Normalize azimuth to 0-360 degrees range (0 to 2*PI radians)
      // Handle negative values and values > 360
      azimuth = azimuth % (2 * Math.PI);
      if (azimuth < 0) azimuth += 2 * Math.PI;
      
      // In our coordinate system (y-up):
      // - theta: azimuthal angle in xz plane (0 = +x axis, PI/2 = +z, PI = -x, 3*PI/2 = -z)
      // - phi: polar angle from y-axis (0 = top/north pole, PI/2 = equator/horizontal, PI = bottom/south pole)
      
      if (forCamera) {
        // For camera: elevation = 0 is horizontal (phi = PI/2)
        // elevation positive = down (俯视) = phi > PI/2
        // elevation negative = up (仰视) = phi < PI/2
        const theta = azimuth; // Horizontal rotation
        const phi = Math.PI / 2 + elevation; // elevation down = phi increases from PI/2
        return { theta, phi: Math.max(0.1, Math.min(Math.PI - 0.1, phi)) }; // Clamp phi
      } else {
        // For audio tracks: elevation = 0 is horizontal (theta = PI/2)
        // elevation positive = above horizon = theta < PI/2 (toward north pole)
        // elevation negative = below horizon = theta > PI/2 (toward south pole)
        const theta = Math.PI / 2 - elevation; // elevation up = theta down from top
        const phi = azimuth; // azimuth directly maps to phi
        return { theta, phi };
      }
    }
    
    // Parse position_az_el string like "(-135.0, 10.0)"
    function parseAzElString(azElString) {
      const match = azElString.match(/\((-?\d+\.?\d*),\s*(-?\d+\.?\d*)\)/);
      if (match) {
        const azimuth = parseFloat(match[1]);
        const elevation = parseFloat(match[2]);
        return azElToSpherical(azimuth, elevation);
      }
      return null;
    }

    // Check if Three.js is loaded
    if (typeof THREE === 'undefined') {
      console.error('Three.js is not loaded. Please include Three.js before this script.');
      return;
    }
    
    // Setup Three.js scene
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000); // Wider FOV for larger view
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    
    // Set background color for better visibility
    renderer.setClearColor(0x000000, 0); // Transparent background
    
    // Container for controls - with border
    const controlsContainer = document.createElement('div');
    controlsContainer.style.marginBottom = '1em';
    controlsContainer.style.padding = '1em';
    controlsContainer.style.border = '1px solid rgba(0,0,0,0.15)';
    controlsContainer.style.borderRadius = '8px';
    controlsContainer.style.backgroundColor = 'rgba(0,0,0,0.02)';
    controlsContainer.style.width = '100%';
    controlsContainer.style.boxSizing = 'border-box';
    controlsContainer.style.overflow = 'hidden'; // Prevent overflow on mobile
    
    // Compact header with play button
    const headerDiv = document.createElement('div');
    headerDiv.style.display = 'flex';
    headerDiv.style.alignItems = 'center';
    headerDiv.style.gap = '1em';
    headerDiv.style.marginBottom = '0.75em';
    
    // Global play/pause button with icons
    const globalPlayButton = document.createElement('button');
    globalPlayButton.style.padding = '0.5em';
    globalPlayButton.style.width = '40px';
    globalPlayButton.style.height = '40px';
    globalPlayButton.style.cursor = 'pointer';
    globalPlayButton.style.borderRadius = '50%';
    globalPlayButton.style.border = 'none';
    globalPlayButton.style.backgroundColor = 'var(--btn-bg, #4a90e2)';
    globalPlayButton.style.color = 'var(--btn-color, white)';
    globalPlayButton.style.display = 'flex';
    globalPlayButton.style.alignItems = 'center';
    globalPlayButton.style.justifyContent = 'center';
    globalPlayButton.style.flexShrink = '0';
    globalPlayButton.style.transition = 'background-color 0.2s';
    
    // Play icon (triangle)
    const playIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    playIcon.setAttribute('width', '20');
    playIcon.setAttribute('height', '20');
    playIcon.setAttribute('viewBox', '0 0 24 24');
    playIcon.style.fill = 'currentColor';
    playIcon.style.display = 'block';
    const playPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    playPath.setAttribute('d', 'M8 5v14l11-7z');
    playIcon.appendChild(playPath);
    
    // Pause icon (two bars)
    const pauseIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    pauseIcon.setAttribute('width', '20');
    pauseIcon.setAttribute('height', '20');
    pauseIcon.setAttribute('viewBox', '0 0 24 24');
    pauseIcon.style.fill = 'currentColor';
    pauseIcon.style.display = 'none';
    const pausePath1 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    pausePath1.setAttribute('x', '6');
    pausePath1.setAttribute('y', '4');
    pausePath1.setAttribute('width', '4');
    pausePath1.setAttribute('height', '16');
    const pausePath2 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    pausePath2.setAttribute('x', '14');
    pausePath2.setAttribute('y', '4');
    pausePath2.setAttribute('width', '4');
    pausePath2.setAttribute('height', '16');
    pauseIcon.appendChild(pausePath1);
    pauseIcon.appendChild(pausePath2);
    
    globalPlayButton.appendChild(playIcon);
    globalPlayButton.appendChild(pauseIcon);
    
    // Hover effect
    globalPlayButton.addEventListener('mouseenter', () => {
      globalPlayButton.style.backgroundColor = 'var(--btn-bg-hover, #357abd)';
    });
    globalPlayButton.addEventListener('mouseleave', () => {
      globalPlayButton.style.backgroundColor = 'var(--btn-bg, #4a90e2)';
    });
    
    headerDiv.appendChild(globalPlayButton);
    
    // Function to update button icon
    function updatePlayButtonIcon(isPlaying) {
      if (isPlaying) {
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'block';
      } else {
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
      }
    }
    
    // Global progress bar with dual-track volume waveform
    const progressContainer = document.createElement('div');
    progressContainer.style.width = '100%';
    progressContainer.style.marginTop = '0.5em';
    progressContainer.style.display = 'flex';
    progressContainer.style.alignItems = 'center';
    progressContainer.style.gap = '0.5em';
    progressContainer.style.boxSizing = 'border-box';
    progressContainer.style.overflow = 'hidden'; // Prevent overflow on mobile
    
    const progressBarWrapper = document.createElement('div');
    progressBarWrapper.style.flex = '1';
    progressBarWrapper.style.height = '40px';
    progressBarWrapper.style.position = 'relative';
    progressBarWrapper.style.cursor = 'pointer';
    progressBarWrapper.style.borderRadius = '4px';
    progressBarWrapper.style.overflow = 'hidden';
    progressBarWrapper.style.backgroundColor = 'rgba(0,0,0,0.05)';
    progressBarWrapper.style.minWidth = '0'; // Allow flex item to shrink below content size
    progressBarWrapper.style.boxSizing = 'border-box';
    
    const progressCanvas = document.createElement('canvas');
    progressCanvas.style.width = '100%';
    progressCanvas.style.height = '100%';
    progressCanvas.style.display = 'block';
    progressBarWrapper.appendChild(progressCanvas);
    
    // Progress indicator line
    const progressIndicator = document.createElement('div');
    progressIndicator.style.position = 'absolute';
    progressIndicator.style.top = '0';
    progressIndicator.style.left = '0';
    progressIndicator.style.width = '2px';
    progressIndicator.style.height = '100%';
    progressIndicator.style.backgroundColor = 'var(--btn-bg, #4a90e2)';
    progressIndicator.style.pointerEvents = 'none';
    progressIndicator.style.transition = 'none';
    progressBarWrapper.appendChild(progressIndicator);
    
    const progressTime = document.createElement('span');
    progressTime.textContent = '0:00 / 0:00';
    progressTime.style.fontSize = '0.85em';
    progressTime.style.color = 'var(--text-color, #333)';
    progressTime.style.minWidth = '80px';
    progressTime.style.textAlign = 'right';
    progressTime.style.flexShrink = '0';
    
    progressContainer.appendChild(progressBarWrapper);
    progressContainer.appendChild(progressTime);
    headerDiv.appendChild(progressContainer);
    
    // Store static waveform data for both tracks
    let waveformData = {
      track1: null,
      track2: null
    };
    
    // Extract waveform from audio buffer
    async function extractWaveform(audioFile, targetWidth = 800) {
      if (!audioFile.audioElement.src) return null;
      
      try {
        // Create audio context for decoding
        const decodeContext = new (window.AudioContext || window.webkitAudioContext)();
        const response = await fetch(audioFile.audioElement.src);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await decodeContext.decodeAudioData(arrayBuffer);
        
        // Get mono channel data
        let channelData;
        if (audioBuffer.numberOfChannels === 1) {
          channelData = audioBuffer.getChannelData(0);
        } else {
          // Mix to mono
          const left = audioBuffer.getChannelData(0);
          const right = audioBuffer.getChannelData(1);
          channelData = new Float32Array(left.length);
          for (let i = 0; i < left.length; i++) {
            channelData[i] = 0.5 * (left[i] + right[i]);
          }
        }
        
        const sampleRate = audioBuffer.sampleRate;
        const samples = channelData.length;
        const step = Math.max(1, Math.floor(samples / targetWidth));
        const points = Math.floor(samples / step);
        const waveform = [];
        
        for (let i = 0; i < points; i++) {
          let min = 1, max = -1;
          let sum = 0, count = 0;
          const start = i * step;
          const end = Math.min(start + step, samples);
          for (let j = start; j < end; j++) {
            const val = channelData[j];
            if (val < min) min = val;
            if (val > max) max = val;
            sum += Math.abs(val);
            count++;
          }
          const rms = count > 0 ? Math.sqrt(sum / count) : 0;
          waveform.push({ min, max, rms });
        }
        
        decodeContext.close();
        return waveform;
      } catch (err) {
        console.error('Error extracting waveform:', err);
        return null;
      }
    }
    
    // Function to draw static dual-track volume waveform
    function drawVolumeWaveform() {
      const ctx = progressCanvas.getContext('2d');
      if (!ctx) return;
      
      const dpr = window.devicePixelRatio || 1;
      const rect = progressBarWrapper.getBoundingClientRect();
      const displayWidth = rect.width;
      const displayHeight = rect.height;
      
      progressCanvas.width = displayWidth * dpr;
      progressCanvas.height = displayHeight * dpr;
      ctx.scale(dpr, dpr);
      
      // Clear canvas
      ctx.clearRect(0, 0, displayWidth, displayHeight);
      
      // Draw background
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      ctx.fillRect(0, 0, displayWidth, displayHeight);
      
      if (!waveformData.track1 && !waveformData.track2) return;
      
      const centerY = displayHeight / 2;
      const maxLength = Math.max(
        waveformData.track1 ? waveformData.track1.length : 0,
        waveformData.track2 ? waveformData.track2.length : 0
      );
      
      if (maxLength === 0) return;
      
      const step = displayWidth / maxLength;
      const barWidth = Math.max(0.5, step * 0.9);
      
      // Helper function to convert hex color to rgba string
      function hexToRgba(hex, alpha = 0.6) {
        const r = (hex >> 16) & 0xff;
        const g = (hex >> 8) & 0xff;
        const b = hex & 0xff;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      }
      
      // Draw track 1 (top half) - first stereo file, use track1BulgeColor
      if (waveformData.track1 && waveformData.track1.length > 0) {
        ctx.fillStyle = hexToRgba(track1BulgeColor, 0.6);
        for (let i = 0; i < waveformData.track1.length; i++) {
          const x = i * step;
          const wf = waveformData.track1[i];
          const magnitude = Math.max(Math.abs(wf.min), Math.abs(wf.max), wf.rms * 1.5);
          const barHeight = Math.max(0.5, magnitude * centerY * 0.9);
          ctx.fillRect(x, centerY - barHeight, barWidth, barHeight);
        }
      }
      
      // Draw track 2 (bottom half) - second stereo file, use track2BulgeColor
      if (waveformData.track2 && waveformData.track2.length > 0) {
        ctx.fillStyle = hexToRgba(track2BulgeColor, 0.6);
        for (let i = 0; i < waveformData.track2.length; i++) {
          const x = i * step;
          const wf = waveformData.track2[i];
          const magnitude = Math.max(Math.abs(wf.min), Math.abs(wf.max), wf.rms * 1.5);
          const barHeight = Math.max(0.5, magnitude * centerY * 0.9);
          ctx.fillRect(x, centerY, barWidth, barHeight);
        }
      }
      
      // Reset transform
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    
    // Progress bar interaction
    let isDraggingProgress = false;
    
    function updateProgressBar() {
      if (minDuration === Infinity || minDuration === 0) {
        progressIndicator.style.left = '0%';
        progressTime.textContent = '0:00 / 0:00';
        return;
      }
      
      // Get current time from first playing audio, or 0 if none playing
      let currentTime = 0;
      const playingAudio = audioFiles.find(af => af.audioElement.src && !af.audioElement.paused);
      if (playingAudio) {
        currentTime = playingAudio.audioElement.currentTime;
      } else {
        // If paused, get currentTime from first loaded audio
        const loadedAudio = audioFiles.find(af => af.audioElement.src);
        if (loadedAudio) {
          currentTime = loadedAudio.audioElement.currentTime;
        }
      }
      
      const progress = Math.min(100, (currentTime / minDuration) * 100);
      progressIndicator.style.left = progress + '%';
      
      // Update time display
      const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
      };
      progressTime.textContent = `${formatTime(currentTime)} / ${formatTime(minDuration)}`;
    }
    
    function seekToPosition(event) {
      const rect = progressBarWrapper.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const percent = Math.max(0, Math.min(1, x / rect.width));
      const targetTime = percent * minDuration;
      
      // Seek all audio files to target time
      audioFiles.forEach(audioFile => {
        if (audioFile.audioElement.src) {
          audioFile.audioElement.currentTime = Math.min(targetTime, audioFile.audioElement.duration || Infinity);
        }
      });
      
      updateProgressBar();
    }
    
    progressBarWrapper.addEventListener('mousedown', (e) => {
      isDraggingProgress = true;
      seekToPosition(e);
    });
    
    document.addEventListener('mousemove', (e) => {
      if (isDraggingProgress) {
        seekToPosition(e);
      }
    });
    
    document.addEventListener('mouseup', () => {
      isDraggingProgress = false;
    });
    
    // Touch support
    progressBarWrapper.addEventListener('touchstart', (e) => {
      isDraggingProgress = true;
      seekToPosition(e.touches[0]);
      e.preventDefault();
    });
    
    document.addEventListener('touchmove', (e) => {
      if (isDraggingProgress) {
        seekToPosition(e.touches[0]);
        e.preventDefault();
      }
    });
    
    document.addEventListener('touchend', () => {
      isDraggingProgress = false;
    });
    
    // Redraw waveform on resize
    window.addEventListener('resize', () => {
      drawVolumeWaveform();
      updateProgressBar();
    });
    
    controlsContainer.appendChild(headerDiv);
    
    // Audio file management (up to 2 stereo files, each can split into 2 tracks = 4 tracks total)
    const audioFiles = []; // Array of {audioElement, splitCheckbox, leftTrack, rightTrack}
    const tracks = []; // Array of {analyser, source, dataArray, theta, phi, strength, channel}
    
    // Create audio elements for 2 audio files (no UI, just audio elements)
    for (let i = 0; i < 2; i++) {
      // Audio element (hidden, no controls)
      const audioElement = document.createElement('audio');
      audioElement.style.display = 'none';
      audioElement.preload = 'metadata';
      
      // Split stereo checkbox (hidden, controlled by config)
      const splitCheckbox = document.createElement('input');
      splitCheckbox.type = 'checkbox';
      splitCheckbox.id = `split-${i}`;
      splitCheckbox.style.display = 'none';
      
      audioFiles.push({
        audioElement,
        splitCheckbox,
        leftTrack: { thetaInput: null, phiInput: null }, // Positions from config only
        rightTrack: { thetaInput: null, phiInput: null },
        leftTrackIndex: i * 2,     // Track indices: 0,1 for file 0, 2,3 for file 1
        rightTrackIndex: i * 2 + 1,
        mediaElementSource: null  // Store MediaElementSource to avoid recreating
      });
    }
    
    // Initialize track objects (4 tracks total)
    for (let i = 0; i < maxTracks; i++) {
      tracks.push({
        analyser: null,
        source: null,
        dataArray: null,
        theta: Math.PI / 2,
        phi: 0,
        strength: 0,
        channel: null, // 'left' or 'right'
        audioFileIndex: null // Which audio file this track belongs to
      });
    }
    
    container.appendChild(controlsContainer);
    
    // Canvas container - responsive for mobile devices
    const canvasContainer = document.createElement('div');
    canvasContainer.style.width = '100%';
    canvasContainer.style.maxWidth = '800px';
    canvasContainer.style.margin = '0 auto';
    canvasContainer.style.position = 'relative';
    canvasContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
    canvasContainer.style.borderRadius = '8px';
    canvasContainer.style.padding = '1em';
    canvasContainer.style.boxSizing = 'border-box'; // Ensure padding is included in width
    canvasContainer.style.overflow = 'hidden'; // Prevent overflow on mobile
    
    container.appendChild(canvasContainer);
    canvasContainer.appendChild(renderer.domElement);
    
    // Ensure renderer canvas is responsive
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = 'auto';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.maxWidth = '100%';

    // Setup renderer
    function resizeRenderer() {
      // Get container width, accounting for padding and ensuring it doesn't exceed viewport
      const containerRect = canvasContainer.getBoundingClientRect();
      const padding = 32; // 1em * 2 (left + right) ≈ 32px
      const maxWidth = Math.min(containerRect.width - padding, window.innerWidth - padding);
      const width = Math.max(200, maxWidth); // Minimum width of 200px
      const height = Math.min(width * 0.9, 600); // Slightly taller for better view
      
      if (width > 0 && height > 0) {
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
    }
    // Initial render after a small delay to ensure container is ready
    setTimeout(() => {
      resizeRenderer();
      renderer.render(scene, camera); // Initial render
    }, 100);
    window.addEventListener('resize', resizeRenderer);

    // Camera position - orbit around sphere (closer for larger view)
    camera.position.set(0, 0, 2.2); // Closer camera = larger sphere
    const cameraTarget = new THREE.Vector3(0, 0, 0);

    // Create sphere mesh with faces and grid lines
    // Store original positions for directional deformation
    let sphereMesh = null; // The sphere mesh with faces
    let gridLines = []; // Store grid lines for structure
    let originalSpherePositions = null; // Store original positions of sphere vertices
    
    function createEquiangularSphere(radius, segments = gridSegments) {
      const gridGroup = new THREE.Group();
      
      // Create sphere mesh with faces
      const sphereGeometry = new THREE.SphereGeometry(radius, segments, segments);
      
      // Store original positions
      const positions = sphereGeometry.attributes.position;
      originalSpherePositions = new Float32Array(positions.array);
      
      // Initialize vertex colors and alpha (will be updated based on bulge height)
      const colors = [];
      const alphas = []; // Store alpha values for each vertex
      const color = new THREE.Color();
      const baseColor = getColorForHeight(0);
      color.setHex(baseColor);
      for (let i = 0; i < positions.count; i++) {
        colors.push(color.r, color.g, color.b);
        alphas.push(0); // Start fully transparent (no bulge = transparent)
      }
      sphereGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      sphereGeometry.setAttribute('alpha', new THREE.Float32BufferAttribute(alphas, 1));
      
      // Create custom shader material to support vertex alpha
      const sphereMaterial = new THREE.ShaderMaterial({
        vertexShader: `
          attribute vec3 color;
          attribute float alpha;
          varying vec3 vColor;
          varying float vAlpha;
          void main() {
            vColor = color;
            vAlpha = alpha;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          precision mediump float;
          varying vec3 vColor;
          varying float vAlpha;
          void main() {
            gl_FragColor = vec4(vColor, vAlpha);
            // Ensure proper depth handling for transparency
            if (vAlpha < 0.01) discard;
          }
        `,
        transparent: true,
        side: THREE.DoubleSide,
        vertexColors: false, // We're using custom attributes, not vertexColors
        depthWrite: false, // Disable depth write for proper transparency rendering
        depthTest: true // Enable depth test for proper occlusion
      });
      
      sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
      gridGroup.add(sphereMesh);
      
      // Create grid lines for structure (thinner, more transparent)
      const lineMaterial = new THREE.LineBasicMaterial({ 
        color: finalGridColor, 
        transparent: true, 
        opacity: gridLineOpacity, // Use configurable opacity
        linewidth: 1
      });
      
      // Longitude lines (vertical, from pole to pole)
      for (let i = 0; i <= segments; i++) {
        const phi = (i / segments) * Math.PI * 2;
        const points = [];
        for (let j = 0; j <= segments; j++) {
          const theta = (j / segments) * Math.PI;
          const x = radius * Math.sin(theta) * Math.cos(phi);
          const y = radius * Math.cos(theta);
          const z = radius * Math.sin(theta) * Math.sin(phi);
          points.push(new THREE.Vector3(x, y, z));
        }
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, lineMaterial);
        gridGroup.add(line);
        gridLines.push(line);
      }
      
      // Latitude lines (horizontal, parallel to equator)
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI;
        const y = radius * Math.cos(theta);
        const r = radius * Math.sin(theta);
        if (r > 0.01) { // Skip poles
          const points = [];
          for (let j = 0; j <= segments; j++) {
            const phi = (j / segments) * Math.PI * 2;
            const x = r * Math.cos(phi);
            const z = r * Math.sin(phi);
            points.push(new THREE.Vector3(x, y, z));
          }
          const geometry = new THREE.BufferGeometry().setFromPoints(points);
          const line = new THREE.Line(geometry, lineMaterial);
          gridGroup.add(line);
          gridLines.push(line);
        }
      }
      
      return { gridGroup, baseRadius: radius };
    }
    
    // Color mapping function: map bulge height (0-1) to color
    // Returns color as hex number
    // Always returns configured bulge color, transparency is controlled by alpha
    function getColorForHeight(height) {
      // Always return configured bulge color
      // Color can be set via bulgeColor parameter in options
      return bulgeColor;
    }

    // Refresh theme colors right before creating sphere to ensure correct initial colors
    // Force a fresh theme detection to ensure we get the correct theme on page load
    themeColors = getThemeColors();
    // If gridColor is not explicitly set, use theme-adaptive color
    if (gridColor === null) {
      finalGridColor = themeColors.grid;
    } else {
      finalGridColor = gridColor;
    }
    
    const { gridGroup, baseRadius: initialRadius } = createEquiangularSphere(baseRadius, gridSegments);
    scene.add(gridGroup);

    // Add ambient light for better visibility
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    // Orbit controls - camera rotates around sphere (sphere center stays fixed)
    let isDragging = false;
    let previousMouseX = 0;
    let previousMouseY = 0;
    const rotationSpeed = 0.005; // radians per pixel
    
    // Initial view angle (configurable via options)
    // Use forCamera=true to get correct camera coordinates
    const initialSpherical = azElToSpherical(initialAzimuth, initialElevation, true);
    
    // Spherical coordinates for camera
    let spherical = {
      radius: 2.2, // Closer to sphere for larger view
      theta: initialSpherical.theta, // horizontal angle (azimuth in xz plane)
      phi: initialSpherical.phi // vertical angle (polar from y-axis), 0 = top, PI/2 = horizontal, PI = bottom
    };
    
    // Target spherical coordinates (for smooth return to front view)
    let targetSpherical = { ...initialSpherical };
    let lastInteractionTime = Date.now();
    // autoReturnDelay and autoReturnSpeed are now configurable via options (with defaults above)
    const autoRotationSpeed = 0.002; // slow auto rotation speed (camera rotation)
    const sphereAutoRotationSpeed = 0.001; // slow sphere auto rotation (Earth rotation direction)
    
    function updateCameraPosition() {
      const x = spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
      const y = spherical.radius * Math.cos(spherical.phi);
      const z = spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
      camera.position.set(x, y, z);
      camera.lookAt(cameraTarget);
    }
    
    updateCameraPosition();

    renderer.domElement.style.cursor = 'grab';
    
    renderer.domElement.addEventListener('mousedown', (e) => {
      isDragging = true;
      previousMouseX = e.clientX;
      previousMouseY = e.clientY;
      renderer.domElement.style.cursor = 'grabbing';
      lastInteractionTime = Date.now();
    });

    renderer.domElement.addEventListener('mousemove', (e) => {
      if (isDragging) {
        const deltaX = e.clientX - previousMouseX;
        const deltaY = e.clientY - previousMouseY;
        
        // Rotate around Y axis (horizontal)
        spherical.theta -= deltaX * rotationSpeed;
        
        // Rotate around X axis (vertical) - limit phi to prevent flipping
        spherical.phi += deltaY * rotationSpeed;
        spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
        
        targetSpherical = { ...spherical };
        updateCameraPosition();
        
        previousMouseX = e.clientX;
        previousMouseY = e.clientY;
        lastInteractionTime = Date.now();
      }
    });

    renderer.domElement.addEventListener('mouseup', () => {
      isDragging = false;
      renderer.domElement.style.cursor = 'grab';
      lastInteractionTime = Date.now();
    });

    renderer.domElement.addEventListener('mouseleave', () => {
      isDragging = false;
      renderer.domElement.style.cursor = 'grab';
      lastInteractionTime = Date.now();
    });

    // Touch support for mobile devices
    let touchStartX = 0;
    let touchStartY = 0;
    renderer.domElement.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        isDragging = true;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        lastInteractionTime = Date.now();
        e.preventDefault();
      }
    });

    renderer.domElement.addEventListener('touchmove', (e) => {
      if (isDragging && e.touches.length === 1) {
        const deltaX = e.touches[0].clientX - touchStartX;
        const deltaY = e.touches[0].clientY - touchStartY;
        
        spherical.theta -= deltaX * rotationSpeed;
        spherical.phi += deltaY * rotationSpeed;
        spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
        
        targetSpherical = { ...spherical };
        updateCameraPosition();
        
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        lastInteractionTime = Date.now();
        e.preventDefault();
      }
    });

    renderer.domElement.addEventListener('touchend', (e) => {
      isDragging = false;
      lastInteractionTime = Date.now();
      e.preventDefault();
    });

    // Audio context and gain node for mixing
    let audioContext = null;
    let gainNode = null; // Master gain for mixing all tracks
    let animationId = null;

    function initAudioContext() {
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        gainNode = audioContext.createGain();
        gainNode.connect(audioContext.destination);
      }
    }

    // Handle audio file loading and connection
    function handleAudioFileChange(fileIndex) {
      const audioFile = audioFiles[fileIndex];
      if (!audioFile || !audioFile.audioElement.src) return;
      
      initAudioContext();
      if (!audioContext) return;
      
      // Resume audio context if suspended
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      // Disconnect existing sources for this file's tracks
      const leftTrack = tracks[audioFile.leftTrackIndex];
      const rightTrack = tracks[audioFile.rightTrackIndex];
      if (leftTrack && leftTrack.source) {
        leftTrack.source.disconnect();
        leftTrack.source = null;
      }
      if (rightTrack && rightTrack.source) {
        rightTrack.source.disconnect();
        rightTrack.source = null;
      }
      
      // Check if audio element already has a source node
      // A MediaElementSource can only be created once per audio element
      let source = audioFile.mediaElementSource;
      if (!source) {
        try {
          source = audioContext.createMediaElementSource(audioFile.audioElement);
          audioFile.mediaElementSource = source; // Store for reuse
        } catch (error) {
          // If source already exists, try to get it from the audio element
          // Note: There's no direct way to retrieve an existing source, so we need to track it
          console.warn('MediaElementSource may already exist for this audio element:', error);
          // If we can't create a new source, we can't proceed
          return;
        }
      }
      
      if (audioFile.splitCheckbox.checked) {
        // Split stereo into left and right channels
        const splitter = audioContext.createChannelSplitter(2);
        source.connect(splitter);
        
        // Left channel (channel 0)
        if (!leftTrack.analyser) {
          leftTrack.analyser = audioContext.createAnalyser();
          leftTrack.analyser.fftSize = 256;
          leftTrack.dataArray = new Uint8Array(leftTrack.analyser.frequencyBinCount);
        }
        const leftGain = audioContext.createGain();
        splitter.connect(leftGain, 0); // Connect left channel (index 0)
        leftGain.connect(leftTrack.analyser);
        leftGain.connect(gainNode);
        leftTrack.source = leftGain; // Store for cleanup
        leftTrack.channel = 'left';
        leftTrack.audioFileIndex = fileIndex;
        
        // Right channel (channel 1)
        if (!rightTrack.analyser) {
          rightTrack.analyser = audioContext.createAnalyser();
          rightTrack.analyser.fftSize = 256;
          rightTrack.dataArray = new Uint8Array(rightTrack.analyser.frequencyBinCount);
        }
        const rightGain = audioContext.createGain();
        splitter.connect(rightGain, 1); // Connect right channel (index 1)
        rightGain.connect(rightTrack.analyser);
        rightGain.connect(gainNode);
        rightTrack.source = rightGain; // Store for cleanup
        rightTrack.channel = 'right';
        rightTrack.audioFileIndex = fileIndex;
      } else {
        // Use as mono (connect to left track only)
        if (!leftTrack.analyser) {
          leftTrack.analyser = audioContext.createAnalyser();
          leftTrack.analyser.fftSize = 256;
          leftTrack.dataArray = new Uint8Array(leftTrack.analyser.frequencyBinCount);
        }
        source.connect(leftTrack.analyser);
        source.connect(gainNode);
        leftTrack.source = source;
        leftTrack.channel = null;
        leftTrack.audioFileIndex = fileIndex;
        
        // Disconnect right track
        if (rightTrack.analyser) {
          rightTrack.analyser = null;
          rightTrack.dataArray = null;
        }
      }
    }
    
    // No file input handling needed - only use defaultTracks from config
    
    // Global play/pause control
    let isPlaying = false;
    let minDuration = Infinity; // Track shortest duration
    
    function updateMinDuration() {
      minDuration = Infinity;
      audioFiles.forEach(audioFile => {
        if (audioFile.audioElement.src && audioFile.audioElement.duration) {
          minDuration = Math.min(minDuration, audioFile.audioElement.duration);
        }
      });
    }
    
    function syncPlayAll() {
      initAudioContext(); // Ensure context is initialized
      
      if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      updateMinDuration();
      
      // Connect all audio files first (only if not already connected)
      audioFiles.forEach((audioFile, fileIndex) => {
        if (audioFile.audioElement.src && !audioFile.mediaElementSource) {
          handleAudioFileChange(fileIndex);
        }
      });
      
      // Small delay to ensure connections are established
      setTimeout(() => {
        // Play all audio files simultaneously
        const playPromises = [];
        audioFiles.forEach(audioFile => {
          if (audioFile.audioElement.src) {
            // Reset to start
            audioFile.audioElement.currentTime = 0;
            const playPromise = audioFile.audioElement.play();
            if (playPromise) {
              playPromises.push(playPromise);
            }
          }
        });
        
        if (playPromises.length === 0) {
          console.warn('No audio files to play');
          return;
        }
        
        // Wait for all to start playing, then set up duration limit
        Promise.all(playPromises).then(() => {
          isPlaying = true;
          updatePlayButtonIcon(true);
          
          if (minDuration < Infinity && minDuration > 0) {
            // Set up timeout to stop all at shortest duration
            setTimeout(() => {
              audioFiles.forEach(audioFile => {
                if (audioFile.audioElement.src) {
                  audioFile.audioElement.pause();
                  audioFile.audioElement.currentTime = 0;
                }
              });
              isPlaying = false;
              updatePlayButtonIcon(false);
            }, minDuration * 1000);
          }
        }).catch(err => {
          console.error('Error playing audio:', err);
          isPlaying = false;
          updatePlayButtonIcon(false);
        });
      }, 100);
    }
    
    function syncPauseAll() {
      audioFiles.forEach(audioFile => {
        if (audioFile.audioElement.src) {
          audioFile.audioElement.pause();
        }
      });
      isPlaying = false;
      updatePlayButtonIcon(false);
    }
    
    globalPlayButton.addEventListener('click', () => {
      if (isPlaying) {
        syncPauseAll();
      } else {
        syncPlayAll();
      }
    });
    
    // Update button text when any audio ends
    audioFiles.forEach(audioFile => {
      audioFile.audioElement.addEventListener('ended', () => {
        // Check if all are paused/ended
        const allStopped = audioFiles.every(af => 
          !af.audioElement.src || af.audioElement.paused || af.audioElement.ended
        );
        if (allStopped) {
          isPlaying = false;
          updatePlayButtonIcon(false);
        }
      });
    });
    
    // Load default tracks (required - no upload support)
    // defaultTracks can be array of audio files, each can have left/right positions
    if (defaultTracks && defaultTracks.length > 0) {
      defaultTracks.forEach((defaultTrack, fileIndex) => {
        if (fileIndex < 2 && audioFiles[fileIndex]) {
          const audioFile = audioFiles[fileIndex];
          
          if (defaultTrack.url) {
            audioFile.audioElement.src = defaultTrack.url;
            audioFile.audioElement.addEventListener('loadedmetadata', async () => {
              updateMinDuration();
              updateProgressBar();
              
              // Extract waveform for this track
              const waveform = await extractWaveform(audioFile);
              if (waveform) {
                if (fileIndex === 0) {
                  waveformData.track1 = waveform;
                } else if (fileIndex === 1) {
                  waveformData.track2 = waveform;
                }
                // Redraw waveform
                drawVolumeWaveform();
              }
            });
          }
          
          // Check if stereo split is needed (if left/right positions are specified)
          const hasLeftPos = defaultTrack.left_position_az_el || defaultTrack.left_theta !== undefined;
          const hasRightPos = defaultTrack.right_position_az_el || defaultTrack.right_theta !== undefined;
          if (hasLeftPos || hasRightPos) {
            audioFile.splitCheckbox.checked = true;
          }
          
          // Set left track position
          const leftTrack = tracks[audioFile.leftTrackIndex];
          if (defaultTrack.left_position_az_el) {
            const spherical = parseAzElString(defaultTrack.left_position_az_el);
            if (spherical) {
              leftTrack.theta = spherical.theta;
              leftTrack.phi = spherical.phi;
            }
          } else if (defaultTrack.left_theta !== undefined || defaultTrack.left_phi !== undefined) {
            // left_theta and left_phi are in radians (for backward compatibility)
            // If you want to use degrees, use left_position_az_el instead
            if (defaultTrack.left_theta !== undefined) {
              leftTrack.theta = defaultTrack.left_theta;
            }
            if (defaultTrack.left_phi !== undefined) {
              leftTrack.phi = defaultTrack.left_phi;
            }
          } else if (defaultTrack.position_az_el) {
            // Fallback to single position for left
            const spherical = parseAzElString(defaultTrack.position_az_el);
            if (spherical) {
              leftTrack.theta = spherical.theta;
              leftTrack.phi = spherical.phi;
            }
          }
          
          // Set right track position
          const rightTrack = tracks[audioFile.rightTrackIndex];
          if (defaultTrack.right_position_az_el) {
            const spherical = parseAzElString(defaultTrack.right_position_az_el);
            if (spherical) {
              rightTrack.theta = spherical.theta;
              rightTrack.phi = spherical.phi;
            }
          } else if (defaultTrack.right_theta !== undefined || defaultTrack.right_phi !== undefined) {
            // right_theta and right_phi are in radians (for backward compatibility)
            // If you want to use degrees, use right_position_az_el instead
            if (defaultTrack.right_theta !== undefined) {
              rightTrack.theta = defaultTrack.right_theta;
            }
            if (defaultTrack.right_phi !== undefined) {
              rightTrack.phi = defaultTrack.right_phi;
            }
          }
        }
      });
    }
    
    // No legacy defaultAudio support - only use defaultTracks

    // Calculate angular distance between two points on sphere (in radians)
    function angularDistance(theta1, phi1, theta2, phi2) {
      // Using spherical law of cosines
      const cosDelta = Math.cos(theta1) * Math.cos(theta2) + 
                       Math.sin(theta1) * Math.sin(theta2) * Math.cos(phi2 - phi1);
      return Math.acos(Math.max(-1, Math.min(1, cosDelta)));
    }
    
    // Gaussian function for bulge shape
    function gaussian(x, sigma) {
      return Math.exp(-(x * x) / (2 * sigma * sigma));
    }
    
    // Update sphere mesh with Gaussian bulges based on track audio
    // Each track creates a Gaussian bulge at its specified position
    function updateSphereRadius() {
      if (!sphereMesh || !originalSpherePositions) return;

      // Update strength for each track based on its audio
      tracks.forEach(track => {
        // Check if track is active (has analyser and belongs to a playing audio file)
        const isActive = track.analyser && track.dataArray && track.audioFileIndex !== null;
        let trackIsPlaying = false;
        if (isActive && audioFiles[track.audioFileIndex]) {
          trackIsPlaying = !audioFiles[track.audioFileIndex].audioElement.paused;
        }
        
        if (isActive && trackIsPlaying) {
          track.analyser.getByteFrequencyData(track.dataArray);
          
          // Calculate average volume for this track
          let sum = 0;
          for (let i = 0; i < track.dataArray.length; i++) {
            sum += track.dataArray[i];
          }
          const avg = sum / track.dataArray.length;
          const normalized = avg / 255; // Normalize to 0-1
          
          // Smooth the strength changes for visual stability
          track.strength += (normalized - track.strength) * 0.15;
        } else {
          // Gradually fade out when paused or inactive
          track.strength *= 0.9;
        }
      });
      
      // Apply directional deformation to sphere mesh vertices
      const geometry = sphereMesh.geometry;
      const positions = geometry.attributes.position;
      const colors = geometry.attributes.color;
      const alphas = geometry.attributes.alpha;
      const positionArray = positions.array;
      const colorArray = colors.array;
      const alphaArray = alphas.array;
      
      // First pass: calculate all deformations and find maximum
      // Also track individual track contributions for color mixing
      const deformations = [];
      const trackContributions = []; // Store contribution from each track for each vertex
      let maxDeformation = 0;
      
      for (let i = 0; i < positionArray.length; i += 3) {
        const origX = originalSpherePositions[i];
        const origY = originalSpherePositions[i + 1];
        const origZ = originalSpherePositions[i + 2];
        
        // Normalize to get direction vector
        const length = Math.sqrt(origX * origX + origY * origY + origZ * origZ);
        const dirX = origX / length;
        const dirY = origY / length;
        const dirZ = origZ / length;
        
        // Convert vertex position to spherical coordinates
        const vertexTheta = Math.acos(Math.max(-1, Math.min(1, dirY))); // 0 to PI
        const vertexPhi = Math.atan2(dirZ, dirX); // -PI to PI, normalize to 0 to 2*PI
        const normalizedPhi = vertexPhi < 0 ? vertexPhi + 2 * Math.PI : vertexPhi;
        
        // Calculate Gaussian bulges for each active track
        let totalDeformation = 0;
        const contributions = []; // Store contribution from each track
        
        tracks.forEach((track, trackIdx) => {
          if (track.strength > 0.01) { // Only process tracks with significant audio
            // Calculate angular distance from vertex to track position
            const distance = angularDistance(vertexTheta, normalizedPhi, track.theta, track.phi);
            
            // Apply Gaussian function
            const gaussianValue = gaussian(distance, gaussianSigma);
            
            // Scale by track strength - max 20% radius increase at peak
            // gaussianValue is 0-1, track.strength is 0-1, so max deformation is 0.2
            const contribution = gaussianValue * track.strength * 0.2;
            totalDeformation += contribution;
            contributions[trackIdx] = contribution;
          } else {
            contributions[trackIdx] = 0;
          }
        });
        
        deformations.push(totalDeformation);
        trackContributions.push(contributions);
        maxDeformation = Math.max(maxDeformation, totalDeformation);
      }
      
      // Second pass: apply deformations and set colors/alpha using normalized values
      for (let i = 0; i < positionArray.length; i += 3) {
        const origX = originalSpherePositions[i];
        const origY = originalSpherePositions[i + 1];
        const origZ = originalSpherePositions[i + 2];
        const vertexIdx = i / 3;
        const totalDeformation = deformations[vertexIdx];
        const contributions = trackContributions[vertexIdx];
        
        // Apply base radius + total deformation
        const scale = 1 + totalDeformation;
        positionArray[i] = origX * scale;
        positionArray[i + 1] = origY * scale;
        positionArray[i + 2] = origZ * scale;
        
        // Normalize deformation to 0-1 range based on maximum deformation
        // If maxDeformation is 0, all vertices have no deformation (alpha = 0)
        const normalizedHeight = maxDeformation > 0 ? totalDeformation / maxDeformation : 0;
        
        // Calculate color based on track contributions
        // Mix colors from different stereo files based on their contribution ratios
        // Each stereo file (with left and right tracks) uses one color
        let finalColor = 0x000000;
        if (totalDeformation > 0) {
          // Get colors for each stereo file (audioFileIndex)
          // audioFileIndex 0 -> track1BulgeColor (桃红色)
          // audioFileIndex 1 -> track2BulgeColor (杰尼蓝)
          const fileColors = [
            track1BulgeColor, // First stereo file (tracks 0, 1)
            track2BulgeColor, // Second stereo file (tracks 2, 3)
            bulgeColor        // Fallback
          ];
          
          // Mix colors based on contribution ratios from each stereo file
          let r = 0, g = 0, b = 0;
          let totalContrib = 0;
          
          contributions.forEach((contrib, trackIdx) => {
            if (contrib > 0 && trackIdx < tracks.length) {
              const track = tracks[trackIdx];
              // Get audioFileIndex for this track (0 or 1 for stereo files)
              const audioFileIdx = track.audioFileIndex !== null ? track.audioFileIndex : 2;
              const color = fileColors[audioFileIdx] || bulgeColor;
              const weight = contrib / totalDeformation; // Normalize by total deformation
              r += ((color >> 16) & 0xff) * weight;
              g += ((color >> 8) & 0xff) * weight;
              b += (color & 0xff) * weight;
              totalContrib += weight;
            }
          });
          
          // Normalize if needed
          if (totalContrib > 0) {
            r = Math.round(r / totalContrib);
            g = Math.round(g / totalContrib);
            b = Math.round(b / totalContrib);
            finalColor = (r << 16) | (g << 8) | b;
          } else {
            finalColor = bulgeColor; // Fallback
          }
        } else {
          finalColor = bulgeColor; // No deformation, use default color
        }
        
        // Update vertex color
        const color = new THREE.Color(finalColor);
        colorArray[i] = color.r;
        colorArray[i + 1] = color.g;
        colorArray[i + 2] = color.b;
        
        // Update vertex alpha: 0 at no bulge, 1 at maximum bulge
        // Alpha is directly proportional to normalized height
        // Ensure minimum alpha for visibility even at low heights
        // Use a non-linear curve to make low values more visible: sqrt for smoother falloff
        const alpha = minBulgeAlpha + (1 - minBulgeAlpha) * Math.sqrt(normalizedHeight);
        alphaArray[vertexIdx] = alpha;
      }
      
      positions.needsUpdate = true;
      colors.needsUpdate = true;
      alphas.needsUpdate = true;
      
      // Also update grid lines positions to match sphere deformation
      updateGridLines();
    }
    
    // Update grid lines to match sphere deformation
    function updateGridLines() {
      if (!sphereMesh || gridLines.length === 0) return;
      
      const spherePositions = sphereMesh.geometry.attributes.position.array;
      const segments = gridSegments; // Use configurable grid segments
      
      // Update longitude lines
      let lineIdx = 0;
      for (let i = 0; i <= segments; i++) {
        const line = gridLines[lineIdx];
        const geometry = line.geometry;
        const positions = geometry.attributes.position;
        const positionArray = positions.array;
        
        for (let j = 0; j <= segments; j++) {
          // Find corresponding vertex in sphere mesh
          // SphereGeometry uses (widthSegments + 1) * (heightSegments + 1) vertices
          const vertexIdx = j * (segments + 1) + i;
          if (vertexIdx * 3 + 2 < spherePositions.length) {
            positionArray[j * 3] = spherePositions[vertexIdx * 3];
            positionArray[j * 3 + 1] = spherePositions[vertexIdx * 3 + 1];
            positionArray[j * 3 + 2] = spherePositions[vertexIdx * 3 + 2];
          }
        }
        positions.needsUpdate = true;
        lineIdx++;
      }
      
      // Update latitude lines
      for (let i = 0; i <= segments; i++) {
        const r = baseRadius * Math.sin((i / segments) * Math.PI);
        if (r > 0.01) { // Skip poles
          const line = gridLines[lineIdx];
          const geometry = line.geometry;
          const positions = geometry.attributes.position;
          const positionArray = positions.array;
          
          for (let j = 0; j <= segments; j++) {
            // Find corresponding vertex in sphere mesh
            const vertexIdx = i * (segments + 1) + j;
            if (vertexIdx * 3 + 2 < spherePositions.length) {
              positionArray[j * 3] = spherePositions[vertexIdx * 3];
              positionArray[j * 3 + 1] = spherePositions[vertexIdx * 3 + 1];
              positionArray[j * 3 + 2] = spherePositions[vertexIdx * 3 + 2];
            }
          }
          positions.needsUpdate = true;
          lineIdx++;
        }
      }
    }

    // Listen for theme changes and update colors
    function updateThemeColors() {
      const newThemeColors = getThemeColors();
      // Only update if gridColor was not explicitly set (use theme-adaptive color)
      if (gridColor === null) {
        // Update base grid color for grid lines
        gridLines.forEach(line => {
          line.material.color.setHex(newThemeColors.grid);
        });
        // Update sphere mesh base color (if no deformation)
        if (sphereMesh) {
          sphereMesh.material.color.setHex(newThemeColors.grid);
        }
        // Update themeColors for future use
        Object.assign(themeColors, newThemeColors);
        finalGridColor = newThemeColors.grid;
      }
    }
    
    // Call updateThemeColors once after a short delay to ensure theme is detected on page load
    // This handles cases where theme detection happens after initial render
    setTimeout(() => {
      updateThemeColors();
    }, 100);
    
    // Watch for theme changes
    const themeObserver = new MutationObserver(() => {
      updateThemeColors();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-mode']
    });
    
    // Also listen to prefers-color-scheme changes
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', updateThemeColors);
    }

    // Animation loop
    function animate() {
      animationId = requestAnimationFrame(animate);
      
      // Auto-return to initial view after idle period
      const timeSinceInteraction = Date.now() - lastInteractionTime;
      if (timeSinceInteraction > autoReturnDelay && !isDragging) {
        // Smoothly interpolate back to initial view
        const deltaTheta = initialSpherical.theta - spherical.theta;
        const deltaPhi = initialSpherical.phi - spherical.phi;
        
        // Handle theta wrap-around (shortest path)
        let thetaDiff = deltaTheta;
        if (Math.abs(thetaDiff) > Math.PI) {
          thetaDiff = thetaDiff > 0 ? thetaDiff - 2 * Math.PI : thetaDiff + 2 * Math.PI;
        }
        
        spherical.theta += thetaDiff * autoReturnSpeed;
        spherical.phi += deltaPhi * autoReturnSpeed;
        
        // Normalize theta
        while (spherical.theta < 0) spherical.theta += 2 * Math.PI;
        while (spherical.theta >= 2 * Math.PI) spherical.theta -= 2 * Math.PI;
        
        // Clamp phi
        spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
        
        targetSpherical = { ...spherical };
      }
      
      // Update camera position (allow user interaction to change it)
      updateCameraPosition();
      
      // Update grid lines with Gaussian bulges based on track audio
      updateSphereRadius();
      
      // Auto rotate sphere (Earth rotation direction - around Y axis)
      // This rotates the sphere itself, not the camera
      if (gridGroup) {
        gridGroup.rotation.y += sphereAutoRotationSpeed;
      }
      
      // Update progress bar (only if not dragging)
      if (!isDraggingProgress) {
        updateProgressBar();
      }
      
      // Gradually return to base shape when all audio files are paused
      const hasActiveTracks = audioFiles.some(audioFile => 
        audioFile.audioElement && !audioFile.audioElement.paused
      );
      if (!hasActiveTracks && sphereMesh && originalSpherePositions) {
        // Check if we need to reset sphere positions
        const geometry = sphereMesh.geometry;
        const positions = geometry.attributes.position;
        const colors = geometry.attributes.color;
        const alphas = geometry.attributes.alpha;
        const positionArray = positions.array;
        const colorArray = colors.array;
        const alphaArray = alphas.array;
        let needsReset = false;
        
        const baseColor = getColorForHeight(0);
        const color = new THREE.Color(baseColor);
        
        for (let i = 0; i < positionArray.length; i += 3) {
          const origX = originalSpherePositions[i];
          const origY = originalSpherePositions[i + 1];
          const origZ = originalSpherePositions[i + 2];
          const currX = positionArray[i];
          const currY = positionArray[i + 1];
          const currZ = positionArray[i + 2];
          
          const diffX = origX - currX;
          const diffY = origY - currY;
          const diffZ = origZ - currZ;
          
          if (Math.abs(diffX) > 0.001 || Math.abs(diffY) > 0.001 || Math.abs(diffZ) > 0.001) {
            positionArray[i] = currX + diffX * 0.1;
            positionArray[i + 1] = currY + diffY * 0.1;
            positionArray[i + 2] = currZ + diffZ * 0.1;
            // Reset color to base
            colorArray[i] = color.r;
            colorArray[i + 1] = color.g;
            colorArray[i + 2] = color.b;
            // Reset alpha to 0 (fully transparent)
            const alphaIdx = i / 3;
            alphaArray[alphaIdx] = 0;
            needsReset = true;
          }
        }
        
        if (needsReset) {
          positions.needsUpdate = true;
          colors.needsUpdate = true;
          alphas.needsUpdate = true;
          updateGridLines();
        }
      }
      
      renderer.render(scene, camera);
    }
    animate();

    // Cleanup function
    return {
      destroy: () => {
        if (animationId) {
          cancelAnimationFrame(animationId);
        }
        // Disconnect theme observer
        if (themeObserver) {
          themeObserver.disconnect();
        }
        // Disconnect all track sources
        tracks.forEach(track => {
          if (track.source) {
            track.source.disconnect();
          }
        });
        // Also disconnect audio file sources
        audioFiles.forEach(audioFile => {
          // Sources are already disconnected via tracks
        });
        if (audioContext) {
          audioContext.close();
        }
        renderer.dispose();
      }
    };
  }

  // Export to global scope
  window.initAmbisonicViewer = initAmbisonicViewer;
})();

