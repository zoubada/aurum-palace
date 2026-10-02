import type { CarConfig, CarPhysicsConfig } from '../types';
import { overhangsFromCg, trackTire, tireRadius, withDriver, yawInertia } from '../helpers';

// Porsche 911 GT3 RS (992, 2023+). 4.0 naturally aspirated flat-six, 525 PS @ 8500 / 465 N·m @ 6300,
// 9000 rpm, 7-speed PDK, RWD. Downforce 409 kg @ 200 km/h, 860 kg @ 285 km/h; DRS flattens the
// wing. Michelin Pilot Sport Cup 2 R. PDK ratios are close estimates.
const rf = tireRadius(275, 35, 20);
const rr = tireRadius(335, 30, 21);
const kerb = 1450;
const physics: CarPhysicsConfig = {
  mass: withDriver(kerb),
  wheelbase: 2.457,
  frontWeightFraction: 0.39,
  trackFront: 1.63,
  trackRear: 1.6,
  cgHeight: 0.43,
  yawInertia: yawInertia(withDriver(kerb), 2.457, 0.39, 1.0),
  drive: 'RWD',
  engine: {
    idleRpm: 850,
    redlineRpm: 9000,
    torqueCurve: [
      [800, 250],
      [2500, 330],
      [4500, 420],
      [6300, 465],
      [7500, 455],
      [8500, 434],
      [9000, 405],
      [9400, 360],
    ],
    engineBrakeTorque: 90,
    inertia: 0.14,
    launchRpm: 6000,
  },
  gearbox: {
    type: 'dct',
    ratios: [3.75, 2.38, 1.72, 1.34, 1.11, 0.96, 0.84],
    reverseRatio: 3.42,
    finalDrive: 4.3,
    shiftTime: 0.06,
    efficiency: 0.9,
    clutchCapacity: 600,
  },
  differential: {
    frontTorqueSplit: 0,
    lockingCoefficient: 60,
    maxLockFraction: 0.4,
    centerLockingCoefficient: 0,
    centerMaxLockFraction: 0,
  },
  tires: {
    front: trackTire(rf, 1.36, { nominalLoad: 3000 }),
    rear: trackTire(rr, 1.42, { nominalLoad: 4600 }),
  },
  brakes: { maxTorqueFront: 3600, maxTorqueRear: 2800, handbrakeTorque: 2500 },
  suspension: {
    rollStiffnessFront: 0.5,
    wheelRateFront: 70000,
    wheelRateRear: 90000,
    rollGradient: 1.3,
    pitchGradient: 0.9,
    bodyFrequency: 2.4,
    bodyDamping: 0.6,
  },
  aero: {
    cdA: 1.04,
    clAFront: 0.85,
    clARear: 1.3,
    activeWing: { mode: 'drs', cdADelta: -0.11, clARearDelta: -0.75, minSpeedKmh: 80 },
  },
  steering: { maxAngle: 0.58, steeringWheelMaxDeg: 360 },
};

export const porscheGt3Rs: CarConfig = {
  id: 'porsche-911-gt3-rs-992',
  name: 'Porsche 911 GT3 RS',
  placeholder: true,
  physics,
  visual: {
    model: 'assets/cars/porsche-911-gt3-rs-992/model.glb',
    brand: 'Porsche',
    length: 4.572,
    width: 1.9,
    height: 1.322,
    ...overhangsFromCg(physics, 1.04, 1.075),
    bodyStyle: 'coupe',
    headlights: 'porsche-quad',
    taillights: 'porsche-bar',
    grille: 'porsche-intakes',
    wing: 'gt3rs-swan',
    dash: 'porsche-gt',
    doors: 'conventional',
    exhaust: { count: 2, layout: 'center' },
    paints: [
      { name: 'Bleu Requin', color: 0x1d8ad0, metallic: 0 },
      { name: 'Vert Python', color: 0x6fb13a, metallic: 0 },
      { name: 'Argent GT', color: 0xa7aaae, metallic: 0.8 },
      { name: 'Rouge Indien', color: 0xc4102b, metallic: 0 },
      { name: 'Blanc', color: 0xf0f0ee, metallic: 0 },
      { name: 'Noir', color: 0x0d0d0e, metallic: 0 },
    ],
    paint: 0x1d8ad0,
    rimColors: [
      { name: 'Argent', color: 0xbfc2c5 },
      { name: 'Noir satiné', color: 0x1a1b1d },
      { name: 'Magnésium foncé', color: 0x3b3d40 },
    ],
    rim: 0x1a1b1d,
    caliper: 0xd8a51a,
    driverEye: [0.36, 1.03, -0.1],
  },
  reference: {
    zeroTo100: 3.2,
    topSpeedKmh: 296,
    powerHp: 525,
    torqueNm: 465,
    massKg: kerb,
    source: 'Porsche AG, fiche 911 GT3 RS (992) 2022',
  },
};
