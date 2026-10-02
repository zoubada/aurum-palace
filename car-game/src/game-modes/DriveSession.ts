import * as THREE from 'three';
import { Environment } from '../render/Environment';
import { TireEffects } from '../render/Effects';
import { Mirrors } from '../render/Mirrors';
import { TestTrack } from '../tracks/TestTrack';
import { Vehicle, ASSIST_PRESETS, type Assists } from '../physics/vehicle';
import { collideWalls, outlinePoints } from '../physics/collision';
import { CarVisual } from '../cars/CarVisual';
import { EngineEvents } from '../cars/EngineEvents';
import { loadCarModel, modelAvailable } from '../cars/gltf';
import type { CarConfig } from '../cars/types';
import { CameraRig, type CameraModeId, type CameraSettings } from '../camera/CameraRig';
import { CarAudio } from '../audio/CarAudio';
import { HUD } from '../ui/HUD';
import { Menu } from '../ui/Menu';
import type { AppContext, Screen } from '../core/App';
import { ASSIST_LABELS, presetOf } from '../core/assists';
import { loadJSON, saveJSON } from '../core/storage';

/** Physics runs at a fixed 240 Hz, decoupled from the display refresh rate. */
const PHYSICS_DT = 1 / 240;
const MAX_STEPS_PER_FRAME = 24;

/** Free driving on the test track with one car (Phase 1–2). Race modes arrive in Phase 6. */
export class DriveSession implements Screen {
  readonly scene = new THREE.Scene();
  readonly vehicle: Vehicle;
  readonly rig: CameraRig;
  private readonly env: Environment;
  private readonly track: TestTrack;
  readonly visual: CarVisual;
  private readonly effects: TireEffects;
  private readonly events: EngineEvents;
  private mirrors: Mirrors;
  private carAudio: CarAudio | null = null;
  private readonly hud: HUD;
  private readonly menu: Menu;
  private readonly outline: Array<[number, number]>;
  private accumulator = 0;
  private paused = false;
  private hudVisible = true;
  private impact = 0;
  private disposed = false;
  /** Simulated time (s), advances only while not paused. */
  simTime = 0;
  private readonly focus = new THREE.Vector3();
  private readonly onVisibility = () => {
    if (document.hidden && !this.paused) this.setPaused(true);
  };

  constructor(
    private readonly app: AppContext,
    readonly car: CarConfig,
  ) {
    this.rig = new CameraRig(window.innerWidth / window.innerHeight);
    this.rig.settings = loadJSON<CameraSettings>('camera', this.rig.settings);
    this.rig.setMode(loadJSON<{ mode: CameraModeId }>('cameraMode', { mode: 'chase' }).mode);

    this.env = new Environment(this.scene, app.renderer.renderer, app.quality);
    this.track = new TestTrack(app.quality, app.renderer.maxAnisotropy);
    this.scene.add(this.track.group);

    this.vehicle = new Vehicle(car.physics);
    this.vehicle.assists = loadJSON<Assists>('assists', { ...ASSIST_PRESETS.intermediate });
    this.visual = new CarVisual(car, this.vehicle);
    this.scene.add(this.visual.root);
    this.mirrors = new Mirrors(this.visual);
    this.outline = outlinePoints(car.visual.frontOverhangFromCg, car.visual.rearOverhangFromCg, car.visual.width / 2);
    this.events = new EngineEvents(car.sound, car.physics.engine.redlineRpm);

    this.effects = new TireEffects();
    this.scene.add(this.effects.group);

    this.hud = new HUD(app.uiRoot, car.name, true);
    this.menu = new Menu(app.uiRoot, {
      onResume: () => this.setPaused(false),
      onReset: () => {
        this.resetCar();
        this.setPaused(false);
      },
      onGarage: () => app.goToGarage(),
      onAssists: (a) => this.setAssists(a),
      onQuality: (q) => app.setQuality(q),
      onCamera: (id) => {
        this.rig.setMode(id);
        saveJSON('cameraMode', { mode: id });
        this.updateInfo();
      },
      onCameraSettings: (s) => {
        this.rig.settings = s;
        saveJSON('camera', s);
      },
      onVolumes: (v) => app.audio.setVolumes(v),
    });

    app.audio.onReady(() => {
      if (!this.disposed) this.carAudio = new CarAudio(app.audio, car);
    });
    document.addEventListener('visibilitychange', this.onVisibility);

    this.resetCar();
    this.updateInfo();
    void this.loadRealModel();
  }

  get camera(): THREE.PerspectiveCamera {
    return this.rig.camera;
  }

  /** Replace the placeholder by the real glTF model when its file is present (SPEC §4). */
  private async loadRealModel(): Promise<void> {
    const url = this.car.visual.model;
    if (!url || !(await modelAvailable(url))) return;
    try {
      const parts = await loadCarModel(url, this.car, this.vehicle.a, this.app.renderer.renderer);
      if (this.disposed) return;
      this.visual.setParts(parts);
      this.mirrors.attach(this.visual);
      this.hud.setPlaceholderBanner(false);
    } catch (err) {
      console.error(err);
      this.hud.showToast('Modèle 3D illisible : voiture provisoire conservée');
    }
  }

  // ---------------------------------------------------------------------------

  private resetCar(): void {
    const s = this.track.spawn;
    this.vehicle.reset(s.x, s.z, s.yaw);
    this.effects.clear();
    this.track.resetCones();
    this.rig.snap();
  }

  private setPaused(p: boolean): void {
    this.paused = p;
    this.app.audio.setPaused(p);
    if (p) {
      this.menu.show({
        assists: this.vehicle.assists,
        quality: this.app.quality.id,
        camera: this.rig.mode,
        cameraSettings: this.rig.settings,
        device: this.app.input.device,
        volumes: this.app.audio.volumes,
      });
    } else {
      this.menu.hide();
    }
  }

  private setAssists(a: Assists): void {
    this.vehicle.assists = { ...a };
    saveJSON('assists', a);
    this.updateInfo();
  }

  onQualityChanged(): void {
    this.env.applyQuality(this.app.quality);
    this.track.applyQuality(this.app.quality);
    this.onResize();
    this.updateInfo();
  }

  onResize(): void {
    const h = this.app.renderer.renderer.getDrawingBufferSize(new THREE.Vector2()).y;
    this.effects.setViewport(h, this.rig.camera.fov);
  }

  private updateInfo(): void {
    const preset = presetOf(this.vehicle.assists);
    this.hud.setInfo([
      `Qualité ${this.app.quality.label} · Caméra ${this.rig.label}`,
      `Aides : ${preset ? ASSIST_LABELS[preset] : 'Personnalisées'}`,
      `${this.track.name}`,
    ]);
  }

  // ---------------------------------------------------------------------------

  private handleActions(): void {
    for (const action of this.app.input.consumeActions()) {
      if (action === 'menu') {
        this.setPaused(!this.paused);
        continue;
      }
      if (this.paused) continue;
      switch (action) {
        case 'shiftUp':
          this.vehicle.shiftUp();
          break;
        case 'shiftDown':
          this.vehicle.shiftDown();
          break;
        case 'camera':
          this.rig.next();
          saveJSON('cameraMode', { mode: this.rig.mode });
          this.hud.showToast(`Caméra : ${this.rig.label}`);
          this.updateInfo();
          break;
        case 'reset':
          this.resetCar();
          break;
        case 'hud':
          this.hudVisible = !this.hudVisible;
          this.hud.setVisible(this.hudVisible);
          break;
        case 'debug':
          this.hud.toggleDebug();
          break;
        case 'presetArcade':
        case 'presetIntermediate':
        case 'presetSimulation': {
          const id = action === 'presetArcade' ? 'arcade' : action === 'presetIntermediate' ? 'intermediate' : 'simulation';
          this.setAssists({ ...ASSIST_PRESETS[id] });
          this.hud.showToast(`Aides : ${ASSIST_LABELS[id]}`);
          break;
        }
      }
    }
  }

  frame(dt: number): void {
    const t0 = performance.now();
    const input = this.app.input;
    input.update(dt, this.vehicle.u);
    this.handleActions();
    let ev = null;

    if (!this.paused) {
      this.accumulator += dt;
      let steps = 0;
      this.impact = 0;
      while (this.accumulator >= PHYSICS_DT && steps < MAX_STEPS_PER_FRAME) {
        this.vehicle.step(PHYSICS_DT, input.drive);
        const hit = collideWalls(this.vehicle, this.outline, this.track.walls);
        if (hit) this.impact = Math.max(this.impact, hit.speed);
        this.accumulator -= PHYSICS_DT;
        this.simTime += PHYSICS_DT;
        steps++;
      }
      if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0; // too slow: drop time rather than spiral

      const v = this.car.visual;
      this.track.update(dt, this.vehicle, v.frontOverhangFromCg, v.rearOverhangFromCg, v.width / 2);
      this.effects.update(dt, this.vehicle);
      ev = this.events.update(dt, this.vehicle);

      // Rumble: impacts (strong motor) and tire slip (weak motor).
      let slip = 0;
      for (const w of this.vehicle.wheels) slip = Math.max(slip, Math.min(1, Math.max(0, (w.slipSpeed - 2) / 8)));
      input.rumble(Math.min(1, this.impact / 8), slip * 0.5, dt);
      if (this.impact > 1) this.carAudio?.impact(this.impact);
      if (this.impact > 6) this.hud.showToast('Choc !');
      if (this.carAudio) {
        this.carAudio.setInterior(this.rig.mode === 'cockpit' && !input.lookBack);
        this.carAudio.update(this.vehicle, ev);
      }
    }

    this.visual.update(this.vehicle, dt, ev ?? undefined);
    this.rig.update(dt, this.vehicle, this.visual, input.lookBack);
    this.focus.set(this.vehicle.x, 0, this.vehicle.z);
    this.env.follow(this.focus);
    const mode = this.rig.mode;
    this.mirrors.update(this.app.renderer.renderer, this.scene, this.visual, (mode === 'cockpit' || mode === 'hood') && !input.lookBack);
    this.hud.update(dt, this.vehicle, input.drive.steer);
    this.hud.perf.sim = performance.now() - t0;
  }

  onRendered(ms: number): void {
    this.hud.perf.render = ms;
  }

  dispose(): void {
    this.disposed = true;
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.carAudio?.dispose();
    this.app.audio.setPaused(false);
    this.mirrors.dispose();
    this.visual.dispose();
    this.hud.root.remove();
    this.menu.root.remove();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
  }
}
