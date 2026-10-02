import type { CarPhysicsConfig } from '../cars/types';
import { ASSIST_PRESETS, Vehicle, type DriveInput } from './vehicle';

/**
 * Standard performance measurements on a flat, dry surface (SPEC §11).
 * Pure functions with no rendering: used by the unit tests and the garage spec sheet.
 */

const DT = 1 / 240;
const input = (p: Partial<DriveInput>): DriveInput => ({ throttle: 0, brake: 0, steer: 0, handbrake: 0, ...p });

function makeVehicle(cfg: CarPhysicsConfig): Vehicle {
  const v = new Vehicle(cfg);
  // Factory launch-control conditions: traction control and automatic shifting active.
  v.assists = { ...ASSIST_PRESETS.intermediate };
  return v;
}

export interface BenchmarkResult {
  zeroTo100: number;
  zeroTo200: number;
  topSpeedKmh: number;
  braking100to0: number;
}

export function zeroTo(cfg: CarPhysicsConfig, kmh: number, maxT = 60): number {
  const v = makeVehicle(cfg);
  let t = 0;
  while (v.speedKmh < kmh && t < maxT) {
    v.step(DT, input({ throttle: 1 }));
    t += DT;
  }
  return t;
}

/** Top speed: full throttle until the speed stops rising (aero, power or electronic limit). */
export function topSpeed(cfg: CarPhysicsConfig, maxT = 240): number {
  const v = makeVehicle(cfg);
  let t = 0;
  let last = 0;
  while (t < maxT) {
    for (let i = 0; i < 5 * 240; i++) v.step(DT, input({ throttle: 1 }));
    t += 5;
    if (t > 20 && v.speedKmh - last < 0.2) break;
    last = v.speedKmh;
  }
  return v.speedKmh;
}

/** 100–0 km/h stopping distance with ABS (m). */
export function braking100(cfg: CarPhysicsConfig): number {
  const v = makeVehicle(cfg);
  while (v.speedKmh < 100) v.step(DT, input({ throttle: 1 }));
  const x0 = v.x;
  const z0 = v.z;
  let t = 0;
  while (v.u > 0.1 && t < 15) {
    v.step(DT, input({ brake: 1 }));
    t += DT;
  }
  return Math.hypot(v.x - x0, v.z - z0);
}

export function runBenchmark(cfg: CarPhysicsConfig): BenchmarkResult {
  return {
    zeroTo100: zeroTo(cfg, 100),
    zeroTo200: zeroTo(cfg, 200),
    topSpeedKmh: topSpeed(cfg),
    braking100to0: braking100(cfg),
  };
}
