class AudioSynth {
  private ctx: AudioContext | null = null;
  private lastTickTime = 0;
  private lastSuccessTime = 0;
  private lastErrorTime = 0;
  private lastThinkTime = 0;

  public isMuted = false;

  private init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    this.ctx = new AudioContextClass();
  }

  unlock() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch((err) => console.warn('[AudioSynth] Failed to resume audio context:', err));
    }
  }

  playTick() {
    if (this.isMuted) return;
    const nowMs = Date.now();
    if (nowMs - this.lastTickTime < 60) return; // rate limit ticks
    this.lastTickTime = nowMs;

    this.unlock();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1100, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.025);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.03);
  }

  playSuccess() {
    if (this.isMuted) return;
    const nowMs = Date.now();
    if (nowMs - this.lastSuccessTime < 150) return; // rate limit successes
    this.lastSuccessTime = nowMs;

    this.unlock();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    const playNote = (freq: number, startTime: number, duration: number) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.05, startTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.01);
    };

    // Elegant ascending double-beep
    playNote(783.99, now, 0.12); // G5
    playNote(1046.50, now + 0.06, 0.2); // C6
  }

  playError() {
    if (this.isMuted) return;
    const nowMs = Date.now();
    if (nowMs - this.lastErrorTime < 200) return; // rate limit errors
    this.lastErrorTime = nowMs;

    this.unlock();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(140, now);
    osc1.frequency.linearRampToValueAtTime(110, now + 0.18);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(143, now);
    osc2.frequency.linearRampToValueAtTime(113, now + 0.18);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.02);
    gain.gain.linearRampToValueAtTime(0.05, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.2);
    osc2.stop(now + 0.2);
  }

  playStart() {
    if (this.isMuted) return;
    this.unlock();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const duration = 0.35;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + duration);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.06, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  playStop() {
    if (this.isMuted) return;
    this.unlock();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const duration = 0.4;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(165, now + duration);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.06, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  playThink() {
    if (this.isMuted) return;
    const nowMs = Date.now();
    if (nowMs - this.lastThinkTime < 80) return; // rate limit thinking sounds
    this.lastThinkTime = nowMs;

    this.unlock();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1600, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.012);

    gain.gain.setValueAtTime(0.015, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.012);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.015);
  }
}

export const audioSynth = new AudioSynth();
// Auto-unlock on common user interaction triggers
if (typeof window !== 'undefined') {
  const unlockHandler = () => {
    audioSynth.unlock();
    window.removeEventListener('click', unlockHandler);
    window.removeEventListener('keydown', unlockHandler);
    window.removeEventListener('touchstart', unlockHandler);
  };
  window.addEventListener('click', unlockHandler);
  window.addEventListener('keydown', unlockHandler);
  window.addEventListener('touchstart', unlockHandler);
}
