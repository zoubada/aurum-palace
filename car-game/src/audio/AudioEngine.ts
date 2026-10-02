import { loadJSON, saveJSON } from '../core/storage';

/**
 * Audio graph root (SPEC §10): one AudioContext, separate buses for engine, effects and music,
 * a gentle master compressor. Browsers only start audio after a user gesture, so the context
 * is created on the first key press / click (`unlock`).
 */

export interface VolumeSettings {
  master: number;
  engine: number;
  effects: number;
  music: number;
}

const DEFAULT_VOLUMES: VolumeSettings = { master: 0.8, engine: 0.9, effects: 0.8, music: 0.5 };

export class AudioEngine {
  ctx: BaseAudioContext | null = null;
  engineBus!: GainNode;
  effectsBus!: GainNode;
  musicBus!: GainNode;
  private master!: GainNode;
  private noise: AudioBuffer | null = null;
  volumes: VolumeSettings = loadJSON('volumes', DEFAULT_VOLUMES);
  private readonly listeners: Array<() => void> = [];

  constructor(listen = true) {
    if (!listen) return;
    const unlock = () => this.unlock();
    window.addEventListener('keydown', unlock);
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('touchstart', unlock);
  }

  /** An engine rendering into an OfflineAudioContext (sound previews, tests). */
  static offline(ctx: OfflineAudioContext): AudioEngine {
    const a = new AudioEngine(false);
    a.volumes = { master: 1, engine: 1, effects: 1, music: 0 };
    a.build(ctx);
    return a;
  }

  /** Final mix input (after the volume buses), for sends such as reverb returns. */
  get masterBus(): GainNode {
    return this.master;
  }

  get ready(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /** Run `fn` once audio is available (immediately if it already is). */
  onReady(fn: () => void): void {
    if (this.ctx) fn();
    else this.listeners.push(fn);
  }

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && this.ctx instanceof AudioContext) void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      this.build(new Ctor({ latencyHint: 'interactive' }));
    } catch {
      return;
    }
    for (const fn of this.listeners.splice(0)) fn();
  }

  private build(ctx: BaseAudioContext): void {
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 12;
    comp.ratio.value = 4;
    comp.attack.value = 0.005;
    comp.release.value = 0.2;
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.connect(comp);
    this.engineBus = ctx.createGain();
    this.effectsBus = ctx.createGain();
    this.musicBus = ctx.createGain();
    this.engineBus.connect(this.master);
    this.effectsBus.connect(this.master);
    this.musicBus.connect(this.master);
    this.applyVolumes();
  }

  setVolumes(v: VolumeSettings): void {
    this.volumes = { ...v };
    saveJSON('volumes', this.volumes);
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.volumes.master, t, 0.05);
    this.engineBus.gain.setTargetAtTime(this.volumes.engine, t, 0.05);
    this.effectsBus.gain.setTargetAtTime(this.volumes.effects, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.volumes.music, t, 0.05);
  }

  /** Mute everything while the game is paused (menus stay silent). */
  setPaused(paused: boolean): void {
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(paused ? 0 : this.volumes.master, this.ctx.currentTime, 0.08);
  }

  /** 2 s of white noise, shared by every noise-based sound. */
  noiseBuffer(): AudioBuffer {
    const ctx = this.ctx!;
    if (!this.noise) {
      const len = ctx.sampleRate * 2;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    return this.noise;
  }

  /** Looping noise source → filter → gain, started immediately. */
  noiseVoice(type: BiquadFilterType, freq: number, q: number, out: AudioNode): { filter: BiquadFilterNode; gain: GainNode; src: AudioBufferSourceNode } {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    src.loop = true;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(out);
    src.start(ctx.currentTime, Math.random() * 1.5);
    return { filter, gain, src };
  }

  /** One-shot filtered noise burst with an exponential decay (crackle, blow-off, impact). */
  burst(type: BiquadFilterType, freq: number, q: number, level: number, decay: number, out: AudioNode, delay = 0): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(level, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    src.connect(filter).connect(gain).connect(out);
    src.start(t, Math.random() * 1.5);
    src.stop(t + decay + 0.05);
  }
}
