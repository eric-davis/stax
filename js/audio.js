// BGM melody: note frequencies and durations (seconds) for a simple chiptune loop
const BGM_TEMPO = 140; // BPM
const B = 60 / BGM_TEMPO;  // one beat in seconds

// [freq, duration_beats] — 0 freq = rest
const BGM_MELODY = [
  [659.25,0.5],[523.25,0.5],[659.25,0.5],[783.99,0.5],
  [1046.5,1],  [783.99,0.5],[880,0.5],
  [987.77,0.5],[880,0.5],   [783.99,0.5],[659.25,0.5],
  [523.25,0.5],[440,0.5],   [523.25,0.5],[659.25,0.5],
  [880,1],     [0,1],
  [659.25,0.5],[523.25,0.5],[659.25,0.5],[783.99,0.5],
  [1046.5,0.5],[880,0.5],   [783.99,0.5],[659.25,0.5],
  [523.25,0.5],[440,0.5],   [659.25,0.5],[523.25,0.5],
  [440,2],     [0,0.5],
];

const BGM_BASS = [
  [130.81,1],[130.81,1],[164.81,1],[164.81,1],
  [174.61,1],[174.61,1],[164.81,1],[164.81,1],
  [130.81,1],[130.81,1],[164.81,1],[164.81,1],
  [110,1],   [110,1],   [130.81,1],[130.81,1],
];

const BGM_TEMPO_2 = 110;
const B2 = 60 / BGM_TEMPO_2;

// Dark foreboding theme — D minor/Phrygian, tritone tension
const BGM_MELODY_2 = [
  [587.33,0.5],[523.25,0.5],[466.16,0.5],[440,0.5],  // D5 C5 Bb4 A4
  [415.3,1],   [440,1],                               // Ab4(tritone) A4
  [587.33,0.5],[523.25,0.5],[466.16,0.5],[440,0.5],  // D5 C5 Bb4 A4
  [392,1],     [349.23,0.5],[329.63,0.5],             // G4 F4 E4
  [293.66,1.5],[0,0.5],                               // D4(long) rest
  [349.23,0.5],[392,0.5],  [415.3,0.5], [440,0.5],  // F4 G4 Ab4 A4
  [466.16,0.5],[523.25,0.5],[466.16,0.5],[440,0.5],  // Bb4 C5 Bb4 A4
  [415.3,1],   [587.33,0.5],[523.25,0.5],             // Ab4 D5 C5
  [466.16,2],  [0,0.5],                               // Bb4(long) rest
];

const BGM_BASS_2 = [
  [73.42,1],[73.42,1],[110,1],   [110,1],
  [116.54,1],[116.54,1],[87.31,1],[87.31,1],
  [73.42,1],[73.42,1],[98,1],    [98,1],
  [110,1],  [110,1],  [73.42,1], [73.42,1],
];

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.bgmActive = false;
    this.bgmGain = null;
    this.masterGain = null;
    this.bgmTimeouts = [];
    this._musicMuted = false;
    this._currentTrack = 1;
    this._level = 1;
  }

  _init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.7;
    this.masterGain.connect(this.ctx.destination);
    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = this._musicMuted ? 0 : 0.18;
    this.bgmGain.connect(this.masterGain);
  }

  toggleMuteMusic() {
    this._musicMuted = !this._musicMuted;
    if (this.bgmGain && this.ctx) {
      this.bgmGain.gain.setTargetAtTime(this._musicMuted ? 0 : 0.18, this.ctx.currentTime, 0.05);
    }
    return this._musicMuted;
  }

  isMusicMuted() { return this._musicMuted; }

  cycleTrack() {
    this._currentTrack = this._currentTrack === 1 ? 2 : 1;
    if (this.bgmActive) {
      this.bgmActive = false;
      this.bgmTimeouts.forEach(id => clearTimeout(id));
      this.bgmTimeouts = [];
      if (this.bgmGain && this.ctx) {
        this.bgmGain.disconnect();
        this.bgmGain = this.ctx.createGain();
        this.bgmGain.gain.value = this._musicMuted ? 0 : 0.18;
        this.bgmGain.connect(this.masterGain);
      }
      this.bgmActive = true;
      this._loopBGM();
    }
    return this._currentTrack;
  }

  getTrackName() { return this._currentTrack === 1 ? 'CLASSIC' : 'DARKNESS'; }

  setLevel(level) { this._level = level; }

  _resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  // --- SFX helpers ---

  _osc(freq, type, gain, dur, dest) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(gain, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
    o.connect(g);
    g.connect(dest || this.masterGain);
    o.start(this.ctx.currentTime);
    o.stop(this.ctx.currentTime + dur);
  }

  _noise(gain, dur) {
    const len = Math.ceil(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    src.buffer = buf;
    g.gain.setValueAtTime(gain, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
    src.connect(g);
    g.connect(this.masterGain);
    src.start(this.ctx.currentTime);
  }

  _sweep(f0, f1, type, gain, dur) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, this.ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(f1, this.ctx.currentTime + dur);
    g.gain.setValueAtTime(gain, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
    o.connect(g);
    g.connect(this.masterGain);
    o.start(this.ctx.currentTime);
    o.stop(this.ctx.currentTime + dur);
  }

  // --- Named sounds ---

  play(name) {
    this._init();
    this._resume();
    switch (name) {
      case 'move':
        this._noise(0.04, 0.02);
        break;
      case 'rotate':
        this._sweep(220, 440, 'sine', 0.1, 0.06);
        break;
      case 'softDrop':
        this._osc(100, 'sawtooth', 0.08, 0.07);
        break;
      case 'hardDrop':
        this._osc(60, 'sine', 0.25, 0.12);
        this._noise(0.15, 0.06);
        break;
      case 'lineClear':
        [523.25, 659.25, 783.99].forEach((f, i) =>
          setTimeout(() => { this._init(); this._osc(f, 'square', 0.1, 0.15); }, i * 60));
        break;
      case 'stax':
        [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) =>
          setTimeout(() => { this._init(); this._osc(f, 'square', 0.12, 0.18); }, i * 70));
        break;
      case 'tSpin':
        [440, 554.37, 659.25, 880, 1108.7].forEach((f, i) =>
          setTimeout(() => { this._init(); this._osc(f, 'sine', 0.1, 0.1); }, i * 40));
        break;
      case 'levelUp':
        [392, 494, 587, 698, 784, 988].forEach((f, i) =>
          setTimeout(() => { this._init(); this._osc(f, 'square', 0.12, 0.15); }, i * 70));
        break;
      case 'gameOver':
        [392, 370, 349, 330, 311, 294, 261].forEach((f, i) =>
          setTimeout(() => { this._init(); this._osc(f, 'sine', 0.15, 0.35); }, i * 180));
        break;
    }
  }

  // --- BGM ---

  startBGM() {
    if (this.bgmActive) return;
    this._init();
    this._resume();
    this.bgmActive = true;
    this._loopBGM();
  }

  _loopBGM() {
    if (!this.bgmActive) return;
    const now = this.ctx.currentTime;
    let t = now;

    const melody      = this._currentTrack === 2 ? BGM_MELODY_2 : BGM_MELODY;
    const bass        = this._currentTrack === 2 ? BGM_BASS_2   : BGM_BASS;
    const baseTempo = this._currentTrack === 2 ? BGM_TEMPO_2 : BGM_TEMPO;
    const tempoMultiplier = Math.min(2.0, 1 + (this._level - 1) * 0.05);
    const beatDur = (60 / baseTempo) / tempoMultiplier;
    const melOscType  = this._currentTrack === 2 ? 'triangle' : 'square';
    const bassOscType = this._currentTrack === 2 ? 'sine' : 'sawtooth';
    const bassGainV   = this._currentTrack === 2 ? 0.4 : 0.6;

    // Schedule melody
    for (const [freq, beats] of melody) {
      const dur = beats * beatDur;
      if (freq > 0) {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = melOscType;
        o.frequency.value = freq;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(1, t + 0.01);
        g.gain.setValueAtTime(1, t + dur - 0.04);
        g.gain.linearRampToValueAtTime(0, t + dur);
        o.connect(g);
        g.connect(this.bgmGain);
        o.start(t);
        o.stop(t + dur);
      }
      t += dur;
    }

    const melodyDur = melody.reduce((s, [, b]) => s + b * beatDur, 0);

    // Schedule bass (repeat to match melody length)
    let bassT = now;
    let bi = 0;
    while (bassT < now + melodyDur) {
      const [freq, beats] = bass[bi % bass.length];
      const dur = Math.min(beats * beatDur, now + melodyDur - bassT);
      if (freq > 0 && dur > 0) {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = bassOscType;
        o.frequency.value = freq;
        g.gain.setValueAtTime(bassGainV, bassT);
        g.gain.exponentialRampToValueAtTime(0.0001, bassT + dur);
        o.connect(g);
        g.connect(this.bgmGain);
        o.start(bassT);
        o.stop(bassT + dur);
      }
      bassT += beats * beatDur;
      bi++;
    }

    const id = setTimeout(() => this._loopBGM(), melodyDur * 1000 - 200);
    this.bgmTimeouts.push(id);
  }

  stopBGM() {
    this.bgmActive = false;
    this.bgmTimeouts.forEach(id => clearTimeout(id));
    this.bgmTimeouts = [];
    if (this.bgmGain) {
      this.bgmGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      // Recreate gain node for next startBGM
      setTimeout(() => {
        if (!this.bgmActive && this.ctx) {
          this.bgmGain.disconnect();
          this.bgmGain = this.ctx.createGain();
          this.bgmGain.gain.value = this._musicMuted ? 0 : 0.18;
          this.bgmGain.connect(this.masterGain);
        }
      }, 500);
    }
  }

  pauseBGM() {
    if (this.ctx) this.ctx.suspend();
  }

  resumeBGM() {
    if (this.ctx) this.ctx.resume();
  }
}
