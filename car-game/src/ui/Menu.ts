import { ASSIST_PRESETS, type AssistPresetId, type Assists } from '../physics/vehicle';
import { QUALITY_PRESETS, type QualityId } from '../core/quality';
import { CAMERA_MODES, type CameraModeId, type CameraSettings } from '../camera/CameraRig';

/**
 * Pause / settings menu: driving aids (presets + individual toggles), graphics
 * quality, camera, controls reference. The full AAA menu flow (main menu,
 * garage, race setup) arrives with Phases 2 and 6.
 */

export interface MenuState {
  assists: Assists;
  quality: QualityId;
  camera: CameraModeId;
  cameraSettings: CameraSettings;
  device: string;
}

export interface MenuCallbacks {
  onResume(): void;
  onReset(): void;
  onAssists(a: Assists): void;
  onQuality(q: QualityId): void;
  onCamera(id: CameraModeId): void;
  onCameraSettings(s: CameraSettings): void;
}

const PRESET_LABELS: Record<AssistPresetId, string> = {
  arcade: 'Arcade',
  intermediate: 'Intermédiaire',
  simulation: 'Simulation',
};

const AID_LABELS: Array<[keyof Assists, string, string]> = [
  ['abs', 'ABS', 'Empêche le blocage des roues au freinage'],
  ['tc', 'Antipatinage', 'Limite le patinage à l’accélération'],
  ['esp', 'ESP', 'Corrige les dérapages en freinant une roue'],
  ['autoGear', 'Boîte automatique', 'Sinon : E / A·Q ou palettes'],
  ['steerLimit', 'Limiteur de braquage', 'Adapte l’angle de braquage à la vitesse'],
];

export class Menu {
  readonly root: HTMLDivElement;
  private state!: MenuState;

  constructor(parent: HTMLElement, private cb: MenuCallbacks) {
    this.root = document.createElement('div');
    this.root.className = 'menu hidden';
    parent.appendChild(this.root);
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root) cb.onResume();
    });
  }

  get open(): boolean {
    return !this.root.classList.contains('hidden');
  }

  show(state: MenuState): void {
    this.state = structuredClone(state);
    this.render();
    this.root.classList.remove('hidden');
  }

  hide(): void {
    this.root.classList.add('hidden');
  }

  private presetOf(a: Assists): AssistPresetId | null {
    for (const id of Object.keys(ASSIST_PRESETS) as AssistPresetId[]) {
      const p = ASSIST_PRESETS[id];
      if ((Object.keys(p) as Array<keyof Assists>).every((k) => p[k] === a[k])) return id;
    }
    return null;
  }

  private render(): void {
    const s = this.state;
    const preset = this.presetOf(s.assists);
    this.root.innerHTML = `
      <div class="menu-panel">
        <header>
          <div class="menu-kicker">Pause</div>
          <h1>Réglages</h1>
        </header>
        <section>
          <h2>Aides à la conduite</h2>
          <div class="seg-row" data-group="preset">
            ${(Object.keys(PRESET_LABELS) as AssistPresetId[])
              .map((id) => `<button data-preset="${id}" class="${preset === id ? 'on' : ''}">${PRESET_LABELS[id]}</button>`)
              .join('')}
          </div>
          <div class="toggles">
            ${AID_LABELS.map(
              ([k, label, hint]) => `
              <label class="toggle">
                <input type="checkbox" data-aid="${k}" ${s.assists[k] ? 'checked' : ''}>
                <span class="sw"></span>
                <span class="t"><b>${label}</b><small>${hint}</small></span>
              </label>`,
            ).join('')}
          </div>
        </section>
        <section>
          <h2>Graphismes</h2>
          <div class="seg-row">
            ${(Object.keys(QUALITY_PRESETS) as QualityId[])
              .map((id) => `<button data-quality="${id}" class="${s.quality === id ? 'on' : ''}">${QUALITY_PRESETS[id].label}</button>`)
              .join('')}
          </div>
        </section>
        <section>
          <h2>Caméra</h2>
          <div class="seg-row wrap">
            ${CAMERA_MODES.map((m) => `<button data-camera="${m.id}" class="${s.camera === m.id ? 'on' : ''}">${m.label}</button>`).join('')}
          </div>
          <div class="sliders">
            ${this.slider('distance', 'Distance poursuite', 3.5, 9, 0.1, s.cameraSettings.distance, 'm')}
            ${this.slider('height', 'Hauteur poursuite', 0.9, 3.5, 0.05, s.cameraSettings.height, 'm')}
            ${this.slider('fov', 'Champ de vision', 45, 85, 1, s.cameraSettings.fov, '°')}
            ${this.slider('speedFov', 'Effet de vitesse', 0, 25, 1, s.cameraSettings.speedFov, '°')}
          </div>
        </section>
        <section>
          <h2>Commandes</h2>
          <table class="controls">
            <tr><th></th><th>Clavier</th><th>Manette</th></tr>
            <tr><td>Accélérer</td><td>↑ / Z (AZERTY) · W</td><td>RT</td></tr>
            <tr><td>Freiner / marche arrière</td><td>↓ / S</td><td>LT</td></tr>
            <tr><td>Diriger</td><td>← → / Q·A, D</td><td>Stick gauche</td></tr>
            <tr><td>Frein à main</td><td>Espace</td><td>B</td></tr>
            <tr><td>Rapport + / −</td><td>E / A (AZERTY) · Q</td><td>RB / LB</td></tr>
            <tr><td>Changer de caméra</td><td>C</td><td>Y</td></tr>
            <tr><td>Regarder derrière</td><td>V (maintenu)</td><td>X (maintenu)</td></tr>
            <tr><td>Replacer la voiture</td><td>R</td><td>View</td></tr>
            <tr><td>Presets d’aides</td><td>1 · 2 · 3</td><td>—</td></tr>
            <tr><td>Masquer HUD / télémétrie</td><td>H / F3</td><td>—</td></tr>
          </table>
          <p class="device">Périphérique actif : <b>${s.device === 'keyboard' ? 'clavier' : escapeHtml(s.device)}</b></p>
        </section>
        <footer>
          <button class="ghost" data-action="reset">Replacer la voiture</button>
          <button class="primary" data-action="resume">Reprendre</button>
        </footer>
      </div>`;
    this.bind();
  }

  private slider(key: keyof CameraSettings, label: string, min: number, max: number, step: number, value: number, unit: string): string {
    return `
      <label class="slider">
        <span>${label}</span>
        <input type="range" data-cam="${key}" min="${min}" max="${max}" step="${step}" value="${value}">
        <output>${value.toFixed(step < 1 ? 1 : 0)} ${unit}</output>
      </label>`;
  }

  private bind(): void {
    const r = this.root;
    r.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((b) =>
      b.addEventListener('click', () => {
        this.state.assists = { ...ASSIST_PRESETS[b.dataset.preset as AssistPresetId] };
        this.cb.onAssists(this.state.assists);
        this.render();
      }),
    );
    r.querySelectorAll<HTMLInputElement>('[data-aid]').forEach((i) =>
      i.addEventListener('change', () => {
        const k = i.dataset.aid as keyof Assists;
        (this.state.assists as unknown as Record<string, boolean | number>)[k] = i.checked;
        this.cb.onAssists(this.state.assists);
        this.render();
      }),
    );
    r.querySelectorAll<HTMLButtonElement>('[data-quality]').forEach((b) =>
      b.addEventListener('click', () => {
        this.state.quality = b.dataset.quality as QualityId;
        this.cb.onQuality(this.state.quality);
        this.render();
      }),
    );
    r.querySelectorAll<HTMLButtonElement>('[data-camera]').forEach((b) =>
      b.addEventListener('click', () => {
        this.state.camera = b.dataset.camera as CameraModeId;
        this.cb.onCamera(this.state.camera);
        this.render();
      }),
    );
    r.querySelectorAll<HTMLInputElement>('[data-cam]').forEach((i) =>
      i.addEventListener('input', () => {
        const k = i.dataset.cam as keyof CameraSettings;
        this.state.cameraSettings[k] = Number(i.value);
        const out = i.parentElement?.querySelector('output');
        if (out) out.textContent = `${Number(i.value).toFixed(Number(i.step) < 1 ? 1 : 0)} ${k === 'distance' || k === 'height' ? 'm' : '°'}`;
        this.cb.onCameraSettings({ ...this.state.cameraSettings });
      }),
    );
    r.querySelector('[data-action="resume"]')?.addEventListener('click', () => this.cb.onResume());
    r.querySelector('[data-action="reset"]')?.addEventListener('click', () => this.cb.onReset());
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
