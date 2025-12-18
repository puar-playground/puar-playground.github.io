/* ab-test-ui.js
 * UI rendering and HTML generation
 */

const ABTestUI = (function() {
  'use strict';

  function generateHTML(allowUpload) {
    return `
    <style>
      .ab-wrap { 
        display: grid; 
        gap: 12px; 
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
      }
      .ab-card { 
        border: 1px solid rgba(0,0,0,.15); 
        border-radius: 12px; 
        padding: 12px;
        width: 100%;
        box-sizing: border-box;
      }
      .ab-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
      .file-input-group {
        display: flex;
        gap: 6px;
        align-items: flex-start;
      }
      .file-input-item {
        display: flex;
        flex-direction: row;
        gap: 8px;
        align-items: center;
      }
      .file-input-wrapper {
        position: relative;
      }
      .file-input-wrapper input[type="file"] {
        position: absolute;
        opacity: 0;
        width: 0;
        height: 0;
      }
      .file-input-button {
        display: inline-block;
        padding: 6px 10px;
        border-radius: 10px;
        border: 1px solid rgba(0,0,0,.2);
        background: rgba(0,0,0,.04);
        cursor: pointer;
        font-size: 0.85em;
        text-align: center;
        white-space: nowrap;
      }
      .file-input-button:hover {
        background: rgba(0,0,0,.08);
      }
      .small { font-size: 0.9em; opacity: 0.85; }
      button { padding: 8px 12px; border-radius: 10px; border: 1px solid rgba(0,0,0,.2); cursor: pointer; }
      button:disabled { opacity: 0.5; cursor: not-allowed; }
      .iconbtn {
        width: 44px; height: 44px;
        border-radius: 12px;
        border: 1px solid rgba(0,0,0,.2);
        background: rgba(0,0,0,.04);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        line-height: 1;
        cursor: pointer;
        user-select: none;
      }
      .iconbtn:disabled { opacity: 0.5; cursor: not-allowed; }
      .label { min-width: 50px; display:inline-block; }
      input[type="range"]{ vertical-align: middle; }
      .fileLabel { margin-top: 6px; }
      .waveforms-column {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-top: 16px;
      }
      .horizontal-slider-wrapper {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 16px;
      }
      .horizontal-slider-wrapper .mix-label {
        font-size: 0.85em;
        text-align: center;
        min-width: 60px;
        font-weight: bold;
      }
      .horizontal-slider-wrapper input[type="range"] {
        flex: 1;
        height: 8px;
      }
      .waveform-container {
        position: relative;
        border: 1px solid rgba(0,0,0,.1);
        border-radius: 8px;
        padding: 8px;
        background: rgba(0,0,0,.02);
      }
      .waveform-canvas {
        width: 100%;
        height: 50px;
        cursor: pointer;
        display: block;
        image-rendering: -webkit-optimize-contrast;
        image-rendering: crisp-edges;
      }
      .waveform-label {
        font-size: 0.85em;
        margin-bottom: 4px;
        opacity: 0.7;
      }
      .playhead {
        position: absolute;
        top: 4px;
        bottom: 4px;
        width: 2px;
        background:rgb(0, 0, 0);
        pointer-events: none;
        z-index: 10;
        transition: left 0.05s linear;
      }

      /* Mobile responsive styles */
      @media (max-width: 768px) {
        .ab-wrap {
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
        }
        .ab-card {
          padding: 8px;
          width: 100%;
          box-sizing: border-box;
        }
        .ab-row {
          gap: 6px;
          flex-wrap: wrap;
        }
        .file-input-group {
          flex-wrap: wrap;
          gap: 4px;
        }
        .file-input-item {
          flex-direction: column;
          gap: 4px;
          align-items: flex-start;
        }
        .file-input-button {
          padding: 6px 8px;
          font-size: 0.8em;
        }
        .fileLabel {
          font-size: 0.75em;
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .iconbtn {
          width: 40px;
          height: 40px;
          font-size: 16px;
        }
        .waveforms-column {
          gap: 8px;
          margin-top: 12px;
        }
        .waveform-container {
          padding: 6px;
        }
        .waveform-canvas {
          height: 45px;
        }
        .horizontal-slider-wrapper {
          gap: 8px;
          margin-top: 12px;
          flex-wrap: wrap;
        }
        .horizontal-slider-wrapper .mix-label {
          font-size: 0.75em;
          min-width: 50px;
        }
        .horizontal-slider-wrapper input[type="range"] {
          min-width: 100px;
          flex: 1 1 auto;
        }
      }

      @media (max-width: 480px) {
        .ab-card {
          padding: 6px;
        }
        .ab-row {
          gap: 4px;
        }
        .file-input-button {
          padding: 5px 6px;
          font-size: 0.75em;
        }
        .iconbtn {
          width: 36px;
          height: 36px;
          font-size: 14px;
        }
        .horizontal-slider-wrapper {
          gap: 6px;
        }
        .horizontal-slider-wrapper .mix-label {
          font-size: 0.7em;
          min-width: 45px;
        }
        .waveform-canvas {
          height: 40px;
        }
      }
    </style>

    <div class="ab-wrap">
      <div class="ab-card">
        <div class="ab-row" style="flex-wrap: nowrap; gap: 8px;">
          ${allowUpload ? `
          <div class="file-input-group">
            <div class="file-input-item">
              <label class="file-input-wrapper">
                <input id="fileA" type="file" accept="audio/*" />
                <span class="file-input-button">Choose File A</span>
              </label>
              <div class="small fileLabel" id="labelA" style="white-space: nowrap;"></div>
            </div>
            <div class="file-input-item">
              <label class="file-input-wrapper">
                <input id="fileB" type="file" accept="audio/*" />
                <span class="file-input-button">Choose File B</span>
              </label>
              <div class="small fileLabel" id="labelB" style="white-space: nowrap;"></div>
            </div>
          </div>
          ` : ''}
        </div>

        <div class="waveforms-column">
          <div class="waveform-container">
            <div style="position: relative;">
              <canvas id="waveformA" class="waveform-canvas"></canvas>
              <div id="playheadA" class="playhead" style="left: 0;"></div>
            </div>
          </div>

          <div class="waveform-container">
            <div style="position: relative;">
              <canvas id="waveformB" class="waveform-canvas"></canvas>
              <div id="playheadB" class="playhead" style="left: 0;"></div>
            </div>
          </div>
        </div>

        <div class="horizontal-slider-wrapper">
          <button id="btnPlay" class="iconbtn" disabled aria-label="Play/Pause" title="Play/Pause">▶︎</button>
          <button id="btnRestart" class="iconbtn" disabled aria-label="Restart" title="Restart">↺</button>
          <div class="small mix-label"><b id="mixLabelTop">A 100%</b></div>
          <input id="mix" type="range" min="0" max="100" value="0" />
          <div class="small mix-label"><b id="mixLabelBottom">B 0%</b></div>
        </div>
      </div>
    </div>
  `;
  }

  return {
    generateHTML
  };
})();

