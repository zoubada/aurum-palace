import type { CarConfig, CarPhysicsConfig } from '../types';
import { overhangsFromCg, tire, tireRadius, withDriver, yawInertia } from '../helpers';

// Nissan GT-R (R35, MY2024 Premium). VR38DETT 3.8 V6 biturbo, 570 PS / 637 N·m, GR6 6-speed
// dual-clutch transaxle, ATTESA E-TS AWD (0:100 up to 50:50). GR6 ratios published by Nissan.
// 0–100 km/h: the 2.7–2.9 s often quoted are 0–60 mph times with a 1-ft rollout (US tests).
// With Nissan's published torque and ratios the physics gives ~3.3 s, in line with European
// 0–100 km/h measurements (3.2–3.5 s), which is the reference used here.
const rf = tireRadius(255, 40, 20);
const rr = tireRadius(285, 35, 20);
const kerb = 1752;
const physics: CarPhysicsConfig = {
  mass: withDriver(kerb),
  wheelbase: 2.78,
  frontWeightFraction: 0.54,
  trackFront: 1.59,
  trackRear: 1.6,
  cgHeight: 0.48,
  yawInertia: yawInertia(withDriver(kerb), 2.78, 0.54),
  drive: 'AWD',
  engine: {
    idleRpm: 750,
    redlineRpm: 7100,
    torqueCurve: [
      [700, 300],
      [2000, 480],
      [3300, 637],
      [5800, 637],
      [6800, 588],
      [7100, 555],
      [7400, 490],
    ],
    engineBrakeTorque: 110,
    inertia: 0.22,
    launchRpm: 4200,
    speedLimiterKmh: 315,
    turbo: true,
  },
  gearbox: {
    type: 'dct',
    ratios: [4.056, 2.301, 1.595, 1.248, 1.001, 0.796],
    reverseRatio: 3.383,
    finalDrive: 3.7,
    shiftTime: 0.1,
    efficiency: 0.89,
    clutchCapacity: 900,
  },
  differential: {
    frontTorqueSplit: 0.15,
    lockingCoefficient: 60,
    maxLockFraction: 0.4,
    centerLockingCoefficient: 450,
    centerMaxLockFraction: 0.4,
  },
  tires: {
    front: tire(rf, 1.16, { nominalLoad: 4800 }),
    rear: tire(rr, 1.18, { nominalLoad: 4200 }),
  },
  brakes: { maxTorqueFront: 4600, maxTorqueRear: 2600, handbrakeTorque: 3000 },
  suspension: {
    rollStiffnessFront: 0.56,
    wheelRateFront: 55000,
    wheelRateRear: 52000,
    rollGradient: 2.2,
    pitchGradient: 1.5,
    bodyFrequency: 1.8,
    bodyDamping: 0.55,
  },
  aero: { cdA: 0.82, clAFront: 0.1, clARear: 0.15 },
  steering: { maxAngle: 0.6, steeringWheelMaxDeg: 405 },
};

export const nissanGtr: CarConfig = {
  id: 'nissan-gt-r-r35',
  name: 'Nissan GT-R',
  placeholder: true,
  physics,
  sound: { cylinders: 6, roughness: 0.35, brightness: 0.45, intake: 0.5, turbo: 0.9, pops: 0.3, seed: 66 },
  visual: {
    model: 'assets/cars/nissan-gt-r-r35/model.glb',
    brand: 'Nissan',
    length: 4.71,
    width: 1.895,
    height: 1.37,
    ...overhangsFromCg(physics, 0.94, 0.99),
    bodyStyle: 'coupe',
    headlights: 'nissan-boomerang',
    taillights: 'nissan-quad-round',
    grille: 'nissan-v',
    wing: 'gtr-wing',
    dash: 'nissan-analog',
    doors: 'conventional',
    exhaust: { count: 4, layout: 'corners' },
    rimDesign: { spokes: 12 },
    paints: [
      { name: 'Gris Ultimate Silver', color: 0xb5babe, metallic: 0.8 },
      { name: 'Bleu Bayside', color: 0x1a4c9e, metallic: 0.6 },
      { name: 'Vert Millennium Jade', color: 0x3d5a48, metallic: 0.7 },
      { name: 'Rouge Vibrant', color: 0xad1620, metallic: 0.3 },
      { name: 'Noir Meteor Flake', color: 0x101113, metallic: 0.8 },
      { name: 'Blanc nacré', color: 0xedede9, metallic: 0.5 },
    ],
    paint: 0xb5babe,
    rimColors: [
      { name: 'Noir RAYS', color: 0x18191b },
      { name: 'Bronze RAYS', color: 0x6a5434 },
    ],
    rim: 0x18191b,
    caliper: 0x1c1d20,
    driverEye: [0.37, 1.1, -0.34],
  },
  reference: {
    engine: '3.8 V6 biturbo (VR38DETT)',
    drivetrain: 'Intégrale ATTESA E-TS',
    zeroTo100: 3.3,
    topSpeedKmh: 315,
    powerHp: 570,
    torqueNm: 637,
    massKg: kerb,
    source: 'Nissan, fiche GT-R MY2024 ; 0–100 km/h : mesures de la presse européenne (3,2–3,5 s)',
  },
};
