import type { WeaponSoundProfile } from './weaponManifest';

type BrowserWindowWithAudioContext = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

export class WeaponAudio {
  private audioContext: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  play(profile: WeaponSoundProfile): void {
    const context = this.getAudioContext();
    const now = context.currentTime;

    switch (profile) {
      case 'sidearm':
        this.playToneBurst(context, now, 420, 0.09, 0.18, 0.03);
        this.playNoiseBurst(context, now, 0.055, 0.04);
        break;
      case 'scatter':
        this.playToneBurst(context, now, 180, 0.15, 0.24, 0.06);
        this.playToneBurst(context, now + 0.018, 95, 0.11, 0.16, 0.08);
        this.playNoiseBurst(context, now, 0.13, 0.11);
        break;
      case 'heavy':
        this.playToneBurst(context, now, 250, 0.16, 0.22, 0.055);
        this.playToneBurst(context, now + 0.025, 120, 0.13, 0.2, 0.07);
        this.playNoiseBurst(context, now, 0.085, 0.06);
        break;
    }
  }

  dispose(): void {
    if (this.audioContext?.state !== 'closed') {
      void this.audioContext?.close();
    }
    this.audioContext = null;
    this.noiseBuffer = null;
  }

  private getAudioContext(): AudioContext {
    if (this.audioContext) {
      if (this.audioContext.state === 'suspended') {
        void this.audioContext.resume();
      }
      return this.audioContext;
    }

    const AudioContextCtor = window.AudioContext ?? (window as BrowserWindowWithAudioContext).webkitAudioContext;
    this.audioContext = new AudioContextCtor();
    return this.audioContext;
  }

  private playToneBurst(
    context: AudioContext,
    startTime: number,
    frequency: number,
    duration: number,
    gainValue: number,
    detuneAmount: number,
  ): void {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(frequency, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(35, frequency * detuneAmount), startTime + duration);
    gain.gain.setValueAtTime(gainValue, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.02);
  }

  private playNoiseBurst(context: AudioContext, startTime: number, duration: number, gainValue: number): void {
    const source = context.createBufferSource();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    source.buffer = this.getNoiseBuffer(context);
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(980, startTime);
    filter.Q.setValueAtTime(0.85, startTime);
    gain.gain.setValueAtTime(gainValue, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    source.start(startTime);
    source.stop(startTime + duration + 0.02);
  }

  private getNoiseBuffer(context: AudioContext): AudioBuffer {
    if (this.noiseBuffer) {
      return this.noiseBuffer;
    }

    const frameCount = Math.floor(context.sampleRate * 0.18);
    this.noiseBuffer = context.createBuffer(1, frameCount, context.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let index = 0; index < frameCount; index++) {
      data[index] = Math.random() * 2 - 1;
    }

    return this.noiseBuffer;
  }
}
