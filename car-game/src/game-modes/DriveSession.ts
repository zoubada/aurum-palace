import * as THREE from 'three';
import { TireEffects } from '../render/Effects';
import { Mirrors } from '../render/Mirrors';
import { BeamDecal, Headlights } from '../render/Headlights';
import { ASSIST_PRESETS, type Assists, type Vehicle } from '../physics/vehicle';
import { CarVisual } from '../cars/CarVisual';
import { EngineEvents } from '../cars/EngineEvents';
import { loadCarModel, modelAvailable } from '../cars/gltf';
import { CARS } from '../cars/registry';
import type { CarConfig } from '../cars/types';
import { CameraRig, type CameraModeId, type CameraSettings } from '../camera/CameraRig';
import { CarAudio } from '../audio/CarAudio';
import { Ambience } from '../audio/Ambience';
import { HUD } from '../ui/HUD';
import { Menu } from '../ui/Menu';
import { RaceHUD } from '../ui/RaceHUD';
import type { AppContext, Screen } from '../core/App';
import { ASSIST_LABELS, presetOf } from '../core/assists';
import { loadJSON, saveJSON } from '../core/storage';
import { HOLD, RaceWorld, type Racer } from './RaceWorld';
import type { TrackScene } from '../tracks/TrackScene';
import { TestTrackScene } from '../tracks/TestTrackScene';
import { CityTrack } from '../tracks/city/CityTrack';
import { AnnecyTrack, type AnnecyBundle } from '../tracks/annecy/AnnecyTrack';
import { formatLapTime, type LapRecord } from '../tracks/LapTimer';
import { DEFAULT_DRIVE, MAX_OPPONENTS, type DriveOptions } from './options';

/** Physics runs at a fixed 240 Hz, decoupled from the display refresh rate. */
const PHYSICS_DT = 1 / 240;
const MAX_STEPS_PER_FRAME = 24;
/** Start lights: 5 s of red lamps, then go. */
const COUNTDOWN = 5.6;

interface Opponent {
  racer: Racer;
  visual: CarVisual;
  events: EngineEvents;
  beam: BeamDecal | null;
  audio: CarAudio | null;
}

/**
 * Driving on a track: the player's car and optional AI opponents in a RaceWorld (shared
 * physics, contacts, lap timing), the track scenery and lighting, HUD, pause menu, sound.
 * Free practice with a timed lap and positions; the full race modes arrive in Phase 6.
 */
export class DriveSession implements Screen {
  readonly scene = new THREE.Scene();
  readonly world: RaceWorld;
  readonly player: Racer;
  readonly rig: CameraRig;
  readonly track: TrackScene;
  readonly visual: CarVisual;
  readonly opponents: Opponent[] = [];
  private readonly headlights: Headlights | null = null;
  private readonly effects: TireEffects;
  private readonly events: EngineEvents;
  private mirrors: Mirrors;
  private carAudio: CarAudio | null = null;
  private ambience: Ambience | null = null;
  private readonly hud: HUD;
  private readonly raceHud: RaceHUD | null = null;
  private readonly menu: Menu;
  private accumulator = 0;
  private paused = false;
  private hudVisible = true;
  private disposed = false;
  /** Seconds before the start (> 0: cars held on the grid). */
  private countdown = 0;
  private racingLineOn: boolean;
  private readonly bestKey: string;
  /** Simulated time (s), advances only while not paused. */
  simTime = 0;
  private readonly tmp = new THREE.Vector3();
  private readonly camRight = new THREE.Vector3();
  private readonly onVisibility = () => {
    if (document.hidden && !this.paused) this.setPaused(true);
  };

  constructor(
    private readonly app: AppContext,
    readonly car: CarConfig,
    readonly options: DriveOptions = DEFAULT_DRIVE,
    /** Pre-downloaded data of a streamed circuit (Annecy). */
    bundle?: AnnecyBundle,
  ) {
    this.rig = new CameraRig(window.innerWidth / window.innerHeight);
    this.rig.settings = loadJSON<CameraSettings>('camera', this.rig.settings);
    this.rig.setMode(loadJSON<{ mode: CameraModeId }>('cameraMode', { mode: 'chase' }).mode);

    const r = app.renderer;
    if (options.track === 'annecy' && bundle) {
      this.track = new AnnecyTrack(this.scene, r.renderer, app.quality, r.maxAnisotropy, bundle, {
        variant: options.variant ?? 'full',
        time: options.time ?? 'evening',
        rain: options.rain,
      });
    } else if (options.track === 'city') {
      this.track = new CityTrack(this.scene, r.renderer, app.quality, r.maxAnisotropy, options.rain);
    } else {
      this.track = new TestTrackScene(this.scene, r.renderer, app.quality, r.maxAnisotropy);
    }
    this.rig.camera.far = this.track.viewDistance;
    this.rig.camera.updateProjectionMatrix();
    this.world = new RaceWorld(this.track.surface, this.track.sectors, this.track.grip, this.track.sprint);

    // --- Player.
    const course = this.track.id === 'annecy' ? `${this.track.id}-${options.variant ?? 'full'}` : this.track.id;
    this.bestKey = `best.${course}.${options.rain ? 'wet' : 'dry'}.${car.id}`;
    this.player = this.world.add(car, undefined, loadJSON<LapRecord | null>(this.bestKey, null));
    this.player.vehicle.assists = loadJSON<Assists>('assists', { ...ASSIST_PRESETS.intermediate });
    this.visual = new CarVisual(car, this.player.vehicle);
    this.scene.add(this.visual.root);
    this.mirrors = new Mirrors(this.visual);
    this.events = new EngineEvents(car.sound, car.physics.engine.redlineRpm);
    this.effects = new TireEffects();
    this.effects.wet = this.track.grip < 1;
    this.scene.add(this.effects.group);
    if (this.track.night) this.headlights = new Headlights(this.visual);

    // --- AI opponents (circuits only), each a different car, ahead of the player on the grid.
    const line = this.track.racingLine;
    const count = line ? Math.max(0, Math.min(MAX_OPPONENTS, options.opponents)) : 0;
    const pool = CARS.filter((c) => c.id !== car.id);
    for (let i = 0; i < count; i++) {
      const cfg = pool[i % pool.length];
      const skill = 0.9 + ((i * 0.37) % 1) * 0.07;
      const racer = this.world.add(cfg, { line: line!, profile: line!.speedProfile(cfg.physics, this.track.grip), skill, seed: i + 1 });
      const visual = new CarVisual(cfg, racer.vehicle);
      visual.setPaint(cfg.visual.paints[(i + 1) % cfg.visual.paints.length]);
      visual.setNight(this.track.night);
      visual.simplify();
      this.scene.add(visual.root);
      this.opponents.push({
        racer,
        visual,
        events: new EngineEvents(cfg.sound, cfg.physics.engine.redlineRpm),
        beam: this.track.night ? new BeamDecal(visual) : null,
        audio: null,
      });
    }

    // --- UI.
    this.hud = new HUD(app.uiRoot, car.name, true);
    this.hud.onMenu = () => this.setPaused(!this.paused);
    if (this.track.spline) this.raceHud = new RaceHUD(app.uiRoot, this.track.minimap(), this.track.sectors.length, count > 0);
    this.racingLineOn = loadJSON<{ on: boolean }>('racingLine', { on: false }).on;
    this.applyRacingLine();
    this.menu = new Menu(app.uiRoot, {
      onResume: () => this.setPaused(false),
      onReset: () => {
        this.recover();
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
      onRacingLine: (on) => {
        this.racingLineOn = on;
        saveJSON('racingLine', { on });
        this.applyRacingLine();
      },
    });

    app.audio.onReady(() => {
      if (this.disposed) return;
      this.carAudio = new CarAudio(app.audio, car);
      this.ambience = new Ambience(app.audio, { city: this.track.ambience === 'city', nature: this.track.ambience === 'nature', rain: options.rain });
      for (const o of this.opponents) o.audio = new CarAudio(app.audio, o.racer.car, true);
    });
    document.addEventListener('visibilitychange', this.onVisibility);

    this.startGrid();
    this.updateInfo();
    void this.loadRealModel();
  }

  get camera(): THREE.PerspectiveCamera {
    return this.rig.camera;
  }

  /** Resolves when the scenery around the start is ready (streamed circuits). */
  async ready(): Promise<void> {
    await this.track.ready?.();
  }

  /** The player's car (kept for the smoke test and tools). */
  get vehicle(): Vehicle {
    return this.player.vehicle;
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

  /** Everyone on the grid: AI cars in front, the player at the back (start lights with AI). */
  private startGrid(): void {
    const n = this.opponents.length;
    this.opponents.forEach((o, i) => this.track.placeOnGrid(o.racer, i));
    this.track.placeOnGrid(this.player, n);
    this.countdown = n > 0 ? COUNTDOWN : 0;
    this.world.hold = this.countdown > 0;
    this.effects.clear();
    this.rig.snap();
  }

  /** "R": back on the track (on the grid on the test area). */
  private recover(): void {
    this.track.recover(this.player);
    this.effects.clear();
    this.rig.snap();
  }

  private applyRacingLine(): void {
    const line = this.track.racingLine;
    this.track.setRacingLine(line && this.racingLineOn ? line.speedProfile(this.car.physics, this.track.grip) : null);
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
        racingLine: this.track.racingLine ? this.racingLineOn : null,
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
    const weather = this.track.grip < 1 ? ' · pluie' : '';
    this.hud.setInfo([
      `Qualité ${this.app.quality.label} · Caméra ${this.rig.label}`,
      `Aides : ${preset ? ASSIST_LABELS[preset] : 'Personnalisées'}`,
      `${this.track.name}${weather}`,
      ...(this.track.credits ? [this.track.credits] : []),
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
          if (this.countdown <= 0) this.recover();
          break;
        case 'hud':
          this.hudVisible = !this.hudVisible;
          this.hud.setVisible(this.hudVisible);
          if (this.raceHud) this.raceHud.root.style.display = this.hudVisible ? '' : 'none';
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

  private timingEvents(): void {
    for (const { racer, ev } of this.world.events) {
      if (racer !== this.player) continue;
      this.raceHud?.event(ev);
      if (ev.invalidated) this.hud.showToast(`Tour invalidé : ${ev.invalidated}`);
      if (ev.lap) {
        const t = formatLapTime(ev.lap.time);
        if (this.track.sprint) {
          this.hud.showToast(`Arrivée : ${t}${ev.lap.valid ? (ev.lap.best ? ' · record' : '') : ' (non valable)'}`);
          if (ev.lap.valid && ev.lap.best) saveJSON(this.bestKey, { time: ev.lap.time, sectors: ev.lap.sectors });
        } else if (!ev.lap.valid) this.hud.showToast(`Tour ${t} (non valable)`);
        else if (ev.lap.best) {
          this.hud.showToast(`Meilleur tour : ${t}`);
          saveJSON(this.bestKey, { time: ev.lap.time, sectors: ev.lap.sectors });
        } else this.hud.showToast(`Tour : ${t}`);
      }
    }
  }

  frame(dt: number): void {
    const t0 = performance.now();
    const input = this.app.input;
    const v = this.vehicle;
    input.update(dt, v.u);
    this.handleActions();
    let ev = null;
    let impact = 0;

    if (!this.paused) {
      // Start lights: the player is held too (no jump start).
      if (this.countdown > 0) {
        this.countdown -= dt;
        if (this.countdown <= 0) {
          this.world.hold = false;
          this.hud.showToast('Départ !');
        }
      }
      const held = this.countdown > 0;
      this.accumulator += dt;
      let steps = 0;
      for (const r of this.world.racers) r.impact = 0;
      while (this.accumulator >= PHYSICS_DT && steps < MAX_STEPS_PER_FRAME) {
        const d = input.drive;
        this.player.input = held ? HOLD : d;
        this.world.step(PHYSICS_DT);
        this.timingEvents();
        this.accumulator -= PHYSICS_DT;
        this.simTime += PHYSICS_DT;
        steps++;
      }
      if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0; // too slow: drop time rather than spiral
      impact = this.player.impact;

      this.effects.update(dt, v);
      ev = this.events.update(dt, v);

      // Rumble: impacts (strong motor) and tire slip (weak motor).
      let slip = 0;
      for (const w of v.wheels) slip = Math.max(slip, Math.min(1, Math.max(0, (w.slipSpeed - 2) / 8)));
      input.rumble(Math.min(1, impact / 8), slip * 0.5, dt);
      if (impact > 1) this.carAudio?.impact(impact);
      if (impact > 6) this.hud.showToast('Choc !');
      if (this.carAudio) {
        this.carAudio.setInterior(this.rig.mode === 'cockpit' && !input.lookBack);
        this.carAudio.update(v, ev);
      }
    }

    this.visual.update(v, dt, ev ?? undefined);
    this.rig.update(dt, v, this.visual, input.lookBack);
    const cam = this.rig.camera;
    this.updateOpponents(dt);
    this.track.update(this.paused ? 0 : dt, { camera: cam, player: this.player, racers: this.world.racers, time: this.simTime });
    this.app.renderer.renderer.toneMappingExposure = this.track.exposure;
    this.ambience?.update(this.track.enclosure, this.paused ? 0 : dt);

    const mode = this.rig.mode;
    this.mirrors.update(this.app.renderer.renderer, this.scene, this.visual, (mode === 'cockpit' || mode === 'hood') && !input.lookBack);
    this.hud.update(dt, v, input.drive.steer);
    this.raceHud?.update(dt, this.player, this.world.racers);
    this.raceHud?.setCountdown(this.opponents.length > 0 && this.countdown > -1.5 ? this.countdown : null);
    this.hud.perf.sim = performance.now() - t0;
  }

  private updateOpponents(dt: number): void {
    const cam = this.rig.camera;
    this.camRight.setFromMatrixColumn(cam.matrixWorld, 0);
    for (const o of this.opponents) {
      const ov = o.racer.vehicle;
      const ev = this.paused ? undefined : o.events.update(dt, ov);
      o.visual.update(ov, dt, ev);
      if (o.audio) {
        if (this.paused) continue;
        // Distance attenuation and stereo position relative to the camera.
        this.tmp.set(ov.x, ov.y + 0.6, ov.z).sub(cam.position);
        const d = this.tmp.length();
        const level = Math.min(1, 7 / (d + 4)) * 0.9;
        const pan = d > 0.1 ? Math.max(-1, Math.min(1, this.tmp.dot(this.camRight) / d)) * 0.8 : 0;
        o.audio.setSpatial(d > 300 ? 0 : level, pan);
        if (ev) o.audio.update(ov, ev);
      }
    }
  }

  onRendered(ms: number): void {
    const p = this.hud.perf;
    p.render = ms;
    p.calls = this.app.renderer.stats.calls;
    p.triangles = this.app.renderer.stats.triangles;
  }

  dispose(): void {
    this.disposed = true;
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.carAudio?.dispose();
    this.ambience?.dispose();
    for (const o of this.opponents) {
      o.audio?.dispose();
      o.beam?.dispose();
      o.visual.dispose();
    }
    this.app.audio.setPaused(false);
    this.app.renderer.renderer.toneMappingExposure = 1;
    this.headlights?.dispose();
    this.mirrors.dispose();
    this.visual.dispose();
    this.track.dispose();
    this.hud.root.remove();
    this.raceHud?.root.remove();
    this.menu.root.remove();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
  }
}
