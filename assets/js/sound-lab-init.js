/* sound-lab-init.js
 * Unified initialization script for Sound Lab modules
 * Loads all dependencies and initializes Ambisonic Viewer and AB Test
 */

(function() {
  'use strict';
  
  // Get configuration from script data attributes (set by Jekyll template)
  const initScript = document.querySelector('script[data-vocals-url]');
  const getDataAttr = (attr, fallback) => {
    return initScript?.dataset[attr] || fallback;
  };
  
  // Configuration
  const config = {
    ambisonicViewer: {
      containerId: 'ambisonicViewer',
      defaultTracks: [
        {
          url: getDataAttr('vocalsUrl', '/assets/audio/atmos_night/vocals.mp3'),
          left_position_az_el: '(-90.0, 10.0)',
          right_position_az_el: '(90.0, -10.0)'
        },
        {
          url: getDataAttr('instrumentalUrl', '/assets/audio/atmos_night/instrumental.mp3'),
          left_position_az_el: '(45.0, -20.0)',
          right_position_az_el: '(-45.0, 20.0)'
        }
      ],
      sphereColor: 0xcccccc,
      track1BulgeColor: 0xff6b9d,
      track2BulgeColor: 0xb9cce2,
      gridColor: 0xcccccc,
      baseRadius: 1.0,
      maxRadiusMultiplier: 1.2,
      gaussianSigma: 0.3,
      gridSegments: 32,
      initialAzimuth: 0.0,
      initialElevation: -30.0
    },
    abTest: {
      rootId: 'abRoot',
      defaultAudioA: getDataAttr('audioAUrl', '/assets/audio/Hello.mp3'),
      defaultAudioB: getDataAttr('audioBUrl', '/assets/audio/Hello_enhanced.mp3'),
      allowUpload: true,
      waveformColorA: '#FF2600',
      waveformColorB: '#659BC8'
    }
  };
  
  // Load script dynamically
  function loadScript(src, callback) {
    const script = document.createElement('script');
    script.src = src;
    script.onload = callback;
    script.onerror = function() {
      console.error('Failed to load script:', src);
      if (callback) callback();
    };
    document.head.appendChild(script);
  }
  
  // Initialize Ambisonic Viewer
  function initAmbisonicViewer() {
    if (typeof THREE === 'undefined' || typeof window.initAmbisonicViewer === 'undefined') {
      return false;
    }
    
    const viewer = document.getElementById(config.ambisonicViewer.containerId);
    if (!viewer) {
      return false;
    }
    
    try {
      window.initAmbisonicViewer(config.ambisonicViewer.containerId, config.ambisonicViewer);
      return true;
    } catch (error) {
      console.error('AmbisonicViewer: Initialization error:', error);
      return false;
    }
  }
  
  // Initialize AB Test
  function initABTestModule() {
    if (typeof initABTest === 'undefined') {
      return false;
    }
    
    const root = document.getElementById(config.abTest.rootId);
    if (!root) {
      return false;
    }
    
    try {
      root.dataset.initialized = 'true';
      initABTest(config.abTest);
      return true;
    } catch (error) {
      console.error('ABTest: Initialization error:', error);
      return false;
    }
  }
  
  // Try to initialize a module with retries
  function tryInit(initFn, maxRetries = 10) {
    let retryCount = 0;
    const retryInterval = setInterval(() => {
      retryCount++;
      if (initFn() || retryCount >= maxRetries) {
        clearInterval(retryInterval);
        if (retryCount >= maxRetries) {
          console.error('Failed to initialize after multiple retries');
        }
      }
    }, 100);
  }
  
  // Main initialization
  function init() {
    // Load Three.js first (required for Ambisonic Viewer)
    if (typeof THREE === 'undefined') {
      loadScript('https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.min.js', function() {
        // After Three.js loads, load ambisonic-viewer.js
        loadScript('/assets/js/audio-lab/ambisonic-viewer.js', function() {
          tryInit(initAmbisonicViewer);
        });
      });
    } else {
      // Three.js already loaded
      if (typeof window.initAmbisonicViewer === 'undefined') {
        loadScript('/assets/js/audio-lab/ambisonic-viewer.js', function() {
          tryInit(initAmbisonicViewer);
        });
      } else {
        tryInit(initAmbisonicViewer);
      }
    }
    
    // Load AB Test dependencies in order
    const abTestScripts = [
      '/assets/js/ab-test/ab-test-alignment.js',
      '/assets/js/ab-test/ab-test-waveforms.js',
      '/assets/js/ab-test/ab-test-ui.js',
      '/assets/js/ab-test/ab-test.js'
    ];
    
    let currentScript = 0;
    function loadNextABTestScript() {
      if (currentScript >= abTestScripts.length) {
        // All scripts loaded, initialize AB Test
        tryInit(initABTestModule);
        return;
      }
      
      loadScript(abTestScripts[currentScript], function() {
        currentScript++;
        loadNextABTestScript();
      });
    }
    
    loadNextABTestScript();
  }
  
  // Start initialization when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 50);
  }
})();

