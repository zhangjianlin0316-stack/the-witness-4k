export function createAudio() {
  let ctx = null;
  let master = null;
  let windGain = null;
  let waveGain = null;
  const volume = { value: 0.72 };

  function noiseBuffer(seconds, color) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      brown = (brown + 0.02 * white) / 1.02;
      data[i] = color === 'brown' ? brown * 3.2 : white;
    }
    return buffer;
  }

  function loopNoise(kind, freq, type, gainValue) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(2.5, kind);
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = 0.7;
    const gain = ctx.createGain();
    gain.gain.value = gainValue;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
    return { gain, filter };
  }

  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volume.value;
    master.connect(ctx.destination);
    const wind = loopNoise('white', 520, 'bandpass', 0.045);
    const waves = loopNoise('brown', 240, 'lowpass', 0.09);
    windGain = wind.gain;
    waveGain = waves.gain;
    const pad = ctx.createGain();
    pad.gain.value = 0.018;
    pad.connect(master);
    for (const freq of [174.6, 220, 261.6]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = freq === 174.6 ? 0.5 : 0.22;
      osc.connect(g);
      g.connect(pad);
      osc.start();
    }
  }

  function tone(freq, dur, type, gainValue, delay = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gainValue, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  return {
    resume() {
      try {
        ensure();
        if (ctx && ctx.state !== 'running') ctx.resume();
      } catch {
        /* autoplay or missing API */
      }
    },
    setVolume(v) {
      volume.value = v;
      if (master) master.gain.value = v;
    },
    update(time) {
      if (!windGain) return;
      windGain.gain.value = 0.035 + Math.sin(time * 0.17) * 0.012 + Math.sin(time * 0.05) * 0.008;
      waveGain.gain.value = 0.07 + Math.sin(time * 0.23) * 0.02;
    },
    step() {
      tone(520 + Math.random() * 80, 0.05, 'triangle', 0.03);
    },
    open() {
      tone(660, 0.12, 'sine', 0.05);
      tone(880, 0.16, 'sine', 0.03, 0.05);
    },
    fail() {
      tone(196, 0.22, 'sawtooth', 0.03);
      tone(164, 0.28, 'triangle', 0.04, 0.04);
    },
    success() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.28, 'sine', 0.06, i * 0.09));
    },
    door() {
      tone(392, 0.2, 'sine', 0.04);
      tone(523.25, 0.34, 'triangle', 0.04, 0.1);
    },
    ending() {
      [261.6, 329.6, 392, 523.25, 659.25].forEach((f, i) => tone(f, 0.7, 'sine', 0.05, i * 0.18));
    },
  };
}
