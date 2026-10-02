import type { AudioEngine } from './AudioEngine';

/**
 * Track ambience (SPEC §10): distant city hum at night, rain on the road, and the tunnel's
 * reverberation — a convolution reverb fed by the engine and effects buses, faded in while the
 * camera is inside the tunnel. The impulse response is synthesised (decaying stereo noise with
 * a few early reflections off the walls), so there is no audio file to load.
 */
export class Ambience {
  private readonly ctx: BaseAudioContext;
  private readonly send: GainNode;
  private readonly wet: GainNode;
  private readonly convolver: ConvolverNode;
  private readonly bed: GainNode;
  private readonly hum: ReturnType<AudioEngine['noiseVoice']> | null;
  private readonly rain: ReturnType<AudioEngine['noiseVoice']> | null;
  private readonly rainHigh: ReturnType<AudioEngine['noiseVoice']> | null;
  private stopped = false;

  constructor(
    private readonly audio: AudioEngine,
    opts: { city: boolean; rain: boolean },
  ) {
    const ctx = audio.ctx!;
    this.ctx = ctx;
    // Reverb: buses → send → convolver → wet → master (not back into a bus: no feedback loop).
    this.send = ctx.createGain();
    this.send.gain.value = 0;
    this.convolver = ctx.createConvolver();
    this.convolver.buffer = tunnelImpulse(ctx);
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.9;
    audio.engineBus.connect(this.send);
    audio.effectsBus.connect(this.send);
    this.send.connect(this.convolver).connect(this.wet).connect(audio.masterBus);

    const t = ctx.currentTime;
    // Ambience goes straight to the master (scaled by the effects volume), outside the reverb send.
    this.bed = ctx.createGain();
    this.bed.gain.value = audio.volumes.effects;
    this.bed.connect(audio.masterBus);
    this.hum = opts.city ? audio.noiseVoice('lowpass', 260, 0.5, this.bed) : null;
    this.hum?.gain.gain.setTargetAtTime(0.05, t, 1);
    this.rain = opts.rain ? audio.noiseVoice('bandpass', 2600, 0.35, this.bed) : null;
    this.rain?.gain.gain.setTargetAtTime(0.11, t, 1);
    this.rainHigh = opts.rain ? audio.noiseVoice('highpass', 7000, 0.5, this.bed) : null;
    this.rainHigh?.gain.gain.setTargetAtTime(0.035, t, 1);
  }

  /** `enclosure` 0 = open air … 1 = inside the tunnel. */
  update(enclosure: number): void {
    if (this.stopped) return;
    const t = this.ctx.currentTime;
    this.send.gain.setTargetAtTime(enclosure * 0.32, t, 0.15);
    // Rain is muffled under the roof; the city hum fades too.
    this.rain?.gain.gain.setTargetAtTime(0.11 * (1 - enclosure * 0.85), t, 0.3);
    this.rainHigh?.gain.gain.setTargetAtTime(0.035 * (1 - enclosure), t, 0.3);
    this.hum?.gain.gain.setTargetAtTime(0.05 * (1 - enclosure * 0.6), t, 0.3);
    this.bed.gain.setTargetAtTime(this.audio.volumes.effects, t, 0.1);
  }

  dispose(): void {
    if (this.stopped) return;
    this.stopped = true;
    const t = this.ctx.currentTime;
    this.send.gain.setTargetAtTime(0, t, 0.05);
    for (const v of [this.hum, this.rain, this.rainHigh]) v?.gain.gain.setTargetAtTime(0, t, 0.05);
    setTimeout(() => {
      for (const v of [this.hum, this.rain, this.rainHigh]) v?.src.stop();
      try {
        this.audio.engineBus.disconnect(this.send);
        this.audio.effectsBus.disconnect(this.send);
      } catch {
        /* already disconnected */
      }
      this.wet.disconnect();
      this.bed.disconnect();
    }, 400);
  }
}

/** ~1.8 s stereo impulse: early reflections between the tunnel walls, then a dense tail. */
function tunnelImpulse(ctx: BaseAudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * 1.8);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / rate;
      d[i] = (Math.random() * 2 - 1) * Math.exp(-t * 3.4) * 0.5;
    }
    // Flutter echoes: walls ~13 m apart → ~38 ms round trips.
    for (let k = 1; k <= 8; k++) {
      const i = Math.floor((0.038 * k + ch * 0.004) * rate);
      if (i < len) d[i] += 0.6 * Math.exp(-k * 0.45) * (k % 2 ? 1 : -1);
    }
  }
  return buf;
}
