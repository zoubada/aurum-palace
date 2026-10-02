import type { CarConfig, CarPhysicsConfig } from '../types';
import { overhangsFromCg, tire, tireRadius, withDriver, yawInertia } from '../helpers';

// Ford Mustang GT (S650, 2024+), US specification. 5.0 Coyote V8 (Gen 4), 486 hp @ 7250 /
// 567 N·m @ 4900, 7500 rpm, 10-speed automatic (10R80), RWD with limited-slip differential.
// Ford does not publish a 0–100 km/h time for the US car: the reference is the average of
// US magazine 0–60 mph tests (≈4.2 s with rollout, automatic), i.e. ≈4.6 s for 0–100 km/h.
// Electronic limiter as on European cars.
const rf = tireRadius(255, 40, 19);
const rr = tireRadius(275, 40, 19);
const kerb = 1770;
const physics: CarPhysicsConfig = {
  mass: withDriver(kerb),
  wheelbase: 2.72,
  frontWeightFraction: 0.53,
  trackFront: 1.58,
  trackRear: 1.648,
  cgHeight: 0.52,
  yawInertia: yawInertia(withDriver(kerb), 2.72, 0.53),
  drive: 'RWD',
  engine: {
    idleRpm: 700,
    redlineRpm: 7500,
    torqueCurve: [
      [600, 300],
      [2000, 460],
      [3500, 530],
      [4900, 567],
      [6000, 537],
      [7250, 477],
      [7500, 445],
      [7800, 380],
    ],
    engineBrakeTorque: 130,
    inertia: 0.26,
    launchRpm: 2600,
    speedLimiterKmh: 250,
  },
  gearbox: {
    type: 'automatic',
    ratios: [4.696, 2.985, 2.146, 1.769, 1.52, 1.275, 1.0, 0.854, 0.689, 0.636],
    reverseRatio: 4.866,
    finalDrive: 3.15,
    shiftTime: 0.15,
    efficiency: 0.86,
    clutchCapacity: 900,
  },
  differential: {
    frontTorqueSplit: 0,
    lockingCoefficient: 50,
    maxLockFraction: 0.35,
    centerLockingCoefficient: 0,
    centerMaxLockFraction: 0,
  },
  tires: {
    front: tire(rf, 1.07, { nominalLoad: 4800 }),
    rear: tire(rr, 1.1, { nominalLoad: 4300 }),
  },
  brakes: { maxTorqueFront: 4200, maxTorqueRear: 2200, handbrakeTorque: 3000 },
  suspension: {
    rollStiffnessFront: 0.6,
    wheelRateFront: 42000,
    wheelRateRear: 40000,
    rollGradient: 3.2,
    pitchGradient: 2.2,
    bodyFrequency: 1.4,
    bodyDamping: 0.5,
  },
  aero: { cdA: 0.9, clAFront: 0.02, clARear: 0.05 },
  steering: { maxAngle: 0.62, steeringWheelMaxDeg: 450 },
};

export const fordMustangGt: CarConfig = {
  id: 'ford-mustang-gt-s650',
  name: 'Ford Mustang GT',
  placeholder: true,
  physics,
  sound: { cylinders: 8, roughness: 0.95, brightness: 0.4, intake: 0.55, turbo: 0, pops: 0.5, seed: 48 },
  visual: {
    model: 'assets/cars/ford-mustang-gt-s650/model.glb',
    brand: 'Ford',
    length: 4.811,
    width: 1.916,
    height: 1.397,
    ...overhangsFromCg(physics, 0.95, 1.14),
    bodyStyle: 'fastback',
    headlights: 'ford-tribar',
    taillights: 'ford-tribar',
    grille: 'ford-pony',
    wing: 'lip',
    dash: 'ford-digital',
    doors: 'conventional',
    exhaust: { count: 4, layout: 'corners' },
    rimDesign: { spokes: 10 },
    paints: [
      { name: 'Grabber Blue', color: 0x1f6dc3, metallic: 0.3 },
      { name: 'Race Red', color: 0xb3111b, metallic: 0 },
      { name: 'Yellow Splash', color: 0xf0c000, metallic: 0.4 },
      { name: 'Vapor Blue', color: 0x7c97ad, metallic: 0.6 },
      { name: 'Eruption Green', color: 0x2c5a3e, metallic: 0.6 },
      { name: 'Shadow Black', color: 0x0d0d0e, metallic: 0 },
    ],
    paint: 0x1f6dc3,
    rimColors: [
      { name: 'Ebony Black', color: 0x141516 },
      { name: 'Argent usiné', color: 0xa9adb1 },
    ],
    rim: 0x141516,
    caliper: 0xc8102e,
    driverEye: [0.37, 1.12, -0.48],
  },
  reference: {
    engine: '5.0 V8 Coyote atmosphérique',
    drivetrain: 'Propulsion, autobloquant',
    zeroTo100: 4.6,
    topSpeedKmh: 250,
    powerHp: 486,
    torqueNm: 567,
    massKg: kerb,
    source: 'Ford Motor Co. (puissance, couple US 2024) ; 0–100 km/h : estimation à partir des essais presse US (boîte auto)',
  },
};
