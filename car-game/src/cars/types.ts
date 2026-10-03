import type { TireParams } from '../physics/tire';

/**
 * Full description of a car. Adding a car = adding a folder in src/cars/<id>/
 * with a config.ts exporting a CarConfig, and registering it in src/cars/registry.ts.
 */
export interface CarConfig {
  id: string;
  /** Display name, e.g. "Audi RS3 Sportback (8Y)". */
  name: string;
  /** True while the car uses a procedural stand-in instead of a real 3D model. */
  placeholder: boolean;
  physics: CarPhysicsConfig;
  visual: CarVisualConfig;
  sound: EngineSoundProfile;
  /** Official figures used by the automated tests (SPEC §11). */
  reference: CarReference;
}

export type DriveLayout = 'FWD' | 'RWD' | 'AWD';
export type GearboxType = 'manual' | 'automatic' | 'dct';

export interface EngineConfig {
  idleRpm: number;
  /** Fuel cut. */
  redlineRpm: number;
  /** Full-load torque curve at the crank: [rpm, N·m], sorted by rpm. */
  torqueCurve: ReadonlyArray<readonly [number, number]>;
  /** Engine-braking torque at redline with closed throttle (N·m). */
  engineBrakeTorque: number;
  /** Flywheel + crank inertia (kg·m²), used when the clutch is open. */
  inertia: number;
  /** Engine speed held while the clutch slips at launch (launch control). */
  launchRpm: number;
  /** Electronic top-speed limiter (km/h). Omit for none. */
  speedLimiterKmh?: number;
  /** Turbocharged engines: used by the sound (spool whistle, blow-off). */
  turbo?: boolean;
}

export interface GearboxConfig {
  type: GearboxType;
  /** Forward ratios, 1st gear first. */
  ratios: number[];
  reverseRatio: number;
  finalDrive: number;
  /** Time with torque interrupted during a shift (s). DCT ≈ 0.08, AT ≈ 0.2, manual ≈ 0.35. */
  shiftTime: number;
  /** Driveline efficiency (0–1). */
  efficiency: number;
  /** Max torque the clutch can transmit while slipping (N·m at the crank). */
  clutchCapacity: number;
}

export interface DifferentialConfig {
  /** Fraction of drive torque sent to the front axle (AWD only, 0–1). */
  frontTorqueSplit: number;
  /** Limited-slip locking coefficient (N·m per rad/s of wheel-speed difference). 0 = open diff. */
  lockingCoefficient: number;
  /** Max fraction of the axle torque the LSD can transfer (0–0.5). */
  maxLockFraction: number;
  /** AWD centre coupling (N·m per rad/s of front/rear speed difference). Ignored for 2WD. */
  centerLockingCoefficient: number;
  /** Max fraction of the total torque the centre coupling can move between axles. */
  centerMaxLockFraction: number;
  /**
   * Rear torque vectoring (e.g. Audi RS Torque Splitter): fraction of the rear-axle torque
   * that can be sent to the outer wheel in a corner. 0 / omitted = none.
   */
  rearTorqueVectoring?: number;
}

export interface CarPhysicsConfig {
  mass: number;
  wheelbase: number;
  /** Fraction of static weight on the front axle. */
  frontWeightFraction: number;
  trackFront: number;
  trackRear: number;
  cgHeight: number;
  /** Yaw moment of inertia (kg·m²). */
  yawInertia: number;
  drive: DriveLayout;
  engine: EngineConfig;
  gearbox: GearboxConfig;
  differential: DifferentialConfig;
  tires: { front: TireParams; rear: TireParams };
  brakes: {
    /** Max brake torque per front wheel (N·m). */
    maxTorqueFront: number;
    maxTorqueRear: number;
    /** Handbrake torque per rear wheel (N·m). */
    handbrakeTorque: number;
  };
  suspension: {
    /** Front share of the total roll stiffness (lateral load-transfer distribution). */
    rollStiffnessFront: number;
    /** Wheel rate used to animate suspension travel (N/m). */
    wheelRateFront: number;
    wheelRateRear: number;
    /** Body roll per g of lateral acceleration (deg/g), used for the visual body motion. */
    rollGradient: number;
    /** Body pitch per g of longitudinal acceleration (deg/g). */
    pitchGradient: number;
    /** Natural frequency of the body motion (Hz) and damping ratio. */
    bodyFrequency: number;
    bodyDamping: number;
  };
  aero: {
    /** Drag coefficient × frontal area (m²). */
    cdA: number;
    /** Lift coefficient × area per axle (m², positive = downforce). */
    clAFront: number;
    clARear: number;
    /**
     * Active rear wing. 'drs' flattens the wing on full throttle in a straight line (911 GT3 RS);
     * 'airbrake' raises it under hard braking (McLaren 675LT). Deltas are added to cdA / clARear.
     */
    activeWing?: { mode: 'drs' | 'airbrake'; cdADelta: number; clARearDelta: number; minSpeedKmh: number };
  };
  steering: {
    /** Max road-wheel angle at standstill (rad). */
    maxAngle: number;
    /** Steering-wheel turns lock-to-centre (visual). */
    steeringWheelMaxDeg: number;
  };
}

export type BodyStyle = 'hatch' | 'wagon' | 'sedan' | 'fastback' | 'coupe' | 'rearengine' | 'midengine';
export type HeadlightStyle = 'audi-matrix' | 'porsche-quad' | 'ford-tribar' | 'bmw-l' | 'nissan-boomerang' | 'mclaren-socket' | 'generic';
export type TaillightStyle = 'audi-strip' | 'porsche-bar' | 'ford-tribar' | 'bmw-l' | 'nissan-quad-round' | 'mclaren-c' | 'generic';
export type GrilleStyle = 'audi-singleframe' | 'porsche-intakes' | 'ford-pony' | 'bmw-kidney' | 'nissan-v' | 'mclaren-intakes' | 'generic';
export type WingStyle = 'none' | 'lip' | 'roof-spoiler' | 'gt3rs-swan' | 'active-blade' | 'gtr-wing';
export type DashStyle = 'audi-virtual' | 'porsche-gt' | 'ford-digital' | 'bmw-curved' | 'nissan-analog' | 'mclaren-folding' | 'generic';

export interface PaintOption {
  name: string;
  color: number;
  /** 0 = solid, 1 = strong metallic flake. */
  metallic: number;
}

export interface CarVisualConfig {
  /** Path of the real model (assets/cars/<id>/model.glb). Loaded when present, else placeholder. */
  model?: string;
  /** Attribution required by the model's licence (shown in the garage). */
  modelCredit?: string;
  brand: string;
  length: number;
  width: number;
  height: number;
  /** Distance from the CG to the front / rear bumper (m). */
  frontOverhangFromCg: number;
  rearOverhangFromCg: number;
  bodyStyle: BodyStyle;
  headlights: HeadlightStyle;
  taillights: TaillightStyle;
  grille: GrilleStyle;
  wing: WingStyle;
  dash: DashStyle;
  doors: 'conventional' | 'dihedral';
  exhaust: { count: 2 | 4; layout: 'corners' | 'center' | 'wide' };
  /** Rim design: number of spokes, centre-lock nut. */
  rimDesign: { spokes: number; centerLock?: boolean };
  /** Factory colours (first = default). */
  paints: PaintOption[];
  paint: number;
  rimColors: Array<{ name: string; color: number }>;
  rim: number;
  caliper: number;
  /** Driver eye position in car space (x left, y up, z forward, origin under the CG). */
  driverEye: [number, number, number];
}

export interface CarReference {
  /** Engine description shown in the garage, e.g. "2.5 TFSI 5 cylindres turbo". */
  engine: string;
  /** Drivetrain description, e.g. "quattro avec RS Torque Splitter". */
  drivetrain: string;
  /** 0–100 km/h (s). */
  zeroTo100: number;
  topSpeedKmh: number;
  powerHp: number;
  torqueNm: number;
  massKg: number;
  /** Where the numbers come from. */
  source: string;
}

/**
 * Engine sound character (see src/audio/EngineAudio.ts). The synthesiser builds the waveform
 * from the engine's firing orders, so these values describe the architecture, not a recording.
 */
export interface EngineSoundProfile {
  cylinders: number;
  /** Uneven-firing / burble content between the firing orders (0 smooth – 1 lumpy). */
  roughness: number;
  /** High-order content (0 deep – 1 shrieking). */
  brightness: number;
  /** Intake roar level (0–1). */
  intake: number;
  /** Turbo whistle and blow-off valve level (0 = naturally aspirated). */
  turbo: number;
  /** Overrun crackles and pops (0–1). */
  pops: number;
  /** Seed for the deterministic part of the timbre, so two engines never sound identical. */
  seed: number;
}
