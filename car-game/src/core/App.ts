import type * as THREE from 'three';
import { Renderer } from '../render/Renderer';
import { AudioEngine } from '../audio/AudioEngine';
import { Input } from './Input';
import { QUALITY_PRESETS, loadQuality, saveQuality, type QualityId, type QualitySettings } from './quality';
import { DriveSession } from '../game-modes/DriveSession';
import { loadAnnecy } from '../tracks/annecy/AnnecyTrack';
import { DEFAULT_DRIVE, TRACK_NAMES, type DriveOptions } from '../game-modes/options';
import { Garage } from '../garage/Garage';
import { CARS, getCar } from '../cars/registry';
import { applySetup, loadSetup } from '../cars/setup';
import { loadJSON, saveJSON } from './storage';

/** A full-screen mode of the game (garage, drive session…). */
export interface Screen {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  frame(dt: number): void;
  onResize(): void;
  onQualityChanged(): void;
  /** Optional: CPU time spent submitting the frame (ms), for the telemetry overlay. */
  onRendered?(ms: number): void;
  dispose(): void;
}

/** Services shared by every screen. */
export interface AppContext {
  readonly renderer: Renderer;
  readonly audio: AudioEngine;
  readonly input: Input;
  readonly uiRoot: HTMLElement;
  readonly quality: QualitySettings;
  setQuality(id: QualityId): void;
  goToGarage(): void;
  /** Drive a car (setup applied) on a track; options are remembered for next time. */
  drive(carId: string, options?: DriveOptions): void;
}

export class App implements AppContext {
  readonly renderer: Renderer;
  readonly audio = new AudioEngine();
  readonly input = new Input();
  quality: QualitySettings;
  private screen: Screen | null = null;
  private lastTime = performance.now();

  constructor(
    canvas: HTMLCanvasElement,
    readonly uiRoot: HTMLElement,
  ) {
    this.quality = QUALITY_PRESETS[loadQuality()];
    this.renderer = new Renderer(canvas, this.quality);
    window.addEventListener('resize', () => this.resize());
  }

  /** Current screen, exposed for the browser smoke test (window.__app.screen). */
  get current(): Screen | null {
    return this.screen;
  }

  start(): void {
    this.goToGarage();
    this.renderer.renderer.setAnimationLoop((t) => this.frame(t));
  }

  private show(screen: Screen): void {
    this.screen?.dispose();
    this.screen = screen;
    this.renderer.setView(screen.scene, screen.camera);
    this.resize();
    this.lastTime = performance.now();
  }

  goToGarage(): void {
    const last = loadJSON<{ id: string }>('lastCar', { id: CARS[0].id }).id;
    this.show(new Garage(this, last));
  }

  drive(carId: string, options?: DriveOptions): void {
    const base = getCar(carId);
    saveJSON('lastCar', { id: base.id });
    const opts = options ?? loadJSON<DriveOptions>('drive', DEFAULT_DRIVE);
    saveJSON('drive', opts);
    // Building a circuit takes a moment: show a loading card first (after it has been painted).
    const card = document.createElement('div');
    card.className = 'track-loading';
    const tip = opts.track === 'annecy' ? 'Relief, photos aériennes et arbres : IGN · routes, lac et bâtiments : OpenStreetMap' : '';
    card.innerHTML = `<div><small>Chargement</small><b>${TRACK_NAMES[opts.track]}</b><span></span><p>${tip}</p></div>`;
    this.uiRoot.appendChild(card);
    const go = async () => {
      try {
        const bundle = opts.track === 'annecy' ? await loadAnnecy(this.renderer.maxAnisotropy) : undefined;
        const session = new DriveSession(this, applySetup(base, loadSetup(base)), opts, bundle);
        await session.ready();
        this.show(session);
        card.remove();
      } catch (err) {
        console.error(err);
        card.querySelector('small')!.textContent = 'Impossible de charger le circuit';
        card.querySelector('p')!.textContent = String((err as Error).message ?? err);
        setTimeout(() => card.remove(), 4000);
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(() => void go()));
  }

  setQuality(id: QualityId): void {
    this.quality = QUALITY_PRESETS[id];
    saveQuality(id);
    this.renderer.applyQuality(this.quality);
    this.screen?.onQualityChanged();
    this.resize();
  }

  private resize(): void {
    this.renderer.resize();
    this.screen?.onResize();
  }

  private frame(now: number): void {
    const dt = Math.min(0.1, Math.max(0, (now - this.lastTime) / 1000));
    this.lastTime = now;
    if (!this.screen) return;
    this.screen.frame(dt);
    const t1 = performance.now();
    this.renderer.render();
    this.screen.onRendered?.(performance.now() - t1);
  }
}
