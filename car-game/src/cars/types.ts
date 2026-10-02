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
  };
  steering: {
    /** Max road-wheel angle at standstill (rad). */
    maxAngle: number;
    /** Steering-wheel turns lock-to-centre (visual). */
    steeringWheelMaxDeg: number;
  };
}

export interface CarVisualConfig {
  length: number;
  width: number;
  height: number;
  /** Distance from the CG to the front / rear bumper (m). */
  frontOverhangFromCg: number;
  rearOverhangFromCg: number;
  paint: number;
  rim: number;
  caliper: number;
  /** Driver eye position in car space (x left, y up, z forward, origin under the CG). */
  driverEye: [number, number, number];
}

export interface CarReference {
  /** 0–100 km/h (s). */
  zeroTo100: number;
  topSpeedKmh: number;
  powerHp: number;
  torqueNm: number;
  /** Where the numbers come from. */
  source: string;
}
