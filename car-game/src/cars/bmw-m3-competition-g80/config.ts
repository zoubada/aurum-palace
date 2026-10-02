import type { CarConfig, CarPhysicsConfig } from '../types';
import { overhangsFromCg, tire, tireRadius, withDriver, yawInertia } from '../helpers';

// BMW M3 Competition (G80, RWD). S58 3.0 inline-six biturbo, 510 PS / 650 N·m, 8-speed M Steptronic
// (ZF 8HP), Active M Differential. Final drive estimated. Vmax with M Driver's Package.
const rf = tireRadius(275, 35, 19);
const rr = tireRadius(285, 30, 20);
const kerb = 1730;
const physics: CarPhysicsConfig = {
  mass: withDriver(kerb),
  wheelbase: 2.857,
  frontWeightFraction: 0.52,
  trackFront: 1.617,
  trackRear: 1.605,
  cgHeight: 0.49,
  yawInertia: yawInertia(withDriver(kerb), 2.857, 0.52),
  drive: 'RWD',
  engine: {
    idleRpm: 700,
    redlineRpm: 7200,
    torqueCurve: [
      [600, 320],
      [1500, 520],
      [2750, 650],
      [5500, 650],
      [6250, 573],
      [7000, 500],
      [7400, 440],
    ],
    engineBrakeTorque: 110,
    inertia: 0.2,
    launchRpm: 3000,
    speedLimiterKmh: 290,
    turbo: true,
  },
  gearbox: {
    type: 'automatic',
    ratios: [5.0, 3.2, 2.143, 1.72, 1.313, 1.0, 0.823, 0.64],
    reverseRatio: 3.456,
    finalDrive: 2.93,
    shiftTime: 0.12,
    efficiency: 0.87,
    clutchCapacity: 900,
  },
  differential: {
    frontTorqueSplit: 0,
    lockingCoefficient: 70,
    maxLockFraction: 0.45,
    centerLockingCoefficient: 0,
    centerMaxLockFraction: 0,
  },
  tires: {
    front: tire(rf, 1.18, { nominalLoad: 4600 }),
    rear: tire(rr, 1.3, { nominalLoad: 4800 }),
  },
  brakes: { maxTorqueFront: 4300, maxTorqueRear: 2300, handbrakeTorque: 3000 },
  suspension: {
    rollStiffnessFront: 0.57,
    wheelRateFront: 48000,
    wheelRateRear: 45000,
    rollGradient: 2.4,
    pitchGradient: 1.7,
    bodyFrequency: 1.7,
    bodyDamping: 0.55,
  },
  aero: { cdA: 0.77, clAFront: 0.04, clARear: 0.06 },
  steering: { maxAngle: 0.6, steeringWheelMaxDeg: 405 },
};

export const bmwM3: CarConfig = {
  id: 'bmw-m3-competition-g80',
  name: 'BMW M3 Competition',
  placeholder: true,
  physics,
  visual: {
    model: 'assets/cars/bmw-m3-competition-g80/model.glb',
    brand: 'BMW',
    length: 4.794,
    width: 1.903,
    height: 1.433,
    ...overhangsFromCg(physics, 0.86, 1.08),
    bodyStyle: 'sedan',
    headlights: 'bmw-l',
    taillights: 'bmw-l',
    grille: 'bmw-kidney',
    wing: 'lip',
    dash: 'bmw-curved',
    doors: 'conventional',
    exhaust: { count: 4, layout: 'corners' },
    paints: [
      { name: 'Vert Isle of Man', color: 0x1d5a38, metallic: 0.8 },
      { name: 'Jaune São Paulo', color: 0xf0c016, metallic: 0 },
      { name: 'Rouge Toronto', color: 0x9b1a21, metallic: 0.7 },
      { name: 'Bleu Portimao', color: 0x1b4d9b, metallic: 0.7 },
      { name: 'Gris Brooklyn', color: 0x878a8c, metallic: 0.5 },
      { name: 'Blanc Alpin', color: 0xf2f2f0, metallic: 0 },
    ],
    paint: 0x1d5a38,
    rimColors: [
      { name: 'Orbit Grey', color: 0x2d2f32 },
      { name: 'Noir brillant', color: 0x121314 },
      { name: 'Or', color: 0x8c6d32 },
    ],
    rim: 0x2d2f32,
    caliper: 0x1f3c88,
    driverEye: [0.37, 1.13, -0.38],
  },
  reference: {
    zeroTo100: 3.9,
    topSpeedKmh: 290,
    powerHp: 510,
    torqueNm: 650,
    massKg: kerb,
    source: 'BMW AG, fiche M3 Competition (G80) 2021 (vmax 290 km/h avec M Driver’s Package)',
  },
};
