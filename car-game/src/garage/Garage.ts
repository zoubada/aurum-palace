import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { AppContext, Screen } from '../core/App';
import { CARS, getCar } from '../cars/registry';
import type { CarConfig } from '../cars/types';
import { Vehicle } from '../physics/vehicle';
import { CarVisual } from '../cars/CarVisual';
import { loadCarModel, modelAvailable } from '../cars/gltf';
import { applySetup, loadSetup, saveSetup, type CarSetup } from '../cars/setup';
import { GarageUI } from './GarageUI';

/**
 * Garage / showroom (SPEC §4, §9): the car on a turntable under studio lighting, orbit camera,
 * spec sheet with comparison, paint / rims, setup. "Rouler" starts a drive session.
 */
export class Garage implements Screen {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
  private readonly ui: GarageUI;
  private readonly key: THREE.SpotLight;
  private readonly turntable = new THREE.Group();
  private car!: CarConfig;
  private vehicle!: Vehicle;
  private visual: CarVisual | null = null;
  private setup!: CarSetup;
  private envRT: THREE.WebGLRenderTarget;
  private doorsOpen = false;
  private loadToken = 0;

  // Orbit camera.
  private azimuth = 0.75;
  private elevation = 0.16;
  private distance = 8.5;
  private autoRotate = true;
  private dragging: { x: number; y: number } | null = null;
  private idleTimer = 0;
  private readonly onPointerDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement).id !== 'scene') return;
    this.dragging = { x: e.clientX, y: e.clientY };
    this.autoRotate = false;
  };
  private readonly onPointerMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    this.azimuth -= (e.clientX - this.dragging.x) * 0.006;
    this.elevation = THREE.MathUtils.clamp(this.elevation + (e.clientY - this.dragging.y) * 0.004, 0.02, 0.85);
    this.dragging = { x: e.clientX, y: e.clientY };
    this.idleTimer = 0;
  };
  private readonly onPointerUp = () => {
    this.dragging = null;
    this.idleTimer = 0;
  };
  private readonly onWheel = (e: WheelEvent) => {
    if ((e.target as HTMLElement).id !== 'scene') return;
    this.distance = THREE.MathUtils.clamp(this.distance * (1 + Math.sign(e.deltaY) * 0.08), 6, 18);
  };

  constructor(
    private readonly app: AppContext,
    carId: string,
  ) {
    const s = this.scene;
    s.background = new THREE.Color(0x0b0d11);
    s.fog = new THREE.Fog(0x0b0d11, 18, 40);

    // Studio image-based lighting: soft boxes reflected in the paint.
    const pmrem = new THREE.PMREMGenerator(app.renderer.renderer);
    this.envRT = pmrem.fromScene(new RoomEnvironment(), 0.03);
    pmrem.dispose();
    s.environment = this.envRT.texture;
    s.environmentIntensity = 0.55;

    // Key light with soft shadows, cool rim lights behind.
    this.key = new THREE.SpotLight(0xffffff, 45, 30, 0.7, 1, 1.4);
    this.key.position.set(1.5, 10, 1.5);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.bias = -0.0006;
    this.key.shadow.normalBias = 0.02;
    s.add(this.key, this.key.target);
    for (const [x, z, c] of [
      [-6, -5, 0x9fc4ff],
      [6, -6, 0xffd9b0],
    ] as const) {
      const rim = new THREE.SpotLight(c, 70, 30, 0.6, 0.8, 1.6);
      rim.position.set(x, 4, z);
      s.add(rim);
    }

    // Floor and turntable.
    const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.MeshStandardMaterial({ color: 0x14171c, roughness: 0.62, metalness: 0.05 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.035; // below the turntable top (avoids z-fighting)
    floor.receiveShadow = true;
    s.add(floor);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.65, 0.06, 96), new THREE.MeshStandardMaterial({ color: 0x1b1f26, roughness: 0.3, metalness: 0.4 }));
    disc.position.y = -0.03;
    disc.receiveShadow = true;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.63, 0.012, 8, 160), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffcf3f, emissiveIntensity: 1.2 }));
    ring.rotation.x = Math.PI / 2;
    s.add(disc, ring, this.turntable);

    this.ui = new GarageUI(app.uiRoot, {
      onSelect: (id) => this.selectCar(id),
      onSetup: (setup) => this.applySetup(setup),
      onDoors: () => {
        this.doorsOpen = !this.doorsOpen;
        this.visual?.setDoorsOpen(this.doorsOpen);
        return this.doorsOpen;
      },
      onDrive: (options) => app.drive(this.car.id, options),
      onQuality: (q) => app.setQuality(q),
    });
    this.ui.setQuality(app.quality.id);

    window.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('wheel', this.onWheel, { passive: true });
    this.selectCar(getCar(carId).id);
  }

  private selectCar(id: string): void {
    const car = getCar(id);
    this.car = car;
    this.setup = loadSetup(car);
    const configured = applySetup(car, this.setup);
    this.vehicle = new Vehicle(configured.physics);
    if (this.visual) {
      this.turntable.remove(this.visual.root);
      this.visual.dispose();
    }
    const visual = new CarVisual(configured, this.vehicle);
    // Centre the car on the turntable.
    visual.root.position.z = (car.visual.rearOverhangFromCg - car.visual.frontOverhangFromCg) / 2;
    this.visual = visual;
    this.doorsOpen = false;
    this.turntable.add(visual.root);
    this.ui.showCar(car, this.setup, CARS, visual.isPlaceholder);
    this.distance = 7 + car.visual.length * 1.3;
    void this.tryRealModel(configured);
  }

  private async tryRealModel(car: CarConfig): Promise<void> {
    const token = ++this.loadToken;
    const url = car.visual.model;
    if (!url || !(await modelAvailable(url))) return;
    try {
      const parts = await loadCarModel(url, car, this.vehicle.a, this.app.renderer.renderer);
      if (token !== this.loadToken || !this.visual) return;
      this.visual.setParts(parts);
      this.visual.setPaint(car.visual.paints[this.setup.paintIndex] ?? car.visual.paints[0]);
      this.visual.setRim(car.visual.rim);
      this.ui.setPlaceholder(false);
    } catch (err) {
      console.error(err);
    }
  }

  private applySetup(setup: CarSetup): void {
    this.setup = setup;
    saveSetup(this.car, setup);
    const v = this.car.visual;
    this.visual?.setPaint(v.paints[setup.paintIndex] ?? v.paints[0]);
    this.visual?.setRim((v.rimColors[setup.rimIndex] ?? v.rimColors[0]).color);
  }

  frame(dt: number): void {
    this.app.input.update(dt, 0);
    for (const a of this.app.input.consumeActions()) {
      if (a === 'menu') continue;
    }
    this.idleTimer += dt;
    if (!this.dragging && this.idleTimer > 4) this.autoRotate = true;
    if (this.autoRotate) this.azimuth += dt * 0.18;
    const target = new THREE.Vector3(0, 0.62, 0);
    const d = this.distance;
    this.camera.position.set(Math.sin(this.azimuth) * Math.cos(this.elevation) * d, 0.4 + Math.sin(this.elevation) * d, Math.cos(this.azimuth) * Math.cos(this.elevation) * d);
    this.camera.lookAt(target);
    if (this.visual) this.visual.update(this.vehicle, dt);
  }

  onResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    // Centre the car in the space left between the car list and the spec panel.
    if (w > 900) this.camera.setViewOffset(w, h, Math.round(w * 0.04), 0, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  onQualityChanged(): void {
    this.key.shadow.mapSize.setScalar(this.app.quality.shadowMapSize >= 2048 ? 2048 : 1024);
    this.key.shadow.map?.dispose();
    this.key.shadow.map = null;
  }

  dispose(): void {
    window.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('wheel', this.onWheel);
    this.ui.dispose();
    this.visual?.dispose();
    this.envRT.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
  }
}
