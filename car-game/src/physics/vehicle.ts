import type { CarPhysicsConfig } from '../cars/types';
import {
  AIR_DENSITY,
  G,
  RADS_TO_RPM,
  approach,
  clamp,
  interpTable,
  lerp,
  smoothFactor,
} from './math';
import { effectiveMu, shapeB, tireForce, type TireForce, type TireParams } from './tire';

/**
 * Vehicle dynamics (SPEC §3).
 *
 * Coordinate conventions
 *  - Body frame: x forward, y left, yaw rate r > 0 = turning left (counter-clockwise from above).
 *  - World (Three.js): X east, Y up, Z south. Heading `yaw` rotates the car about +Y;
 *    forward = (sin yaw, cos yaw), left = (cos yaw, −sin yaw) in the XZ plane.
 *
 * Model
 *  - Planar rigid body (longitudinal, lateral, yaw) integrated at a fixed step (240 Hz).
 *  - 4 wheels with their own spin dynamics, combined-slip Pacejka tires, relaxation length.
 *  - Static + longitudinal + lateral load transfer (roll-stiffness distribution) + aero downforce.
 *  - Engine torque curve, auto clutch / launch, gearbox with shift time, AWD/RWD/FWD with LSDs.
 *  - Brakes with ABS, traction control, ESP (yaw-rate control by individual wheel braking).
 *
 * Phase 1 limitation (flagged): the ground is flat. Pitch/roll are computed from the
 * load transfer as a damped body motion for rendering, not integrated as full 6-DoF.
 * Track elevation, banking and kerbs arrive with the circuits (Phase 3+).
 */

export interface DriveInput {
  /** 0–1 */
  throttle: number;
  /** 0–1 */
  brake: number;
  /** −1 (full left) … +1 (full right) */
  steer: number;
  /** 0–1 */
  handbrake: number;
}

export interface Assists {
  abs: boolean;
  tc: boolean;
  esp: boolean;
  autoGear: boolean;
  /** Limit steering lock with speed so the front tires stay near peak slip (keyboard/gamepad help). */
  steerLimit: boolean;
  /** Automatic counter-steer amount (0 = off, 1 = strong). Arcade only. */
  counterSteer: number;
}

export type AssistPresetId = 'arcade' | 'intermediate' | 'simulation';

export const ASSIST_PRESETS: Record<AssistPresetId, Assists> = {
  arcade: { abs: true, tc: true, esp: true, autoGear: true, steerLimit: true, counterSteer: 0.7 },
  intermediate: { abs: true, tc: true, esp: false, autoGear: true, steerLimit: true, counterSteer: 0 },
  simulation: { abs: false, tc: false, esp: false, autoGear: false, steerLimit: false, counterSteer: 0 },
};

export const enum WheelId {
  FL = 0,
  FR = 1,
  RL = 2,
  RR = 3,
}

export class Wheel {
  /** Angular velocity (rad/s, + = rolling forward). */
  omega = 0;
  /** Accumulated rotation angle for rendering (rad). */
  spin = 0;
  /** Road-wheel steering angle (rad, + = left). */
  steer = 0;
  /** Vertical load (N). */
  fz = 0;
  staticLoad = 0;
  kappa = 0;
  /** Relaxed slip angle (rad). */
  alpha = 0;
  /** Combined normalised slip (>1 = sliding). */
  rho = 0;
  /** Sliding speed of the contact patch (m/s), drives skid marks / smoke / tire sound. */
  slipSpeed = 0;
  fx = 0;
  fy = 0;
  driveTorque = 0;
  brakeTorque = 0;
  /** ABS pressure modulation (0–1). */
  absFactor = 1;
  /** Suspension compression relative to static (m, + = compressed). */
  travel = 0;
  readonly tire: TireParams;
  readonly B: number;

  constructor(
    readonly id: WheelId,
    /** Position relative to the CG: forward (m). */
    readonly x: number,
    /** Position relative to the CG: left (m). */
    readonly y: number,
    readonly front: boolean,
    readonly left: boolean,
    tire: TireParams,
  ) {
    this.tire = tire;
    this.B = shapeB(tire.shapeC);
  }
}

const tmpForce: TireForce = { fx: 0, fy: 0, rho: 0 };
const tmpForce2: TireForce = { fx: 0, fy: 0, rho: 0 };

/** Speed below which slip ratio uses a fixed reference (low-speed tire regime). */
const SLIP_REF_SPEED = 3;
/** Same for slip angle. */
const ALPHA_REF_SPEED = 1;
const DEG = Math.PI / 180;

export class Vehicle {
  readonly cfg: CarPhysicsConfig;
  readonly wheels: Wheel[];
  /** CG → front axle / rear axle (m). */
  readonly a: number;
  readonly b: number;

  // --- Planar rigid-body state ---------------------------------------------
  x = 0;
  z = 0;
  yaw = 0;
  /** Longitudinal / lateral velocity in the body frame (m/s). */
  u = 0;
  v = 0;
  /** Yaw rate (rad/s). */
  r = 0;

  /** Felt accelerations in the body frame, low-pass filtered (m/s²). */
  axF = 0;
  ayF = 0;

  // --- Visual body motion (rad) ---------------------------------------------
  pitch = 0;
  roll = 0;
  private pitchVel = 0;
  private rollVel = 0;

  // --- Powertrain -----------------------------------------------------------
  engineRpm: number;
  /** −1 = R, 0 = N, 1..n */
  gear = 1;
  shiftTimer = 0;
  private shiftCooldown = 0;
  private reverseTimer = 0;
  revLimiterOn = false;
  clutchSlipping = false;
  /** Torque delivered by the engine at the crank this step (N·m). */
  engineTorque = 0;

  // --- Driver aids ----------------------------------------------------------
  assists: Assists = { ...ASSIST_PRESETS.intermediate };
  absActive = false;
  tcActive = false;
  espActive = false;
  private tcFactor = 1;
  private tcIntegral = 1;

  /** Front road-wheel angle (rad, + = left), before Ackermann. */
  steerAngle = 0;
  /** Grip multiplier of the surface under the car (1 = dry asphalt). */
  surfaceGrip = 1;

  /** Effective pedal values after reverse handling (for HUD / lights). */
  appliedThrottle = 0;
  appliedBrake = 0;

  constructor(cfg: CarPhysicsConfig) {
    this.cfg = cfg;
    this.b = cfg.frontWeightFraction * cfg.wheelbase;
    this.a = cfg.wheelbase - this.b;
    const tf = cfg.trackFront / 2;
    const tr = cfg.trackRear / 2;
    this.wheels = [
      new Wheel(WheelId.FL, this.a, tf, true, true, cfg.tires.front),
      new Wheel(WheelId.FR, this.a, -tf, true, false, cfg.tires.front),
      new Wheel(WheelId.RL, -this.b, tr, false, true, cfg.tires.rear),
      new Wheel(WheelId.RR, -this.b, -tr, false, false, cfg.tires.rear),
    ];
    const m = cfg.mass;
    for (const w of this.wheels) {
      w.staticLoad = (w.front ? (m * G * this.b) / cfg.wheelbase : (m * G * this.a) / cfg.wheelbase) / 2;
      w.fz = w.staticLoad;
    }
    this.engineRpm = cfg.engine.idleRpm;
  }

  /** Signed forward speed (m/s). */
  get speed(): number {
    return this.u;
  }

  /** Ground speed (km/h), including the sideways component during a slide. */
  get speedKmh(): number {
    return Math.hypot(this.u, this.v) * 3.6;
  }

  reset(x: number, z: number, yaw: number): void {
    this.x = x;
    this.z = z;
    this.yaw = yaw;
    this.u = this.v = this.r = 0;
    this.axF = this.ayF = 0;
    this.pitch = this.roll = this.pitchVel = this.rollVel = 0;
    this.engineRpm = this.cfg.engine.idleRpm;
    this.gear = 1;
    this.shiftTimer = this.shiftCooldown = this.reverseTimer = 0;
    this.tcFactor = this.tcIntegral = 1;
    this.steerAngle = 0;
    for (const w of this.wheels) {
      w.omega = w.alpha = w.kappa = w.rho = w.slipSpeed = 0;
      w.absFactor = 1;
      w.fz = w.staticLoad;
    }
  }

  // ---------------------------------------------------------------------------
  // Gearbox
  // ---------------------------------------------------------------------------

  private totalRatio(gear: number): number {
    const gb = this.cfg.gearbox;
    if (gear > 0) return gb.ratios[gear - 1] * gb.finalDrive;
    if (gear < 0) return -gb.reverseRatio * gb.finalDrive;
    return 0;
  }

  private setGear(g: number): void {
    if (g === this.gear) return;
    this.gear = g;
    this.shiftTimer = this.cfg.gearbox.shiftTime;
    this.shiftCooldown = this.cfg.gearbox.shiftTime + 0.35;
  }

  /** Manual upshift (paddle / key). Ignored while the automatic gearbox is in charge. */
  shiftUp(): void {
    if (this.assists.autoGear) return;
    const n = this.cfg.gearbox.ratios.length;
    if (this.gear < n) this.setGear(this.gear + 1);
  }

  shiftDown(): void {
    if (this.assists.autoGear) return;
    if (this.gear > 1) {
      // Money-shift protection: refuse a downshift that would over-rev the engine.
      const rpmAfter = this.drivetrainOmega() * this.totalRatio(this.gear - 1) * RADS_TO_RPM;
      if (rpmAfter > this.cfg.engine.redlineRpm + 400) return;
      this.setGear(this.gear - 1);
    } else if (this.gear === 1) {
      this.setGear(0);
    } else if (this.gear === 0 && Math.abs(this.u) < 2) {
      this.setGear(-1);
    }
  }

  /** Gearbox output speed (rad/s) seen through the centre / axle differentials. */
  private drivetrainOmega(): number {
    const w = this.wheels;
    const front = (w[0].omega + w[1].omega) / 2;
    const rear = (w[2].omega + w[3].omega) / 2;
    switch (this.cfg.drive) {
      case 'FWD':
        return front;
      case 'RWD':
        return rear;
      case 'AWD': {
        const s = this.cfg.differential.frontTorqueSplit;
        return s * front + (1 - s) * rear;
      }
    }
  }

  private autoGearbox(throttle: number, brake: number): void {
    if (this.gear < 1 || this.shiftTimer > 0 || this.shiftCooldown > 0 || this.clutchSlipping) return;
    const red = this.cfg.engine.redlineRpm;
    const n = this.cfg.gearbox.ratios.length;
    const rpm = this.engineRpm;
    const ratios = this.cfg.gearbox.ratios;
    // Lift-off upshifts only when cruising: never while braking (that would make the box hunt
    // between gears on the way into a corner).
    const upRpm = lerp(0.62, 0.97, clamp(throttle * 1.15, 0, 1)) * red;
    if (this.gear < n && rpm > upRpm && (brake < 0.05 || rpm > 0.97 * red)) {
      this.setGear(this.gear + 1);
      return;
    }
    if (this.gear > 1) {
      const rpmAfter = (rpm * ratios[this.gear - 2]) / ratios[this.gear - 1];
      const downRpm = brake > 0.2 ? 0.45 * red : lerp(0.28, 0.6, throttle) * red;
      const maxAfter = brake > 0.2 ? 0.86 * red : 0.92 * red;
      if (rpm < downRpm && rpmAfter < maxAfter) this.setGear(this.gear - 1);
    }
  }

  // ---------------------------------------------------------------------------
  // Engine
  // ---------------------------------------------------------------------------

  /** Net crank torque for a given rpm and throttle (includes engine braking and fuel cut). */
  private crankTorque(rpm: number, throttle: number): number {
    const e = this.cfg.engine;
    if (rpm > e.redlineRpm) this.revLimiterOn = true;
    else if (rpm < e.redlineRpm - 150) this.revLimiterOn = false;
    const thr = this.revLimiterOn ? 0 : throttle;
    const full = interpTable(e.torqueCurve, rpm);
    const drag = e.engineBrakeTorque * (0.2 + 0.8 * clamp(rpm / e.redlineRpm, 0, 1.3));
    return thr * full - (1 - thr) * drag;
  }

  // ---------------------------------------------------------------------------
  // Main step
  // ---------------------------------------------------------------------------

  step(dt: number, input: DriveInput): void {
    const c = this.cfg;
    const m = c.mass;
    const L = c.wheelbase;
    const wheels = this.wheels;
    const ast = this.assists;

    // --- Pedals: with the automatic gearbox, the brake pedal selects reverse at standstill.
    let throttle = clamp(input.throttle, 0, 1);
    let brake = clamp(input.brake, 0, 1);
    if (ast.autoGear) {
      if (this.gear === -1) {
        throttle = clamp(input.brake, 0, 1);
        brake = clamp(input.throttle, 0, 1);
        if (input.throttle > 0.1 && input.brake < 0.05 && this.u > -0.8) this.setGear(1);
      } else {
        if (this.gear === 0) this.setGear(1);
        if (input.brake > 0.1 && input.throttle < 0.05 && Math.abs(this.u) < 0.5) {
          this.reverseTimer += dt;
          if (this.reverseTimer > 0.35) {
            this.setGear(-1);
            this.reverseTimer = 0;
          }
        } else {
          this.reverseTimer = 0;
        }
      }
    }
    this.appliedThrottle = throttle;
    this.appliedBrake = brake;
    const handbrake = clamp(input.handbrake, 0, 1);

    // --- Steering ---------------------------------------------------------
    const absU = Math.abs(this.u);
    let maxSteer = c.steering.maxAngle;
    if (ast.steerLimit && absU > 1) {
      // Kinematic angle for ~1 g at this speed + the peak slip angle of the front tire.
      const peak = c.tires.front.peakSlipAngle;
      maxSteer = Math.min(maxSteer, (L * G * c.tires.front.mu) / (absU * absU) + peak * 1.15);
    }
    let steerTarget = -clamp(input.steer, -1, 1) * maxSteer;
    if (ast.counterSteer > 0 && this.u > 4) {
      const beta = Math.atan2(this.v, this.u); // body slip angle, + = sliding left
      steerTarget += clamp(beta * ast.counterSteer, -0.25, 0.25);
      steerTarget = clamp(steerTarget, -c.steering.maxAngle, c.steering.maxAngle);
    }
    // Rack speed limit (~5 rad/s at the road wheel).
    this.steerAngle = approach(this.steerAngle, steerTarget, 5 * dt);
    const delta = this.steerAngle;
    if (Math.abs(delta) > 1e-4) {
      // Ackermann geometry: the inner wheel steers more.
      const R = L / Math.tan(delta);
      wheels[0].steer = Math.atan(L / (R - c.trackFront / 2));
      wheels[1].steer = Math.atan(L / (R + c.trackFront / 2));
    } else {
      wheels[0].steer = wheels[1].steer = delta;
    }

    // --- Vertical loads ---------------------------------------------------
    const q = 0.5 * AIR_DENSITY * this.u * this.u;
    const dfF = (q * c.aero.clAFront) / 2;
    const dfR = (q * c.aero.clARear) / 2;
    const longT = (m * this.axF * c.cgHeight) / L / 2;
    const rsf = c.suspension.rollStiffnessFront;
    const latF = (m * this.ayF * c.cgHeight * rsf) / c.trackFront;
    const latR = (m * this.ayF * c.cgHeight * (1 - rsf)) / c.trackRear;
    wheels[0].fz = Math.max(0, wheels[0].staticLoad - longT + dfF - latF);
    wheels[1].fz = Math.max(0, wheels[1].staticLoad - longT + dfF + latF);
    wheels[2].fz = Math.max(0, wheels[2].staticLoad + longT + dfR - latR);
    wheels[3].fz = Math.max(0, wheels[3].staticLoad + longT + dfR + latR);

    // --- Traction control (uses last step's slip) ------------------------------
    let maxDrivenKappa = 0;
    for (const w of wheels) {
      if (this.isDriven(w)) maxDrivenKappa = Math.max(maxDrivenKappa, w.kappa);
    }
    // PI controller on the driven wheels' slip ratio. The integral term finds the torque the
    // surface can take; the proportional term damps the (very fast) wheel-spin dynamics.
    if (ast.tc && throttle > 0.05) {
      const err = maxDrivenKappa - c.tires.rear.peakSlipRatio * 1.1;
      this.tcIntegral = clamp(this.tcIntegral - err * (err > 0 ? 30 : 6) * dt, 0.05, 1);
      this.tcFactor = clamp(this.tcIntegral - Math.max(0, err) * 3, 0.02, 1);
    } else {
      this.tcIntegral = approach(this.tcIntegral, 1, 2 * dt);
      this.tcFactor = 1;
    }
    this.tcActive = ast.tc && this.tcFactor < 0.97 && throttle > 0.05;

    // --- ESP: yaw-rate control by individual wheel braking ---------------------
    const espBrake = [0, 0, 0, 0];
    let espThrottle = 1;
    this.espActive = false;
    if (ast.esp && this.u > 6) {
      const vch = 24; // characteristic speed of a slightly understeering car
      const muAvg = (c.tires.front.mu + c.tires.rear.mu) * 0.5 * this.surfaceGrip;
      let rTarget = (this.u * delta) / (L * (1 + (this.u / vch) ** 2));
      const rMax = (0.95 * G * muAvg) / this.u;
      rTarget = clamp(rTarget, -rMax, rMax);
      const e = this.r - rTarget;
      const dead = 0.05;
      if (Math.abs(e) > dead) {
        const excess = Math.abs(e) - dead;
        const torque = clamp(excess * 9000, 0, 2400);
        const oversteer = e * this.r > 0; // rotating more than wanted
        const brakeRight = e > 0; // need a clockwise (negative) yaw moment
        const idx = oversteer ? (brakeRight ? WheelId.FR : WheelId.FL) : brakeRight ? WheelId.RR : WheelId.RL;
        espBrake[idx] = torque;
        espThrottle = clamp(1 - excess * 2.5, 0.25, 1);
        this.espActive = true;
      }
    }

    // --- Engine, clutch, gearbox ------------------------------------------------
    const eng = c.engine;
    const gb = c.gearbox;
    if (this.shiftCooldown > 0) this.shiftCooldown -= dt;
    const thrEff = throttle * this.tcFactor * espThrottle;
    const ratio = this.totalRatio(this.gear);
    const rpmIn = this.drivetrainOmega() * ratio * RADS_TO_RPM;
    const lockRpm = eng.idleRpm + 450;
    let clutchTorque = 0;
    this.clutchSlipping = false;
    if (this.shiftTimer > 0) this.shiftTimer -= dt;
    if (this.gear === 0 || this.shiftTimer > 0) {
      // Clutch open: engine spins freely; during a shift it is synchronised to the new gear.
      if (this.gear !== 0 && rpmIn > eng.idleRpm) {
        this.engineRpm = lerp(this.engineRpm, rpmIn, smoothFactor(dt, 0.03));
        this.engineTorque = 0;
      } else {
        const tq = this.crankTorque(this.engineRpm, thrEff);
        const idleTq = this.engineRpm < eng.idleRpm ? (eng.idleRpm - this.engineRpm) * 0.5 : 0;
        this.engineRpm += ((tq + idleTq) / eng.inertia) * RADS_TO_RPM * dt;
        this.engineTorque = tq;
      }
    } else if (rpmIn < lockRpm) {
      // Clutch slipping: launch / creeping. Engine held at a launch rpm that rises with throttle.
      this.clutchSlipping = true;
      const target = lerp(eng.idleRpm, eng.launchRpm, thrEff);
      this.engineRpm = lerp(this.engineRpm, target, smoothFactor(dt, 0.12));
      let tq = this.crankTorque(this.engineRpm, thrEff);
      if (tq < 0) tq *= clamp(rpmIn / lockRpm, 0, 1); // little engine braking while slipping
      const creep = ast.autoGear ? 45 * clamp(1 - rpmIn / lockRpm, 0, 1) : 0;
      clutchTorque = clamp(Math.max(tq, creep), -gb.clutchCapacity, gb.clutchCapacity);
      this.engineTorque = clutchTorque;
    } else {
      // Clutch locked: engine speed follows the wheels.
      this.engineRpm = rpmIn;
      clutchTorque = this.crankTorque(this.engineRpm, thrEff);
      this.engineTorque = clutchTorque;
    }
    this.engineRpm = clamp(this.engineRpm, eng.idleRpm * 0.6, eng.redlineRpm + 600);

    // --- Distribute drive torque -----------------------------------------------
    const wheelTorque = clutchTorque * ratio * gb.efficiency;
    let frontT = 0;
    let rearT = 0;
    if (c.drive === 'FWD') frontT = wheelTorque;
    else if (c.drive === 'RWD') rearT = wheelTorque;
    else {
      // Centre differential with a viscous/multi-plate coupling: torque moves towards the
      // axle that is turning slower (the one with grip), like quattro/ATTESA systems.
      const d = c.differential;
      const wf = (wheels[0].omega + wheels[1].omega) / 2;
      const wr = (wheels[2].omega + wheels[3].omega) / 2;
      const lim = Math.abs(wheelTorque) * d.centerMaxLockFraction;
      const transfer = clamp(d.centerLockingCoefficient * (wr - wf), -lim, lim);
      frontT = wheelTorque * d.frontTorqueSplit + transfer;
      rearT = wheelTorque - frontT;
    }
    if (handbrake > 0.3) {
      // Pulling the handbrake disengages drive to the rear axle (avoids fighting the engine).
      if (c.drive === 'AWD') frontT = wheelTorque * c.differential.frontTorqueSplit;
      rearT = 0;
    }
    this.splitAxle(wheels[0], wheels[1], frontT);
    this.splitAxle(wheels[2], wheels[3], rearT);

    // --- Brakes + ABS --------------------------------------------------------
    this.absActive = false;
    for (const w of wheels) {
      const maxT = w.front ? c.brakes.maxTorqueFront : c.brakes.maxTorqueRear;
      if (ast.abs && brake > 0.05 && Math.abs(this.u) > 2) {
        // Pressure modulator regulating the slip ratio just past the tire's peak,
        // dumping fast when the wheel starts to lock and re-applying more gently.
        const err = -w.kappa - w.tire.peakSlipRatio * 1.1;
        const rate = err > 0 ? 80 : 25;
        w.absFactor = clamp(w.absFactor - err * rate * dt, 0.05, 1);
        if (w.absFactor < 0.98) this.absActive = true;
      } else {
        w.absFactor = 1;
      }
      w.brakeTorque = brake * maxT * w.absFactor + espBrake[w.id];
      if (!w.front) w.brakeTorque += handbrake * c.brakes.handbrakeTorque;
    }

    // --- Tires ---------------------------------------------------------------
    let sumFx = 0;
    let sumFy = 0;
    let sumMz = 0;
    const grip = this.surfaceGrip;
    for (const w of wheels) {
      const p = w.tire;
      const R = p.radius;
      const vx = this.u - this.r * w.y;
      const vy = this.v + this.r * w.x;
      const cs = Math.cos(w.steer);
      const sn = Math.sin(w.steer);
      const vlong = vx * cs + vy * sn;
      const vlat = -vx * sn + vy * cs;
      const vAbs = Math.abs(vlong);

      // Slip angle with relaxation length (first-order lag over distance travelled).
      const alphaTarget = Math.atan(vlat / Math.max(vAbs, ALPHA_REF_SPEED));
      const travel = Math.max(Math.hypot(vlong, vlat), 1.5) * dt;
      w.alpha += (alphaTarget - w.alpha) * Math.min(1, travel / p.relaxationLength);

      const vref = Math.max(vAbs, SLIP_REF_SPEED);
      w.kappa = (w.omega * R - vlong) / vref;
      tireForce(p, w.B, w.kappa, w.alpha, w.fz, grip, tmpForce);
      w.fx = tmpForce.fx;
      w.fy = tmpForce.fy;
      w.rho = tmpForce.rho;
      w.slipSpeed = Math.hypot(w.omega * R - vlong, vlat);

      // Rolling resistance acts on the body, opposite to the rolling direction.
      const rr = -p.rollingResistance * w.fz * Math.tanh(vlong / 0.5);
      const fxw = w.fx + rr;
      const fbx = fxw * cs - w.fy * sn;
      const fby = fxw * sn + w.fy * cs;
      sumFx += fbx;
      sumFy += fby;
      sumMz += w.x * fby - w.y * fbx;

      // Wheel spin: implicit integration (tire force linearised around the current slip)
      // so the stiff wheel/tire loop stays stable at any speed.
      const eps = 0.002;
      tireForce(p, w.B, w.kappa + eps, w.alpha, w.fz, grip, tmpForce2);
      const dFdk = Math.max(0, (tmpForce2.fx - w.fx) / eps);
      const dFdw = (dFdk * R) / vref;
      const denom = p.inertia + dt * R * dFdw;
      let omega = w.omega + (dt * (w.driveTorque - w.fx * R)) / denom;
      const brakeDelta = (dt * w.brakeTorque) / denom;
      if (Math.abs(omega) <= brakeDelta) omega = 0;
      else omega -= Math.sign(omega) * brakeDelta;
      w.omega = omega;
      w.spin = (w.spin + omega * dt) % (Math.PI * 2);

      w.travel = clamp(
        (w.fz - w.staticLoad) / (w.front ? c.suspension.wheelRateFront : c.suspension.wheelRateRear),
        -0.08,
        0.08,
      );
    }

    // --- Aerodynamic drag ------------------------------------------------------
    sumFx -= 0.5 * AIR_DENSITY * c.aero.cdA * this.u * Math.abs(this.u);

    // --- Integrate the body ---------------------------------------------------------
    const ax = sumFx / m;
    const ay = sumFy / m;
    this.u += (ax + this.v * this.r) * dt;
    this.v += (ay - this.u * this.r) * dt;
    this.r += (sumMz / c.yawInertia) * dt;
    const k = smoothFactor(dt, 0.05);
    this.axF += (ax - this.axF) * k;
    this.ayF += (ay - this.ayF) * k;

    const sy = Math.sin(this.yaw);
    const cy = Math.cos(this.yaw);
    this.x += (this.u * sy + this.v * cy) * dt;
    this.z += (this.u * cy - this.v * sy) * dt;
    this.yaw += this.r * dt;

    // --- Visual body motion (damped spring towards the load-transfer attitude) ---
    const s = c.suspension;
    const wn = 2 * Math.PI * s.bodyFrequency;
    const rollT = s.rollGradient * DEG * (this.ayF / G);
    const pitchT = -s.pitchGradient * DEG * (this.axF / G);
    this.rollVel += (wn * wn * (rollT - this.roll) - 2 * s.bodyDamping * wn * this.rollVel) * dt;
    this.roll += this.rollVel * dt;
    this.pitchVel += (wn * wn * (pitchT - this.pitch) - 2 * s.bodyDamping * wn * this.pitchVel) * dt;
    this.pitch += this.pitchVel * dt;

    if (ast.autoGear) this.autoGearbox(throttle, brake);
  }

  private isDriven(w: Wheel): boolean {
    const d = this.cfg.drive;
    return d === 'AWD' || (d === 'FWD' ? w.front : !w.front);
  }

  /** Split an axle's torque between its wheels through a limited-slip differential. */
  private splitAxle(left: Wheel, right: Wheel, torque: number): void {
    const d = this.cfg.differential;
    const maxTransfer = Math.abs(torque) * d.maxLockFraction;
    const transfer = clamp(d.lockingCoefficient * (left.omega - right.omega), -maxTransfer, maxTransfer);
    left.driveTorque = torque / 2 - transfer;
    right.driveTorque = torque / 2 + transfer;
  }

  // ---------------------------------------------------------------------------
  // Helpers used by collisions, cameras, HUD and tests
  // ---------------------------------------------------------------------------

  /** Friction coefficient currently available at a wheel (HUD / debug). */
  wheelMu(w: Wheel): number {
    return effectiveMu(w.tire, w.fz, this.surfaceGrip);
  }

  /** World-space velocity (X, Z). */
  worldVelocity(): [number, number] {
    const sy = Math.sin(this.yaw);
    const cy = Math.cos(this.yaw);
    return [this.u * sy + this.v * cy, this.u * cy - this.v * sy];
  }

  setWorldVelocity(vx: number, vz: number): void {
    const sy = Math.sin(this.yaw);
    const cy = Math.cos(this.yaw);
    this.u = vx * sy + vz * cy;
    this.v = vx * cy - vz * sy;
  }

  /** Transform a body-frame point (forward, left) to world XZ. */
  bodyToWorld(fwd: number, left: number): [number, number] {
    const sy = Math.sin(this.yaw);
    const cy = Math.cos(this.yaw);
    return [this.x + fwd * sy + left * cy, this.z + fwd * cy - left * sy];
  }

  /**
   * Apply an impulse (N·s) at a world point. Used by collisions.
   * Torque about +Y: τ = rz·Fx − rx·Fz (rx, rz = lever arm in world XZ).
   */
  applyImpulse(px: number, pz: number, jx: number, jz: number): void {
    const [vx, vz] = this.worldVelocity();
    this.setWorldVelocity(vx + jx / this.cfg.mass, vz + jz / this.cfg.mass);
    const rx = px - this.x;
    const rz = pz - this.z;
    this.r += (rz * jx - rx * jz) / this.cfg.yawInertia;
  }

  /** World velocity of a point attached to the body. */
  pointVelocity(px: number, pz: number): [number, number] {
    const [vx, vz] = this.worldVelocity();
    const rx = px - this.x;
    const rz = pz - this.z;
    return [vx + this.r * rz, vz - this.r * rx];
  }
}
