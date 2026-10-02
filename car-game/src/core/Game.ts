import * as THREE from 'three';
import { Renderer } from '../render/Renderer';
import { Environment } from '../render/Environment';
import { TireEffects } from '../render/Effects';
import { TestTrack } from '../tracks/TestTrack';
import { Vehicle, ASSIST_PRESETS, type Assists } from '../physics/vehicle';
import { collideWalls, outlinePoints } from '../physics/collision';
import { CarVisual } from '../cars/CarVisual';
import { getCar } from '../cars/registry';
import type { CarConfig } from '../cars/types';
import { CameraRig, type CameraModeId, type CameraSettings } from '../camera/CameraRig';
import { Input } from './Input';
import { HUD } from '../ui/HUD';
import { Menu } from '../ui/Menu';
import { QUALITY_PRESETS, loadQuality, saveQuality, type QualityId, type QualitySettings } from './quality';
import { loadJSON, saveJSON } from './storage';

/** Physics runs at a fixed 240 Hz, decoupled from the display refresh rate. */
const PHYSICS_DT = 1 / 240;
const MAX_STEPS_PER_FRAME = 24;

export class Game {
  readonly scene = new THREE.Scene();
  readonly car: CarConfig;
  readonly vehicle: Vehicle;
  private readonly rig: CameraRig;
  private readonly renderer: Renderer;
  private readonly env: Environment;
  private readonly track: TestTrack;
  private readonly visual: CarVisual;
  private readonly effects: TireEffects;
  private readonly input: Input;
  private readonly hud: HUD;
  private readonly menu: Menu;
  private readonly outline: Array<[number, number]>;
  private quality: QualitySettings;
  private accumulator = 0;
  private lastTime = 0;
  private paused = false;
  private hudVisible = true;
  private impact = 0;
  /** Simulated time (s), advances only while not paused. */
  simTime = 0;
  private readonly focus = new THREE.Vector3();

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
    this.car = getCar('placeholder-gt');
    this.quality = QUALITY_PRESETS[loadQuality()];

    this.rig = new CameraRig(window.innerWidth / window.innerHeight);
    this.rig.settings = loadJSON<CameraSettings>('camera', this.rig.settings);
    this.rig.setMode(loadJSON<{ mode: CameraModeId }>('cameraMode', { mode: 'chase' }).mode);

    this.renderer = new Renderer(canvas, this.quality, this.scene, this.rig.camera);
    this.env = new Environment(this.scene, this.renderer.renderer, this.quality);
    this.track = new TestTrack(this.quality, this.renderer.maxAnisotropy);
    this.scene.add(this.track.group);

    this.vehicle = new Vehicle(this.car.physics);
    this.vehicle.assists = loadJSON<Assists>('assists', { ...ASSIST_PRESETS.intermediate });
    this.visual = new CarVisual(this.car, this.vehicle);
    this.scene.add(this.visual.root);
    this.outline = outlinePoints(this.car.visual.frontOverhangFromCg, this.car.visual.rearOverhangFromCg, this.car.visual.width / 2);

    this.effects = new TireEffects();
    this.scene.add(this.effects.group);

    this.input = new Input();
    this.hud = new HUD(uiRoot, this.car.name, this.car.placeholder);
    this.menu = new Menu(uiRoot, {
      onResume: () => this.setPaused(false),
      onReset: () => {
        this.resetCar();
        this.setPaused(false);
      },
      onAssists: (a) => this.setAssists(a),
      onQuality: (q) => this.setQuality(q),
      onCamera: (id) => {
        this.rig.setMode(id);
        saveJSON('cameraMode', { mode: id });
        this.updateInfo();
      },
      onCameraSettings: (s) => {
        this.rig.settings = s;
        saveJSON('camera', s);
      },
    });

    window.addEventListener('resize', () => this.onResize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && !this.paused) this.setPaused(true);
    });

    this.resetCar();
    this.onResize();
    this.updateInfo();
  }

  start(): void {
    this.lastTime = performance.now();
    this.renderer.renderer.setAnimationLoop((t) => this.frame(t));
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
    if (p) {
      this.menu.show({
        assists: this.vehicle.assists,
        quality: this.quality.id,
        camera: this.rig.mode,
        cameraSettings: this.rig.settings,
        device: this.input.device,
      });
    } else {
      this.menu.hide();
      this.lastTime = performance.now();
    }
  }

  private setAssists(a: Assists): void {
    this.vehicle.assists = { ...a };
    saveJSON('assists', a);
    this.updateInfo();
  }

  private setQuality(id: QualityId): void {
    this.quality = QUALITY_PRESETS[id];
    saveQuality(id);
    this.renderer.applyQuality(this.quality);
    this.env.applyQuality(this.quality);
    this.track.applyQuality(this.quality);
    this.onResize();
    this.updateInfo();
  }

  private onResize(): void {
    this.renderer.resize();
    const h = this.renderer.renderer.getDrawingBufferSize(new THREE.Vector2()).y;
    this.effects.setViewport(h, this.rig.camera.fov);
  }

  private updateInfo(): void {
    const a = this.vehicle.assists;
    const preset = (Object.keys(ASSIST_PRESETS) as Array<keyof typeof ASSIST_PRESETS>).find((k) =>
      (Object.keys(a) as Array<keyof Assists>).every((key) => ASSIST_PRESETS[k][key] === a[key]),
    );
    const presetLabel = preset === 'arcade' ? 'Arcade' : preset === 'intermediate' ? 'Intermédiaire' : preset === 'simulation' ? 'Simulation' : 'Personnalisé';
    this.hud.setInfo([
      `Qualité ${this.quality.label} · Caméra ${this.rig.label}`,
      `Aides : ${presetLabel}`,
      `${this.track.name}`,
    ]);
  }

  // ---------------------------------------------------------------------------

  private handleActions(): void {
    for (const action of this.input.consumeActions()) {
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
          this.hud.showToast(`Aides : ${id === 'arcade' ? 'Arcade' : id === 'intermediate' ? 'Intermédiaire' : 'Simulation'}`);
          break;
        }
      }
    }
  }

  private frame(now: number): void {
    const dt = Math.min(0.1, Math.max(0, (now - this.lastTime) / 1000));
    this.lastTime = now;

    const t0 = performance.now();
    this.input.update(dt, this.vehicle.u);
    this.handleActions();

    if (!this.paused) {
      this.accumulator += dt;
      let steps = 0;
      this.impact = 0;
      while (this.accumulator >= PHYSICS_DT && steps < MAX_STEPS_PER_FRAME) {
        this.vehicle.step(PHYSICS_DT, this.input.drive);
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

      // Rumble: impacts (strong motor) and tire slip (weak motor).
      let slip = 0;
      for (const w of this.vehicle.wheels) slip = Math.max(slip, Math.min(1, Math.max(0, (w.slipSpeed - 2) / 8)));
      this.input.rumble(Math.min(1, this.impact / 8), slip * 0.5, dt);
      if (this.impact > 6) this.hud.showToast('Choc !');
    }

    this.visual.update(this.vehicle, dt);
    this.rig.update(dt, this.vehicle, this.visual, this.input.lookBack);
    this.focus.set(this.vehicle.x, 0, this.vehicle.z);
    this.env.follow(this.focus);
    this.hud.update(dt, this.vehicle, this.input.drive.steer);
    const t1 = performance.now();
    this.renderer.render();
    this.hud.perf.sim = t1 - t0;
    this.hud.perf.render = performance.now() - t1;
  }
}
