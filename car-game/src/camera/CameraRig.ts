import * as THREE from 'three';
import type { Vehicle } from '../physics/vehicle';
import type { CarVisual } from '../cars/CarVisual';
import { G, clamp, smoothFactor } from '../physics/math';

/**
 * Driving cameras (SPEC §6), switchable on the fly:
 * cockpit, hood, front bumper, chase (Forza/GTA style) and far chase,
 * plus "look behind" for every view. Replay cameras and photo mode: Phase 6.
 */

export type CameraModeId = 'cockpit' | 'hood' | 'bumper' | 'chase' | 'far';

export const CAMERA_MODES: Array<{ id: CameraModeId; label: string }> = [
  { id: 'chase', label: 'Poursuite' },
  { id: 'far', label: 'Poursuite éloignée' },
  { id: 'cockpit', label: 'Cockpit' },
  { id: 'hood', label: 'Capot' },
  { id: 'bumper', label: 'Pare-chocs' },
];

export interface CameraSettings {
  /** Chase distance behind the car (m). */
  distance: number;
  /** Chase height (m). */
  height: number;
  /** Base vertical field of view (deg). */
  fov: number;
  /** Extra FOV at high speed (deg). */
  speedFov: number;
}

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  modeIndex = 0;
  settings: CameraSettings = { distance: 5.6, height: 1.75, fov: 60, speedFov: 12 };

  private camYaw = 0;
  private initialised = false;
  private readonly head = new THREE.Vector3();
  private readonly headVel = new THREE.Vector3();
  private readonly tmpV = new THREE.Vector3();
  private readonly tmpV2 = new THREE.Vector3();
  private readonly tmpQ = new THREE.Quaternion();
  private readonly flip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
  private readonly tilt = new THREE.Quaternion();

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 9000);
  }

  get mode(): CameraModeId {
    return CAMERA_MODES[this.modeIndex].id;
  }

  get label(): string {
    return CAMERA_MODES[this.modeIndex].label;
  }

  setMode(id: CameraModeId): void {
    this.modeIndex = Math.max(0, CAMERA_MODES.findIndex((m) => m.id === id));
    this.initialised = false;
  }

  next(): void {
    this.modeIndex = (this.modeIndex + 1) % CAMERA_MODES.length;
    this.initialised = false;
  }

  /** Snap the chase camera behind the car (after a reset). */
  snap(): void {
    this.initialised = false;
  }

  update(dt: number, vehicle: Vehicle, visual: CarVisual, lookBack: boolean): void {
    const cam = this.camera;
    const mode = this.mode;
    const speed = Math.hypot(vehicle.u, vehicle.v);
    visual.setCockpitView(mode === 'cockpit' && !lookBack);
    visual.root.updateMatrixWorld(true);

    const speedFov = this.settings.speedFov * Math.pow(clamp(speed / 85, 0, 1), 1.3);
    let fov = this.settings.fov + speedFov;
    let near = 0.1;

    if (mode === 'chase' || mode === 'far') {
      const far = mode === 'far';
      let target = vehicle.yaw;
      if (speed > 4 && vehicle.u > 0) {
        // Look partly along the velocity: during a drift the camera shows where the car is going.
        const [vx, vz] = vehicle.worldVelocity();
        target = vehicle.yaw + wrapAngle(Math.atan2(vx, vz) - vehicle.yaw) * 0.45;
      }
      if (!this.initialised) {
        this.camYaw = target;
        this.initialised = true;
      }
      this.camYaw += wrapAngle(target - this.camYaw) * smoothFactor(dt, far ? 0.32 : 0.22);
      const yaw = this.camYaw + (lookBack ? Math.PI : 0);
      const dist = this.settings.distance * (far ? 1.75 : 1) + clamp(vehicle.axF / G, -1, 1) * 0.3;
      const height = this.settings.height * (far ? 1.55 : 1);
      cam.position.set(vehicle.x - Math.sin(yaw) * dist, height, vehicle.z - Math.cos(yaw) * dist);
      this.tmpV.set(vehicle.x + Math.sin(yaw) * 2, 0.95, vehicle.z + Math.cos(yaw) * 2);
      cam.up.set(0, 1, 0);
      cam.lookAt(this.tmpV);
    } else {
      // Car-mounted cameras follow the body (pitch and roll included).
      const cg = visual.config.physics.cgHeight;
      let local: [number, number, number];
      if (mode === 'cockpit') {
        local = visual.eye;
        near = 0.03;
        fov += 4;
      } else if (mode === 'hood') {
        local = [0, visual.eye[1] - 0.04, visual.eye[2] + 1.05];
      } else {
        local = [0, 0.48, visual.config.visual.frontOverhangFromCg + 0.05];
        fov += 4;
      }
      // Head motion from G-forces (cockpit only), as a damped spring.
      const headTarget = this.tmpV2.set(0, 0, 0);
      if (mode === 'cockpit') {
        headTarget.set(-clamp(vehicle.ayF / G, -1.5, 1.5) * 0.035, 0, -clamp(vehicle.axF / G, -1.5, 1.5) * 0.04);
      }
      const k = 140;
      const c = 2 * Math.sqrt(k) * 0.8;
      this.headVel.addScaledVector(headTarget.sub(this.head).multiplyScalar(k), dt);
      this.headVel.multiplyScalar(Math.max(0, 1 - c * dt));
      this.head.addScaledVector(this.headVel, dt);

      this.tmpV.set(local[0] + this.head.x, local[1] - cg + this.head.y, local[2] + this.head.z);
      visual.body.localToWorld(this.tmpV);
      cam.position.copy(this.tmpV);
      visual.body.getWorldQuaternion(this.tmpQ);
      if (!lookBack) this.tmpQ.multiply(this.flip);
      this.tilt.setFromAxisAngle(new THREE.Vector3(1, 0, 0), mode === 'cockpit' ? -0.06 : -0.02);
      this.tmpQ.multiply(this.tilt);
      cam.quaternion.copy(this.tmpQ);
      this.initialised = false;
    }
    cam.position.y = Math.max(cam.position.y, 0.15);

    if (Math.abs(cam.fov - fov) > 0.01 || cam.near !== near) {
      cam.fov = fov;
      cam.near = near;
      cam.updateProjectionMatrix();
    }
  }
}
