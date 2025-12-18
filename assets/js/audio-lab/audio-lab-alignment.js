/* audio-lab-alignment.js
 * Audio alignment functions using energy envelope cross-correlation
 */

const AudioLabAlignment = (function() {
  'use strict';

  function monoFromBuffer(buf) {
    const ch = buf.numberOfChannels;
    const L = buf.length;
    if (ch === 1) return buf.getChannelData(0);
    const a = buf.getChannelData(0);
    const b = buf.getChannelData(1);
    const out = new Float32Array(L);
    for (let i = 0; i < L; i++) out[i] = 0.5 * (a[i] + b[i]);
    return out;
  }

  function envDownsample(x, sr, targetSr = 200) {
    const step = Math.max(1, Math.floor(sr / targetSr));
    const n = Math.floor(x.length / step);
    const y = new Float32Array(n);
    let acc = 0, k = 0;
    for (let i = 0; i < x.length; i++) {
      acc += Math.abs(x[i]);
      if ((i + 1) % step === 0) { y[k++] = acc / step; acc = 0; }
    }
    let m = 0;
    for (let i = 0; i < y.length; i++) m += y[i];
    m /= Math.max(1, y.length);
    for (let i = 0; i < y.length; i++) y[i] -= m;
    return { y, sr: sr / step };
  }

  function bestLagEnv(a, b, sr, maxLagSec = 1.5) {
    const maxLag = Math.floor(maxLagSec * sr);
    const norm = (v) => {
      let s = 0;
      for (let i = 0; i < v.length; i++) s += v[i] * v[i];
      return Math.sqrt(s) + 1e-8;
    };
    const na = norm(a), nb = norm(b);

    let bestLag = 0, best = -1e18;
    for (let lag = -maxLag; lag <= maxLag; lag++) {
      let sum = 0;
      const t0 = Math.max(0, -lag);
      const t1 = Math.min(a.length, b.length - lag);
      for (let t = t0; t < t1; t++) sum += a[t] * b[t + lag];
      sum = sum / (na * nb);
      if (sum > best) { best = sum; bestLag = lag; }
    }
    return { lagSamples: bestLag, score: best };
  }

  function estimateAlignment(aBuf, bBuf) {
    const MAX_LAG_SEC = 1.5;
    const xa = monoFromBuffer(aBuf);
    const xb = monoFromBuffer(bBuf);
    const ea = envDownsample(xa, aBuf.sampleRate, 200);
    const eb = envDownsample(xb, bBuf.sampleRate, 200);
    const r = bestLagEnv(ea.y, eb.y, ea.sr, MAX_LAG_SEC);
    return { lagSec: r.lagSamples / ea.sr, score: r.score };
  }

  return {
    monoFromBuffer,
    estimateAlignment
  };
})();

