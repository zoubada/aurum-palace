import type { CarConfig, CarPhysicsConfig } from '../types';
import { overhangsFromCg, tire, tireRadius, withDriver, yawInertia } from '../helpers';

// Ford Mustang GT Fastback (S550 restyled, 2021), European specification. 5.0 Coyote V8 (Gen 3),
// 450 PS @ 7000 / 529 N·m @ 4600, 7500 rpm, 10-speed automatic (10R80), RWD with a
// limited-slip differential, 250 km/h limiter. Kerb weight without driver (EU figure 1818 kg
// includes 75 kg).

const rf = tireRadius(255, 40, 19);
const rr = tireRadius(275, 40, 19);
const kerb = 1743;
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
      [600, 290],
      [2000, 430],
      [3500, 500],
      [4600, 529],
      [5500, 520],
      [7000, 451],
      [7500, 410],
      [7800, 360],
    ],
    engineBrakeTorque: 130,
    inertia: 0.26,
    launchRpm: 3000,
    speedLimiterKmh: 250,
  },
  gearbox: {
    type: 'automatic',
    ratios: [4.696, 2.985, 2.146, 1.769, 1.52, 1.275, 1.0, 0.854, 0.689, 0.636],
    reverseRatio: 4.866,
    finalDrive: 3.55,
    shiftTime: 0.1,
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
    front: tire(rf, 1.12, { nominalLoad: 4800 }), // Michelin Pilot Sport 4S (EU GT)
    rear: tire(rr, 1.2, { nominalLoad: 4300 }),
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
  id: 'ford-mustang-gt-2021',
  name: 'Ford Mustang GT',
  placeholder: true,
  physics,
  sound: { cylinders: 8, roughness: 0.95, brightness: 0.4, intake: 0.55, turbo: 0, pops: 0.5, seed: 48 },
  visual: {
    model: 'assets/cars/ford-mustang-gt-2021/model.glb',
    modelCredit: 'Modèle 3D « Ford Mustang Gt 2021 » par Asura007 (Sketchfab), licence CC-BY 4.0 — adapté pour le jeu',
    brand: 'Ford',
    length: 4.794,
    width: 1.916,
    height: 1.381,
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
      { name: 'Race Red', color: 0xb3111b, metallic: 0 },
      { name: 'Velocity Blue', color: 0x1f4fa8, metallic: 0.6 },
      { name: 'Twister Orange', color: 0xd9541a, metallic: 0.6 },
      { name: 'Grabber Lime', color: 0x8fc23a, metallic: 0.3 },
      { name: 'Oxford White', color: 0xeeeeea, metallic: 0 },
      { name: 'Shadow Black', color: 0x0d0d0e, metallic: 0 },
    ],
    paint: 0xb3111b,
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
    zeroTo100: 4.3,
    topSpeedKmh: 250,
    powerHp: 450,
    torqueNm: 529,
    massKg: kerb,
    source: 'Ford Europe, fiche Mustang GT Fastback boîte automatique 10 rapports (2021)',
  },
};
