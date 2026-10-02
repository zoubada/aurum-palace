import { describe, expect, it } from 'vitest';
import { CARS } from '../src/cars/registry';
import { braking100, topSpeed, zeroTo } from '../src/physics/benchmark';
import { ASSIST_PRESETS, Vehicle } from '../src/physics/vehicle';
import { G } from '../src/physics/math';

/**
 * Every car against its official figures (SPEC §11). Tolerances: ±0.3 s on 0–100 km/h,
 * ±3 % on top speed. Times are measured with launch control conditions (TC + auto shifts).
 */
const DT = 1 / 240;

describe.each(CARS.map((c) => [c.name, c] as const))('%s', (_name, car) => {
  const p = car.physics;
  const ref = car.reference;

  it('engine curve matches the published power and torque', () => {
    let maxT = 0;
    let maxP = 0;
    for (let rpm = p.engine.idleRpm; rpm <= p.engine.redlineRpm; rpm += 50) {
      const t = p.engine.torqueCurve.reduce((acc, [r, nm], i, arr) => {
        if (i === 0) return acc;
        const [r0, nm0] = arr[i - 1];
        return rpm >= r0 && rpm <= r ? nm0 + ((nm - nm0) * (rpm - r0)) / (r - r0) : acc;
      }, 0);
      maxT = Math.max(maxT, t);
      maxP = Math.max(maxP, (t * rpm * Math.PI) / 30 / 1000);
    }
    expect(maxT).toBeCloseTo(ref.torqueNm, -1);
    // Published "ch/PS/hp" figures: within 3 % of the curve's peak power.
    const refKw = ref.powerHp * 0.7355;
    expect(Math.abs(maxP - refKw) / refKw).toBeLessThan(0.03);
  });

  it(`0–100 km/h in ${ref.zeroTo100} s (±0.3)`, () => {
    const t = zeroTo(p, 100);
    console.log(`${car.name}: 0-100 ${t.toFixed(2)} s (officiel ${ref.zeroTo100} s)`);
    expect(Math.abs(t - ref.zeroTo100)).toBeLessThanOrEqual(0.3);
  });

  it(`top speed ${ref.topSpeedKmh} km/h (±3 %)`, () => {
    const v = topSpeed(p);
    console.log(`${car.name}: vmax ${v.toFixed(0)} km/h (officiel ${ref.topSpeedKmh})`);
    expect(Math.abs(v - ref.topSpeedKmh) / ref.topSpeedKmh).toBeLessThanOrEqual(0.03);
  });

  it('brakes 100–0 km/h in a realistic distance', () => {
    const d = braking100(p);
    expect(d).toBeGreaterThan(26);
    expect(d).toBeLessThan(38);
  });

  it('holds a steady corner and stays stable through a lane change', () => {
    const v = new Vehicle(p);
    v.assists = { ...ASSIST_PRESETS.arcade };
    while (v.speedKmh < 110) v.step(DT, { throttle: 1, brake: 0, steer: 0, handbrake: 0 });
    for (let t = 0; t < 4; t += DT) {
      const steer = t < 0.6 ? 0.6 : t < 1.4 ? -0.6 : 0;
      v.step(DT, { throttle: 0.3, brake: 0, steer, handbrake: 0 });
      expect(Number.isFinite(v.u) && Number.isFinite(v.r)).toBe(true);
    }
    expect(Math.abs(v.r)).toBeLessThan(0.15);
    expect(Math.abs(v.ayF / G)).toBeLessThan(0.3);
  });
});
