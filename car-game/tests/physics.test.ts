import { describe, expect, it } from 'vitest';
import { audiRs3 } from '../src/cars/audi-rs3-8y/config';
import { ASSIST_PRESETS, Vehicle, type DriveInput } from '../src/physics/vehicle';
import { collideWalls, outlinePoints, rectangleWalls } from '../src/physics/collision';
import { G } from '../src/physics/math';
import { braking100 } from '../src/physics/benchmark';

const DT = 1 / 240;
// Generic behaviour tests run on one AWD car; per-car figures are checked in cars.test.ts.
const cfg = audiRs3;

function makeCar(preset: keyof typeof ASSIST_PRESETS = 'intermediate'): Vehicle {
  const v = new Vehicle(cfg.physics);
  v.assists = { ...ASSIST_PRESETS[preset], autoGear: true };
  return v;
}

const input = (p: Partial<DriveInput> = {}): DriveInput => ({ throttle: 0, brake: 0, steer: 0, handbrake: 0, ...p });

function runUntil(v: Vehicle, inp: DriveInput, cond: (t: number) => boolean, maxT = 120): number {
  let t = 0;
  while (t < maxT && !cond(t)) {
    v.step(DT, inp);
    t += DT;
    if (!Number.isFinite(v.u) || !Number.isFinite(v.r)) throw new Error('NaN in vehicle state');
  }
  return t;
}

/** Drive at a constant speed with a simple throttle/brake controller. */
function holdSpeed(v: Vehicle, target: number, steer: number): DriveInput {
  const err = target - v.u;
  return input({ throttle: Math.max(0, Math.min(1, err * 0.6 + 0.25)), brake: err < -1 ? 0.2 : 0, steer });
}

describe('vehicle physics — straight line', () => {
  it('stays perfectly still on the handbrake', () => {
    const v = makeCar();
    runUntil(v, input({ handbrake: 1 }), (t) => t > 5);
    expect(Math.abs(v.u)).toBeLessThan(0.05);
    expect(Math.hypot(v.x, v.z)).toBeLessThan(0.2);
    expect(Math.abs(v.yaw)).toBeLessThan(1e-6);
  });

  it('creeps at walking pace with the automatic gearbox and no pedal', () => {
    const v = makeCar();
    runUntil(v, input(), (t) => t > 8);
    expect(v.u).toBeGreaterThan(0.5);
    expect(v.u).toBeLessThan(2.5);
  });

  it('brakes 100–0 km/h in a realistic distance with ABS', () => {
    const v = makeCar();
    runUntil(v, input({ throttle: 1 }), () => v.speedKmh >= 100);
    const x0 = v.x;
    const z0 = v.z;
    const t = runUntil(v, input({ brake: 1 }), () => v.u < 0.1, 10);
    const dist = Math.hypot(v.x - x0, v.z - z0);
    console.log(`100-0 km/h (ABS): ${dist.toFixed(1)} m in ${t.toFixed(2)} s`);
    // Sports cars on road tires: ~32–38 m.
    expect(dist).toBeGreaterThan(30);
    expect(dist).toBeLessThan(40);
  });

  it('locks the wheels and brakes longer without ABS', () => {
    const v = makeCar('simulation');
    v.assists.autoGear = true;
    runUntil(v, input({ throttle: 1 }), () => v.speedKmh >= 100);
    const x0 = v.x;
    const z0 = v.z;
    runUntil(v, input({ brake: 1 }), () => v.u < 0.1, 10);
    const dist = Math.hypot(v.x - x0, v.z - z0);
    const withAbs = braking100(cfg.physics);
    console.log(`100-0 km/h: ${withAbs.toFixed(1)} m with ABS, ${dist.toFixed(1)} m wheels locked`);
    // Locked tires slide at their (lower) sliding grip level.
    expect(dist).toBeGreaterThan(withAbs * 1.03);
  });

  it('selects reverse with the brake pedal at standstill and drives backwards', () => {
    const v = makeCar();
    runUntil(v, input({ brake: 1 }), (t) => t > 3);
    expect(v.gear).toBe(-1);
    runUntil(v, input({ brake: 1 }), (t) => t > 3);
    expect(v.u).toBeLessThan(-3);
  });
});

describe('vehicle physics — cornering', () => {
  it('reaches ~1 g of lateral grip on a 50 m skidpad', () => {
    const v = makeCar();
    const R = 50;
    let maxAy = 0;
    // Ramp the speed up slowly while steering to follow the circle.
    for (let t = 0; t < 60; t += DT) {
      const target = 8 + t * 0.4;
      const curvature = v.u > 1 ? v.r / v.u : 0;
      const steerFF = -((cfg.physics.wheelbase / R) / cfg.physics.steering.maxAngle);
      const steer = steerFF * 1.4 - (1 / R - curvature) * 30;
      v.step(DT, holdSpeed(v, target, Math.max(-1, Math.min(1, steer))));
      if (t > 5) maxAy = Math.max(maxAy, Math.abs(v.ayF));
    }
    const g = maxAy / G;
    console.log(`Max steady lateral acceleration: ${g.toFixed(2)} g`);
    expect(g).toBeGreaterThan(0.9);
    expect(g).toBeLessThan(1.35);
  });

  it('turns left with left steering and right with right steering', () => {
    const left = makeCar();
    const right = makeCar();
    runUntil(left, input({ throttle: 0.4 }), () => left.u > 15);
    runUntil(right, input({ throttle: 0.4 }), () => right.u > 15);
    runUntil(left, input({ throttle: 0.2, steer: -0.5 }), (t) => t > 1);
    runUntil(right, input({ throttle: 0.2, steer: 0.5 }), (t) => t > 1);
    expect(left.r).toBeGreaterThan(0.1);
    expect(right.r).toBeLessThan(-0.1);
    expect(left.roll).toBeGreaterThan(0); // body rolls towards the outside of the turn
  });

  it('stays stable through a lane change at 120 km/h with ESP', () => {
    const v = makeCar('arcade');
    runUntil(v, input({ throttle: 1 }), () => v.speedKmh >= 120);
    let t = 0;
    for (; t < 4; t += DT) {
      const steer = t < 0.6 ? 0.6 : t < 1.4 ? -0.6 : 0;
      v.step(DT, holdSpeed(v, 33, steer));
    }
    expect(Math.abs(v.r)).toBeLessThan(0.15);
    expect(Math.abs(Math.atan2(v.v, v.u))).toBeLessThan(0.1);
  });
});

describe('drivability and driver aids', () => {
  it('does not spin with keyboard-style full lock at 100 km/h (intermediate aids)', () => {
    const v = makeCar('intermediate');
    runUntil(v, input({ throttle: 1 }), () => v.speedKmh >= 100);
    let maxBeta = 0;
    for (let t = 0; t < 3; t += DT) {
      v.step(DT, input({ throttle: 0.3, steer: 1 }));
      maxBeta = Math.max(maxBeta, Math.abs(Math.atan2(v.v, Math.abs(v.u))));
    }
    // Body slip angle stays small: the car turns (and understeers) instead of spinning.
    expect(maxBeta).toBeLessThan(0.15);
    expect(v.r).toBeLessThan(-0.2);
  });

  it('traction control limits wheelspin on a low-grip surface', () => {
    const spin = (tc: boolean) => {
      const v = makeCar(tc ? 'intermediate' : 'simulation');
      v.assists.autoGear = true;
      v.surfaceGrip = 0.45; // wet / slippery
      let maxKappa = 0;
      for (let t = 0; t < 3; t += DT) {
        v.step(DT, input({ throttle: 1 }));
        if (t > 0.5) for (const w of v.wheels) maxKappa = Math.max(maxKappa, w.kappa);
      }
      return maxKappa;
    };
    const without = spin(false);
    const withTc = spin(true);
    console.log(`Max slip ratio on low grip: without TC ${without.toFixed(2)}, with TC ${withTc.toFixed(2)}`);
    expect(withTc).toBeLessThan(0.25);
    expect(without).toBeGreaterThan(withTc);
  });

  it('manual gearbox: shifts on request and the rev limiter caps engine speed', () => {
    const v = makeCar('simulation');
    v.assists.autoGear = false;
    let maxRpm = 0;
    runUntil(v, input({ throttle: 1 }), (t) => {
      maxRpm = Math.max(maxRpm, v.engineRpm);
      return t > 4;
    });
    expect(v.gear).toBe(1);
    expect(maxRpm).toBeLessThan(cfg.physics.engine.redlineRpm + 250);
    v.shiftUp();
    runUntil(v, input({ throttle: 1 }), (t) => t > 0.5);
    expect(v.gear).toBe(2);
    expect(v.engineRpm).toBeLessThan(cfg.physics.engine.redlineRpm);
  });
});

describe('collisions', () => {
  it('bounces off a wall and stays outside it', () => {
    const v = makeCar();
    v.reset(0, 0, 0);
    v.u = 20;
    const walls = rectangleWalls(-50, 50, -50, 10);
    const outline = outlinePoints(cfg.visual.frontOverhangFromCg, cfg.visual.rearOverhangFromCg, cfg.visual.width / 2);
    let maxImpact = 0;
    for (let t = 0; t < 2; t += DT) {
      v.step(DT, input());
      const hit = collideWalls(v, outline, walls);
      if (hit) maxImpact = Math.max(maxImpact, hit.speed);
    }
    expect(maxImpact).toBeGreaterThan(15);
    expect(v.z + cfg.visual.frontOverhangFromCg).toBeLessThanOrEqual(10.05);
    expect(v.u).toBeLessThan(0);
  });
});
