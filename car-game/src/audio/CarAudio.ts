import type { CarConfig, EngineSoundProfile } from '../cars/types';
import type { Vehicle } from '../physics/vehicle';
import type { EngineEventFrame } from '../cars/EngineEvents';
import { clamp } from '../physics/math';
import type { AudioEngine } from './AudioEngine';

/**
 * Synthesised car sound (SPEC §4 "Sons spécifiques", §10).
 *
 * Engine: a periodic wave at the engine-cycle frequency (rpm / 120 for a 4-stroke) whose
 * spectrum is built from the firing orders: strong harmonics at multiples of the cylinder
 * count, plus "in-between" orders that make uneven engines (5-cylinder, cross-plane V8) warble
 * and burble. Two spectra (on load / overrun) are cross-faded with the throttle, then saturated
 * and low-passed according to load. Layers: intake roar, turbo whistle and blow-off valve,
 * overrun crackles, rev-limiter stutter. Effects: tire squeal and scrub, wind, road rumble,
 * impacts, gear-shift clunk.
 *
 * Provisional: everything is synthesised. Recorded samples of each real engine can replace the
 * oscillators later without changing this interface.
 */

function rng(seed: number): () => number {
  let a = seed * 9301 + 49297;
  return () => {
    a = (a * 9301 + 49297) % 233280;
    return a / 233280;
  };
}

function engineWave(ctx: BaseAudioContext, p: EngineSoundProfile, onLoad: boolean): PeriodicWave {
  const H = 112;
  const real = new Float32Array(H + 1);
  const imag = new Float32Array(H + 1);
  const rand = rng(p.seed + (onLoad ? 0 : 101));
  const N = p.cylinders;
  for (let k = 1; k <= H; k++) {
    let a: number;
    if (k % N === 0) {
      // Firing orders and their harmonics: brightness sets how slowly they fall off.
      const m = k / N;
      a = 1 / Math.pow(m, onLoad ? 1.55 - p.brightness * 1.05 : 2.1 - p.brightness * 0.8);
    } else {
      // In-between orders: uneven firing, exhaust pulse interaction.
      a = p.roughness * 0.38 * (0.4 + rand()) * Math.exp(-k / (N * (onLoad ? 2.6 : 1.4)));
    }
    // Half orders: the 5-cylinder warble and the cross-plane V8 burble.
    if ((2 * k) % N === 0 && k % N !== 0) a += (p.roughness * 0.55) / Math.sqrt((2 * k) / N);
    if (k < N / 2) a *= 0.35; // keep sub-orders from booming
    const phase = rand() * Math.PI * 2;
    real[k] = a * Math.cos(phase);
    imag[k] = a * Math.sin(phase);
  }
  return ctx.createPeriodicWave(real, imag);
}

function saturationCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 1024;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
  }
  return curve;
}

export class CarAudio {
  private readonly ctx: BaseAudioContext;
  private readonly p: EngineSoundProfile;
  private readonly redline: number;
  private readonly out: GainNode;
  private readonly fx: GainNode;

  private oscOn: OscillatorNode;
  private oscOff: OscillatorNode;
  private gainOn: GainNode;
  private gainOff: GainNode;
  private engineFilter: BiquadFilterNode;
  private engineGain: GainNode;
  private limiterMod: GainNode;
  private limiterDepth: GainNode;
  private limiterLfo: OscillatorNode;
  private intake: ReturnType<AudioEngine['noiseVoice']>;
  private turboOsc: OscillatorNode;
  private turboGain: GainNode;
  private turboAir: ReturnType<AudioEngine['noiseVoice']>;
  private squeal: ReturnType<AudioEngine['noiseVoice']>;
  private squeal2: ReturnType<AudioEngine['noiseVoice']>;
  private scrub: ReturnType<AudioEngine['noiseVoice']>;
  private wind: ReturnType<AudioEngine['noiseVoice']>;
  private road: ReturnType<AudioEngine['noiseVoice']>;

  private jitter = 0;
  private interior = false;
  private stopped = false;

  /** Other cars: distance attenuation and stereo position, set by `setSpatial`. */
  private readonly spatialGain: GainNode | null = null;
  private readonly panner: StereoPannerNode | null = null;

  constructor(
    private readonly audio: AudioEngine,
    car: CarConfig,
    spatial = false,
  ) {
    const ctx = audio.ctx!;
    this.ctx = ctx;
    this.p = car.sound;
    this.redline = car.physics.engine.redlineRpm;
    const t = ctx.currentTime;

    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.gain.setTargetAtTime(1, t, 0.3);
    this.fx = ctx.createGain();
    if (spatial) {
      this.spatialGain = ctx.createGain();
      this.spatialGain.gain.value = 0;
      this.panner = ctx.createStereoPanner();
      this.out.connect(this.spatialGain);
      this.fx.connect(this.spatialGain);
      this.spatialGain.connect(this.panner).connect(audio.engineBus);
    } else {
      this.out.connect(audio.engineBus);
      this.fx.connect(audio.effectsBus);
    }

    // --- Engine core.
    this.oscOn = ctx.createOscillator();
    this.oscOn.setPeriodicWave(engineWave(ctx, this.p, true));
    this.oscOff = ctx.createOscillator();
    this.oscOff.setPeriodicWave(engineWave(ctx, this.p, false));
    this.gainOn = ctx.createGain();
    this.gainOff = ctx.createGain();
    const shaper = ctx.createWaveShaper();
    shaper.curve = saturationCurve(1.6 + this.p.roughness);
    shaper.oversample = '2x';
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.Q.value = 0.9;
    this.limiterMod = ctx.createGain();
    this.limiterDepth = ctx.createGain();
    this.limiterDepth.gain.value = 0;
    this.limiterLfo = ctx.createOscillator();
    this.limiterLfo.type = 'square';
    this.limiterLfo.frequency.value = 23;
    this.limiterLfo.connect(this.limiterDepth).connect(this.limiterMod.gain);
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.22;
    this.oscOn.connect(this.gainOn).connect(shaper);
    this.oscOff.connect(this.gainOff).connect(shaper);
    shaper.connect(this.engineFilter).connect(this.limiterMod).connect(this.engineGain).connect(this.out);

    // --- Intake roar and turbo.
    this.intake = audio.noiseVoice('bandpass', 400, 0.8, this.out);
    this.turboOsc = ctx.createOscillator();
    this.turboOsc.type = 'sine';
    this.turboGain = ctx.createGain();
    this.turboGain.gain.value = 0;
    this.turboOsc.connect(this.turboGain).connect(this.out);
    this.turboAir = audio.noiseVoice('bandpass', 3200, 2.5, this.out);

    // --- Tires, wind, road.
    this.squeal = audio.noiseVoice('bandpass', 750, 9, this.fx);
    this.squeal2 = audio.noiseVoice('bandpass', 1350, 12, this.fx);
    this.scrub = audio.noiseVoice('lowpass', 500, 0.7, this.fx);
    this.wind = audio.noiseVoice('lowpass', 800, 0.5, this.fx);
    this.road = audio.noiseVoice('lowpass', 130, 0.8, this.fx);

    for (const o of [this.oscOn, this.oscOff, this.limiterLfo, this.turboOsc]) o.start(t);
  }

  /** Level (0–1, from distance) and stereo position (−1 left … 1 right) of another car. */
  setSpatial(level: number, pan: number): void {
    if (!this.spatialGain || !this.panner) return;
    const t = this.ctx.currentTime;
    this.spatialGain.gain.setTargetAtTime(level, t, 0.05);
    this.panner.pan.setTargetAtTime(pan, t, 0.05);
  }

  setInterior(interior: boolean): void {
    this.interior = interior;
  }

  update(v: Vehicle, ev: EngineEventFrame): void {
    if (this.stopped) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const p = this.p;
    const rpm = Math.max(300, v.engineRpm);
    const rn = clamp(rpm / this.redline, 0, 1.2);
    const throttle = v.appliedThrottle;
    const maxT = v.cfg.engine.torqueCurve.reduce((m, [, nm]) => Math.max(m, nm), 0);
    const load = clamp(v.engineTorque / maxT, -0.3, 1);
    const speed = Math.hypot(v.u, v.v);
    const k = 0.03; // parameter smoothing time constant (s)

    // Small random rpm wander keeps the tone alive.
    this.jitter += (Math.random() - 0.5) * 0.002 - this.jitter * 0.1;
    const f0 = (rpm / 120) * (1 + this.jitter);
    this.oscOn.frequency.setTargetAtTime(f0, t, 0.01);
    this.oscOff.frequency.setTargetAtTime(f0, t, 0.01);

    const on = clamp(0.15 + Math.max(0, load) * 0.85, 0, 1);
    this.gainOn.gain.setTargetAtTime(on * (0.6 + rn * 0.5), t, k);
    this.gainOff.gain.setTargetAtTime((1 - on) * (0.5 + rn * 0.4), t, k);
    const open = this.interior ? 2200 + rn * 2200 : 3000 + rn * 6500 * (0.5 + p.brightness * 0.5);
    this.engineFilter.frequency.setTargetAtTime(open * (0.55 + 0.45 * on), t, k);
    this.engineGain.gain.setTargetAtTime((0.12 + 0.12 * rn + 0.08 * on) * (this.interior ? 0.8 : 1), t, k);
    this.limiterDepth.gain.setTargetAtTime(v.revLimiterOn ? 0.45 : 0, t, 0.01);

    // Intake: louder with throttle and rpm (and inside the cabin for mid/rear engines).
    this.intake.filter.frequency.setTargetAtTime(250 + rpm * 0.18, t, k);
    this.intake.gain.gain.setTargetAtTime(p.intake * throttle * rn * 0.09, t, k);

    // Turbo whistle and the blow-off valve when the throttle snaps shut.
    if (p.turbo > 0) {
      const boost = ev.boost;
      if (ev.blowOff > 0) {
        this.audio.burst('highpass', 2200, 0.7, p.turbo * 0.22 * ev.blowOff, 0.38, this.out);
        this.audio.burst('bandpass', 900, 3, p.turbo * 0.08 * ev.blowOff, 0.25, this.out, 0.03);
      }
      this.turboOsc.frequency.setTargetAtTime(1500 + boost * 5200, t, 0.08);
      this.turboGain.gain.setTargetAtTime(p.turbo * boost * 0.012, t, 0.05);
      this.turboAir.gain.gain.setTargetAtTime(p.turbo * boost * throttle * 0.035, t, 0.05);
    }

    // Backfires (overrun crackles, upshift bangs) and the gear-change clunk.
    for (let i = 0; i < ev.pops; i++) {
      this.audio.burst('bandpass', 250 + Math.random() * 900, 1.4, (0.18 + Math.random() * 0.35) * p.pops, 0.03 + Math.random() * 0.07, this.out, i * 0.04);
    }
    if (ev.gearChanged) this.audio.burst('bandpass', 2600, 2, 0.05, 0.04, this.fx);

    // Tires: squeal from combined slip beyond the peak, scrub from sliding speed.
    let squeal = 0;
    let scrub = 0;
    for (const w of v.wheels) {
      if (w.fz < 300) continue;
      squeal = Math.max(squeal, clamp((w.rho - 0.85) * 1.4, 0, 1));
      scrub = Math.max(scrub, clamp((w.slipSpeed - 1.5) / 10, 0, 1));
    }
    const moving = clamp(speed / 6, 0, 1);
    squeal *= moving;
    this.squeal.filter.frequency.setTargetAtTime(650 + squeal * 250, t, 0.05);
    this.squeal.gain.gain.setTargetAtTime(squeal * 0.16, t, 0.04);
    this.squeal2.gain.gain.setTargetAtTime(squeal * squeal * 0.08, t, 0.04);
    this.scrub.gain.gain.setTargetAtTime(scrub * 0.12 * moving, t, 0.05);

    // Wind and road rumble grow with speed (quieter inside the cabin).
    const cabin = this.interior ? 0.45 : 1;
    this.wind.filter.frequency.setTargetAtTime(500 + speed * 12, t, 0.2);
    this.wind.gain.gain.setTargetAtTime(Math.pow(speed / 80, 2) * 0.22 * cabin, t, 0.2);
    this.road.gain.gain.setTargetAtTime(clamp(speed / 50, 0, 1) * 0.12, t, 0.2);
  }

  /** Collision: low thump plus a crunch, scaled by closing speed (m/s). */
  impact(speed: number): void {
    if (this.stopped || speed < 1) return;
    const level = clamp(speed / 12, 0.1, 1);
    this.audio.burst('lowpass', 220, 0.8, level * 0.9, 0.35, this.fx);
    this.audio.burst('bandpass', 1800, 1, level * 0.35, 0.18, this.fx);
  }

  dispose(): void {
    if (this.stopped) return;
    this.stopped = true;
    const t = this.ctx.currentTime;
    this.out.gain.setTargetAtTime(0, t, 0.05);
    this.fx.gain.setTargetAtTime(0, t, 0.05);
    const nodes = [this.oscOn, this.oscOff, this.limiterLfo, this.turboOsc];
    const voices = [this.intake, this.turboAir, this.squeal, this.squeal2, this.scrub, this.wind, this.road];
    setTimeout(() => {
      for (const n of nodes) n.stop();
      for (const v of voices) v.src.stop();
      this.out.disconnect();
      this.fx.disconnect();
      this.spatialGain?.disconnect();
      this.panner?.disconnect();
    }, 400);
  }
}
