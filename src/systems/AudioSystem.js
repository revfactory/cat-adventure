/**
 * AudioSystem — Web Audio API 사운드 (효과음 프로시저럴 생성)
 */
export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.muted = false;
    this.volume = 0.5;
    this._initialized = false;
  }

  init() {
    if (this._initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);
      this._initialized = true;
    } catch (e) {
      console.warn('Web Audio API not available');
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
    }
  }

  // --- Procedural sound effects ---

  playJump() {
    this._playTone(440, 0.1, 'sine', { freqEnd: 880 });
  }

  playLand() {
    this._playNoise(0.05, 0.8);
  }

  playHurt() {
    this._playTone(200, 0.2, 'sawtooth', { freqEnd: 100 });
  }

  playCollect() {
    this._playTone(880, 0.08, 'sine');
    setTimeout(() => this._playTone(1100, 0.08, 'sine'), 80);
  }

  playRescue() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => this._playTone(freq, 0.15, 'sine'), i * 120);
    });
  }

  playStomp() {
    this._playTone(150, 0.1, 'square', { freqEnd: 80 });
  }

  playDeath() {
    this._playTone(400, 0.4, 'sawtooth', { freqEnd: 60 });
  }

  playBossHit() {
    this._playNoise(0.2, 1);
    this._playTone(100, 0.3, 'square', { freqEnd: 40 });
  }

  playMenuSelect() {
    this._playTone(660, 0.05, 'sine');
  }

  playStageClear() {
    const melody = [523, 659, 784, 1047, 784, 1047];
    melody.forEach((freq, i) => {
      setTimeout(() => this._playTone(freq, 0.2, 'sine'), i * 150);
    });
  }

  _playTone(freq, duration, type = 'sine', opts = {}) {
    if (!this.ctx || !this._initialized) return;
    this.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    if (opts.freqEnd) {
      osc.frequency.linearRampToValueAtTime(opts.freqEnd, this.ctx.currentTime + duration);
    }

    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + duration);
  }

  _playNoise(duration, volume = 0.5) {
    if (!this.ctx || !this._initialized) return;
    this.resume();

    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * volume;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume * 0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    source.connect(gain);
    gain.connect(this.masterGain);
    source.start();
  }
}
