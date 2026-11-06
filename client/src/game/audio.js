/**
 * Âm thanh tổng hợp bằng WebAudio — không cần file âm thanh nào.
 * Gió, chim hót xa, tiếng chuông chùa, bước chân, tiếng lạy.
 */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = localStorage.getItem('ditu.sound') !== 'off';
    this.started = false;
    this.birdTimer = null;
    this.stepTimer = 0;
    this.ambienceGain = null;
  }

  ensure() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.75 : 0;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  start() {
    const ctx = this.ensure();
    if (!ctx || this.started) return;
    this.started = true;
    this.startWind();
    this.scheduleBirds();
  }

  setEnabled(on) {
    this.enabled = on;
    localStorage.setItem('ditu.sound', on ? 'on' : 'off');
    if (this.master && this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(on ? 0.75 : 0, this.ctx.currentTime + 0.4);
    }
    if (on) this.ensure();
  }

  noiseBuffer(seconds = 3, brown = true) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.2;
      } else {
        data[i] = white;
      }
    }
    return buffer;
  }

  startWind() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(6, true);
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    filter.Q.value = 0.7;

    const gain = ctx.createGain();
    gain.gain.value = 0.09;

    // LFO nhẹ cho gió thở
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 150;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start();
    this.ambienceGain = gain;

    // tiếng suối/gió cao hơn một chút
    const air = ctx.createBufferSource();
    air.buffer = this.noiseBuffer(5, false);
    air.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = 2200;
    hp.Q.value = 0.6;
    const airGain = ctx.createGain();
    airGain.gain.value = 0.012;
    air.connect(hp);
    hp.connect(airGain);
    airGain.connect(this.master);
    air.start();
  }

  scheduleBirds() {
    clearTimeout(this.birdTimer);
    const delay = 5000 + Math.random() * 12000;
    this.birdTimer = setTimeout(() => {
      if (this.enabled) this.bird();
      this.scheduleBirds();
    }, delay);
  }

  bird() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + Math.random() * 0.4;
    const notes = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < notes; i++) {
      const t = t0 + i * 0.13 + Math.random() * 0.04;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const base = 2100 + Math.random() * 900;
      osc.frequency.setValueAtTime(base, t);
      osc.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.3), t + 0.06);
      osc.frequency.exponentialRampToValueAtTime(base * 0.9, t + 0.12);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.018, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.2);
    }
  }

  bell(distance = 0) {
    const ctx = this.ensure();
    if (!ctx || !this.enabled) return;
    const t0 = ctx.currentTime + 0.02;
    const vol = Math.max(0.12, 0.55 - distance * 0.01);

    // thân chuông: vài họa âm lệch nhau, tắt rất chậm
    const partials = [
      [1, 0.5, 6.5],
      [2.02, 0.26, 5],
      [2.76, 0.16, 4],
      [4.07, 0.1, 3],
      [5.43, 0.06, 2.2],
    ];
    for (const [ratio, amp0, dur] of partials) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 132 * ratio;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(amp0 * vol, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.1);
    }

    // tiếng gõ đầu chuông
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer(0.2, false);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 900;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.18 * vol, t0);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
    noise.connect(filter);
    filter.connect(ng);
    ng.connect(this.master);
    noise.start(t0);
    noise.stop(t0 + 0.3);
  }

  bow() {
    const ctx = this.ensure();
    if (!ctx || !this.enabled) return;
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.5, true);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(900, t0);
    f.frequency.exponentialRampToValueAtTime(240, t0 + 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0, t0);
    g.gain.linearRampToValueAtTime(0.12, t0 + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t0);
    src.stop(t0 + 0.6);
  }

  incense() {
    const ctx = this.ensure();
    if (!ctx || !this.enabled) return;
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(1.4, false);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(1800, t0);
    f.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.06, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.2);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t0);
    src.stop(t0 + 1.3);
  }

  step() {
    const ctx = this.ensure();
    if (!ctx || !this.enabled) return;
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.12, true);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.05, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t0);
    src.stop(t0 + 0.15);
  }

  whoosh() {
    const ctx = this.ensure();
    if (!ctx || !this.enabled) return;
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(2.4, true);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(200, t0);
    f.frequency.exponentialRampToValueAtTime(1400, t0 + 1.0);
    f.frequency.exponentialRampToValueAtTime(300, t0 + 2.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.1, t0 + 0.9);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.3);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t0);
    src.stop(t0 + 2.4);
  }

  dispose() {
    clearTimeout(this.birdTimer);
    if (this.ctx) this.ctx.close().catch(() => {});
    this.ctx = null;
    this.started = false;
  }
}
