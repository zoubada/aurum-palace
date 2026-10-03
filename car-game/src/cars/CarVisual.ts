import * as THREE from 'three';
import { mergeStatic } from './mergeStatic';
import type { CarConfig, PaintOption } from './types';
import type { Vehicle } from '../physics/vehicle';
import type { CarParts } from './parts';
import type { EngineEventFrame } from './EngineEvents';
import { buildPlaceholder } from './procedural/buildPlaceholder';
import { drawDash } from './dashboards';
import { radialTexture } from '../render/textures';

/**
 * Visual representation of a car, driven by the physics (SPEC §4 "Animations"):
 * body pitch/roll and ride height, wheel spin and steering (Ackermann angles), steering wheel,
 * brake / reverse lights, glowing brake discs, active wing, exhaust flames on backfires,
 * brand instrument cluster, doors (garage).
 *
 * The model comes from `parts`: the procedural placeholder by default, or a real glTF model
 * (src/cars/gltf.ts) through `setParts` once it has loaded.
 *
 * Car space: x = left, y = up, z = forward, origin on the ground under the CG.
 */
const Y_AXIS = new THREE.Vector3(0, 1, 0);

export class CarVisual {
  readonly root = new THREE.Group();
  /** Pitch/roll pivot placed at CG height. */
  readonly body = new THREE.Group();
  parts!: CarParts;
  private readonly shellHolder = new THREE.Group();
  private readonly wheelHolder = new THREE.Group();
  private readonly flames: THREE.Mesh[] = [];
  private flameTimer = 0;
  private readonly discTemp = [0, 0, 0, 0];
  private dashTimer = 0;
  private doorsTarget = 0;
  private doorsOpen = 0;
  private readonly tmpQ = new THREE.Quaternion();
  private readonly tmpQ2 = new THREE.Quaternion();
  private readonly tmpN = new THREE.Vector3();
  private night = false;
  private simplified = false;
  readonly isPlaceholder: boolean;

  constructor(
    readonly config: CarConfig,
    vehicle: Vehicle,
  ) {
    const cg = config.physics.cgHeight;
    this.body.position.y = cg;
    this.shellHolder.position.y = -cg;
    this.body.add(this.shellHolder);
    this.root.add(this.body, this.wheelHolder);
    this.isPlaceholder = true;
    this.setParts(buildPlaceholder(config, vehicle.a, vehicle.b));
    this.buildContactShadow();
    this.buildFlames();
  }

  /** Swap the model (placeholder → real glTF). Keeps paint choices. */
  setParts(parts: CarParts): void {
    const old = this.parts;
    if (old) {
      this.shellHolder.remove(old.body);
      for (const w of old.wheels) this.wheelHolder.remove(w.pivot);
      disposeTree(old.body);
      for (const w of old.wheels) disposeTree(w.pivot);
    }
    this.parts = parts;
    this.shellHolder.add(parts.body);
    for (const w of parts.wheels) this.wheelHolder.add(w.pivot);
    (this as { isPlaceholder: boolean }).isPlaceholder = parts.body.name === 'placeholder-body';
    this.placeFlames();
    this.setNight(this.night);
    // Factory paint and rims of the configuration (the garage / session may override later).
    const v = this.config.visual;
    const paint = v.paints.find((x) => x.color === v.paint);
    if (paint) this.setPaint(paint);
    this.setRim(v.rim);
  }

  /**
   * Opponent car seen from outside: merge static meshes by material (far fewer draw calls) and
   * stop drawing its dashboard.
   */
  simplify(): void {
    this.simplified = true;
    const p = this.parts;
    const keep = new Set<THREE.Object3D>();
    if (p.wing) keep.add(p.wing.pivot);
    for (const d of p.doors) keep.add(d.pivot);
    if (p.steeringWheel) keep.add(p.steeringWheel);
    mergeStatic(p.body, keep);
    for (const w of p.wheels) {
      mergeStatic(w.spin, new Set());
      mergeStatic(w.pivot, new Set([w.spin]));
    }
  }

  /** Night: headlamp glass lit at full power. */
  setNight(on: boolean): void {
    this.night = on;
    for (const m of this.parts.headLights) {
      const base = (m.userData.baseEmissive ??= m.emissiveIntensity) as number;
      m.emissiveIntensity = on ? Math.max(base, 8) : base;
    }
  }

  /** Driver eye in car space. */
  get eye(): [number, number, number] {
    return this.parts.eye;
  }

  // ---------------------------------------------------------------------------
  // Customisation (garage)
  // ---------------------------------------------------------------------------

  setPaint(p: PaintOption): void {
    for (const m of this.parts.paint) {
      m.color.setHex(p.color);
      m.metalness = 0.15 + p.metallic * 0.6;
      m.roughness = 0.38 - p.metallic * 0.12;
    }
  }

  setRim(color: number): void {
    for (const m of this.parts.rims) m.color.setHex(color);
  }

  setDoorsOpen(open: boolean): void {
    this.doorsTarget = open ? 1 : 0;
  }

  setCockpitView(cockpit: boolean): void {
    for (const o of this.parts.hiddenInCockpit) o.visible = !cockpit;
  }

  // ---------------------------------------------------------------------------

  private buildContactShadow(): void {
    const v = this.config.visual;
    const mat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      alphaMap: radialTexture(128, 0.35),
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(v.width * 1.25, v.length * 1.1), mat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(0, 0.012, (v.frontOverhangFromCg - v.rearOverhangFromCg) / 2);
    plane.renderOrder = 1;
    this.root.add(plane);
  }

  private buildFlames(): void {
    const geo = new THREE.ConeGeometry(0.06, 0.38, 12, 1, true);
    geo.translate(0, -0.19, 0);
    geo.rotateX(-Math.PI / 2); // tip points backwards (−z)
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffa040,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Mesh(geo, mat);
      f.visible = false;
      this.flames.push(f);
      this.shellHolder.add(f);
    }
  }

  private placeFlames(): void {
    this.flames.forEach((f, i) => {
      const tip = this.parts.exhaustTips[i];
      f.visible = false;
      if (tip) f.position.copy(tip);
    });
  }

  // ---------------------------------------------------------------------------

  update(vehicle: Vehicle, dt: number, ev?: EngineEventFrame): void {
    const p = this.parts;
    // Follow the road surface: heading, then tilt onto the ground normal (slopes, banking).
    this.root.position.set(vehicle.x, vehicle.y, vehicle.z);
    const gr = vehicle.ground;
    this.tmpQ.setFromAxisAngle(Y_AXIS, vehicle.yaw);
    this.tmpQ2.setFromUnitVectors(Y_AXIS, this.tmpN.set(gr.nx, gr.ny, gr.nz));
    this.root.quaternion.multiplyQuaternions(this.tmpQ2, this.tmpQ);
    this.body.rotation.set(vehicle.pitch, 0, vehicle.roll, 'YXZ');
    let travel = 0;
    for (const w of vehicle.wheels) travel += w.travel;
    this.body.position.y = this.config.physics.cgHeight - (travel / 4) * 0.6;

    vehicle.wheels.forEach((w, i) => {
      const node = p.wheels[i];
      node.pivot.rotation.y = w.steer;
      node.spin.rotation.x = w.spin;
      // Brake disc temperature: heated by braking power, cooled by airflow.
      const power = w.brakeTorque * Math.abs(w.omega);
      const speed = Math.abs(vehicle.u);
      this.discTemp[i] += (power / 9000 - this.discTemp[i] * (0.08 + speed * 0.004)) * dt;
      this.discTemp[i] = Math.max(0, this.discTemp[i]);
      if (node.disc) node.disc.emissiveIntensity = Math.max(0, Math.min(3, (this.discTemp[i] - 4) * 0.25));
    });

    if (p.steeringWheel) {
      const s = this.config.physics.steering;
      p.steeringWheel.rotation.z = THREE.MathUtils.degToRad(s.steeringWheelMaxDeg) * (-vehicle.steerAngle / s.maxAngle);
    }
    if (p.wing) p.wing.pivot.rotation.x = THREE.MathUtils.lerp(p.wing.rest, p.wing.deployed, vehicle.wingDeploy);

    const braking = vehicle.appliedBrake > 0.05;
    for (const m of p.brakeLights) m.emissiveIntensity = braking ? 6 : 0.9;
    for (const m of p.reverseLights) m.emissiveIntensity = vehicle.gear === -1 ? 4 : 0;

    // Exhaust flames: a short flash per backfire.
    if (ev && ev.pops > 0) this.flameTimer = 0.07 + Math.random() * 0.05;
    this.flameTimer = Math.max(0, this.flameTimer - dt);
    this.flames.forEach((f, i) => {
      const on = this.flameTimer > 0 && i < p.exhaustTips.length;
      f.visible = on;
      if (on) f.scale.setScalar(0.6 + Math.random() * 0.8);
    });

    // Doors (garage).
    if (p.doors.length) {
      this.doorsOpen += (this.doorsTarget - this.doorsOpen) * Math.min(1, dt * 3);
      for (const d of p.doors) d.pivot.quaternion.copy(this.tmpQ.setFromAxisAngle(d.axis, d.angle * smooth(this.doorsOpen)));
    }

    if (p.dash && !this.simplified) {
      this.dashTimer -= dt;
      if (this.dashTimer <= 0) {
        this.dashTimer = 1 / 20;
        drawDash(p.dash.canvas.getContext('2d')!, this.config.visual.dash, {
          speedKmh: vehicle.speedKmh,
          rpm: vehicle.engineRpm,
          redline: this.config.physics.engine.redlineRpm,
          gear: vehicle.gear,
          boost: ev?.boost ?? 0,
          autoGear: vehicle.assists.autoGear,
        });
        p.dash.texture.needsUpdate = true;
      }
    }
  }

  dispose(): void {
    disposeTree(this.root);
  }
}

const smooth = (t: number) => t * t * (3 - 2 * t);

function disposeTree(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry.dispose();
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
      mat.dispose();
    }
  });
}
