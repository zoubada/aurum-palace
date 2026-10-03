import type { TireParams } from '../physics/tire';
import type { CarPhysicsConfig, CarVisualConfig } from './types';

/** Helpers to write car configs from published specs instead of raw model parameters. */

/** Tire from its rolling radius and grip level. Defaults describe a modern summer UHP tire. */
export function tire(radius: number, mu: number, opts: Partial<TireParams> = {}): TireParams {
  return {
    radius,
    inertia: 1.2 + (radius - 0.3) * 6,
    mu,
    loadSensitivity: 0.12,
    nominalLoad: 4000,
    peakSlipRatio: 0.11,
    peakSlipAngle: 0.12,
    shapeC: 1.4,
    relaxationLength: 0.35,
    rollingResistance: 0.012,
    muLongScale: 1.2,
    ...opts,
  };
}

/** Semi-slick track tire (Michelin Cup 2 R, Pirelli Trofeo R…): more grip, sharper peak, smaller drop. */
export function trackTire(radius: number, mu: number, opts: Partial<TireParams> = {}): TireParams {
  return tire(radius, mu, { peakSlipRatio: 0.1, peakSlipAngle: 0.1, shapeC: 1.3, loadSensitivity: 0.14, muLongScale: 1.15, ...opts });
}

/** Tire radius from its size marking, e.g. tireRadius(265, 30, 19). */
export function tireRadius(widthMm: number, aspect: number, rimInch: number): number {
  return (rimInch * 25.4) / 2000 + (widthMm * aspect) / 100000;
}

/** Yaw inertia estimate: Iz ≈ k·m·a·b (k ≈ 1.05 front-engine, 0.95 mid-engine). */
export function yawInertia(mass: number, wheelbase: number, frontWeightFraction: number, k = 1.05): number {
  const b = frontWeightFraction * wheelbase;
  const a = wheelbase - b;
  return k * mass * a * b;
}

/** Bumper positions relative to the CG from the overhangs measured from each axle. */
export function overhangsFromCg(
  physics: Pick<CarPhysicsConfig, 'wheelbase' | 'frontWeightFraction'>,
  frontOverhang: number,
  rearOverhang: number,
): Pick<CarVisualConfig, 'frontOverhangFromCg' | 'rearOverhangFromCg'> {
  const b = physics.frontWeightFraction * physics.wheelbase;
  const a = physics.wheelbase - b;
  return { frontOverhangFromCg: a + frontOverhang, rearOverhangFromCg: b + rearOverhang };
}

/** Torque (N·m) delivering a given power (kW) at a given rpm. */
export function torqueAt(powerKw: number, rpm: number): number {
  return (powerKw * 1000) / ((rpm * Math.PI) / 30);
}

/** Mass used by the simulation: EU kerb weight (DIN) + 75 kg driver, as in official acceleration tests. */
export function withDriver(kerbKg: number): number {
  return kerbKg + 75;
}
