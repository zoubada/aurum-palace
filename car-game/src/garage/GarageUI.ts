import type { CarConfig } from '../cars/types';
import { defaultSetup, applySetup, type CarSetup } from '../cars/setup';
import { topSpeed, zeroTo } from '../physics/benchmark';
import { QUALITY_PRESETS, type QualityId } from '../core/quality';

/**
 * Garage interface: car list, spec sheet with comparison bars, paint / rims, setup sliders.
 * Plain DOM over the 3D showroom.
 */

export interface GarageCallbacks {
  onSelect(id: string): void;
  onSetup(setup: CarSetup): void;
  /** Toggle the doors; returns the new state. */
  onDoors(): boolean;
  onDrive(): void;
  onQuality(q: QualityId): void;
}

type Tab = 'specs' | 'paint' | 'setup';

const GEARBOX_LABEL = { dct: 'Double embrayage', automatic: 'Automatique', manual: 'Manuelle' } as const;

interface Stat {
  label: string;
  unit: string;
  value: (c: CarConfig) => number;
  /** Lower is better (bars are inverted). */
  lower?: boolean;
  digits?: number;
}

const STATS: Stat[] = [
  { label: 'Puissance', unit: 'ch', value: (c) => c.reference.powerHp },
  { label: 'Couple', unit: 'N·m', value: (c) => c.reference.torqueNm },
  { label: 'Poids', unit: 'kg', value: (c) => c.reference.massKg, lower: true },
  { label: 'Poids / puissance', unit: 'kg/ch', value: (c) => c.reference.massKg / c.reference.powerHp, lower: true, digits: 2 },
  { label: '0–100 km/h', unit: 's', value: (c) => c.reference.zeroTo100, lower: true, digits: 1 },
  { label: 'Vitesse max', unit: 'km/h', value: (c) => c.reference.topSpeedKmh },
];

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function hex(c: number): string {
  return `#${c.toString(16).padStart(6, '0')}`;
}

export class GarageUI {
  readonly root: HTMLDivElement;
  private car!: CarConfig;
  private cars: CarConfig[] = [];
  private setup!: CarSetup;
  private tab: Tab = 'specs';
  private compareId: string | null = null;
  private placeholder = true;
  private quality: QualityId = 'high';
  private simTimer = 0;
  private sim: { zeroTo100: number; topSpeed: number } | null = null;

  constructor(
    parent: HTMLElement,
    private readonly cb: GarageCallbacks,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'garage';
    parent.appendChild(this.root);
  }

  setQuality(q: QualityId): void {
    this.quality = q;
  }

  setPlaceholder(p: boolean): void {
    this.placeholder = p;
    this.render();
  }

  showCar(car: CarConfig, setup: CarSetup, cars: CarConfig[], placeholder: boolean): void {
    this.car = car;
    this.cars = cars;
    this.setup = { ...setup };
    this.placeholder = placeholder;
    if (this.compareId === car.id) this.compareId = null;
    this.render();
    this.scheduleSim();
  }

  /** Measure the configured car in the simulation (deferred so the UI stays responsive). */
  private scheduleSim(): void {
    this.sim = null;
    clearTimeout(this.simTimer);
    this.simTimer = window.setTimeout(() => {
      const p = applySetup(this.car, this.setup).physics;
      this.sim = { zeroTo100: zeroTo(p, 100), topSpeed: topSpeed(p, 120) };
      this.renderSim();
    }, 250);
  }

  private renderSim(): void {
    const el = this.root.querySelector('[data-sim]');
    if (!el) return;
    el.innerHTML = this.sim
      ? `<span>Mesuré en simulation avec vos réglages</span><b>${this.sim.zeroTo100.toFixed(2)} s</b> 0–100 · <b>${Math.round(this.sim.topSpeed)} km/h</b>`
      : '<span>Mesure en simulation…</span>';
  }

  private render(): void {
    const c = this.car;
    const tabs: Array<[Tab, string]> = [
      ['specs', 'Fiche'],
      ['paint', 'Personnaliser'],
      ['setup', 'Réglages'],
    ];
    this.root.innerHTML = `
      <header class="g-head">
        <div class="g-kicker">Garage</div>
        <div class="g-brand">${escapeHtml(c.visual.brand)}</div>
        <h1>${escapeHtml(c.name.replace(c.visual.brand, '').trim())}</h1>
        ${this.placeholder ? `<div class="g-chip" title="Déposez assets/cars/${c.id}/model.glb pour le remplacer">Modèle 3D provisoire</div>` : ''}
      </header>

      <nav class="g-list" aria-label="Voitures">
        ${this.cars
          .map(
            (k) => `
          <button class="g-car ${k.id === c.id ? 'on' : ''}" data-car="${k.id}">
            <span class="g-swatch" style="background:${hex(k.visual.paints[0].color)}"></span>
            <span class="g-car-txt"><small>${escapeHtml(k.visual.brand)}</small>${escapeHtml(k.name.replace(k.visual.brand, '').trim())}</span>
            <span class="g-car-hp">${k.reference.powerHp}<small> ch</small></span>
          </button>`,
          )
          .join('')}
      </nav>

      <aside class="g-panel">
        <div class="g-tabs" role="tablist">
          ${tabs.map(([t, l]) => `<button role="tab" data-tab="${t}" class="${this.tab === t ? 'on' : ''}">${l}</button>`).join('')}
        </div>
        <div class="g-body">${this.tab === 'specs' ? this.specsHtml() : this.tab === 'paint' ? this.paintHtml() : this.setupHtml()}</div>
      </aside>

      <footer class="g-foot">
        <label class="g-quality">Graphismes
          <select id="g-quality">
            ${(Object.keys(QUALITY_PRESETS) as QualityId[]).map((q) => `<option value="${q}" ${q === this.quality ? 'selected' : ''}>${QUALITY_PRESETS[q].label}</option>`).join('')}
          </select>
        </label>
        <button class="g-drive" data-action="drive">Rouler <span>· piste d'essai</span></button>
        <div class="g-hint">Glisser pour tourner autour · molette pour zoomer</div>
      </footer>`;
    this.bind();
    this.renderSim();
  }

  private specsHtml(): string {
    const c = this.car;
    const p = c.physics;
    const cmp = this.compareId ? this.cars.find((k) => k.id === this.compareId) ?? null : null;
    const rows: Array<[string, string]> = [
      ['Moteur', c.reference.engine],
      ['Boîte', `${GEARBOX_LABEL[p.gearbox.type]} ${p.gearbox.ratios.length} rapports`],
      ['Transmission', c.reference.drivetrain],
      ['Répartition des masses', `${Math.round(p.frontWeightFraction * 100)} / ${Math.round((1 - p.frontWeightFraction) * 100)}`],
      ['Dimensions', `${c.visual.length.toFixed(2)} × ${c.visual.width.toFixed(2)} × ${c.visual.height.toFixed(2)} m`],
    ];
    const bars = STATS.map((st) => {
      const all = this.cars.map(st.value);
      const max = Math.max(...all);
      const min = Math.min(...all);
      const frac = (v: number) => (st.lower ? 0.25 + (0.75 * (max - v)) / (max - min || 1) : 0.25 + (0.75 * (v - min)) / (max - min || 1));
      const v = st.value(c);
      const fmt = (x: number) => x.toFixed(st.digits ?? 0).replace('.', ',');
      return `
        <div class="g-stat">
          <div class="g-stat-head"><span>${st.label}</span><b>${fmt(v)} <small>${st.unit}</small></b>${cmp ? `<em>${fmt(st.value(cmp))}</em>` : ''}</div>
          <div class="g-bar"><i style="width:${(frac(v) * 100).toFixed(1)}%"></i>${cmp ? `<u style="width:${(frac(st.value(cmp)) * 100).toFixed(1)}%"></u>` : ''}</div>
        </div>`;
    }).join('');
    return `
      <dl class="g-specs">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${escapeHtml(v)}</dd>`).join('')}</dl>
      <div class="g-compare">
        <label for="g-cmp">Comparer avec</label>
        <select id="g-cmp">
          <option value="">—</option>
          ${this.cars
            .filter((k) => k.id !== c.id)
            .map((k) => `<option value="${k.id}" ${k.id === this.compareId ? 'selected' : ''}>${escapeHtml(k.name)}</option>`)
            .join('')}
        </select>
      </div>
      ${bars}
      <p class="g-sim" data-sim></p>
      <p class="g-source">Source : ${escapeHtml(c.reference.source)}</p>`;
  }

  private paintHtml(): string {
    const v = this.car.visual;
    return `
      <h3>Peinture</h3>
      <div class="g-swatches">
        ${v.paints
          .map(
            (p, i) => `
          <button class="g-paint ${i === this.setup.paintIndex ? 'on' : ''}" data-paint="${i}" title="${escapeHtml(p.name)}">
            <span style="background:${hex(p.color)}"></span>${escapeHtml(p.name)}
          </button>`,
          )
          .join('')}
      </div>
      <h3>Jantes</h3>
      <div class="g-swatches">
        ${v.rimColors
          .map(
            (r, i) => `
          <button class="g-paint ${i === this.setup.rimIndex ? 'on' : ''}" data-rim="${i}">
            <span style="background:${hex(r.color)}"></span>${escapeHtml(r.name)}
          </button>`,
          )
          .join('')}
      </div>
      <h3>Livrée</h3>
      <p class="g-note">Les livrées (bandes, numéros, sponsors) arrivent avec les vrais modèles 3D.</p>
      <button class="g-ghost" data-action="doors">Ouvrir les portes</button>`;
  }

  private static readonly SETTINGS: Array<{
    id: 'brakeBias' | 'balance' | 'aero' | 'finalDrive';
    label: string;
    min: number;
    max: number;
    step: number;
    left: string;
    right: string;
    fmt: (v: number) => string;
  }> = [
    { id: 'brakeBias', label: 'Répartition de freinage', min: 0.5, max: 0.8, step: 0.01, left: 'Plus d’arrière', right: 'Plus d’avant', fmt: (v) => `${Math.round(v * 100)} % avant` },
    {
      id: 'balance',
      label: 'Équilibre (barres anti-roulis)',
      min: -1,
      max: 1,
      step: 0.1,
      left: 'Sous-vireur',
      right: 'Survireur',
      fmt: (v) => (Math.abs(v) < 0.05 ? 'Neutre' : v < 0 ? `${Math.round(-v * 100)} % stable` : `${Math.round(v * 100)} % agile`),
    },
    { id: 'aero', label: 'Appui aérodynamique', min: 0.6, max: 1.4, step: 0.05, left: 'Moins d’appui', right: 'Plus d’appui', fmt: (v) => `${Math.round(v * 100)} %` },
    { id: 'finalDrive', label: 'Rapport de pont', min: 0.9, max: 1.1, step: 0.01, left: 'Long (vitesse)', right: 'Court (accélération)', fmt: (v) => `${Math.round(v * 100)} %` },
  ];

  private setupHtml(): string {
    return `
      ${GarageUI.SETTINGS.map(
        (o) => `
      <div class="g-slider">
        <div class="g-slider-head"><label for="set-${o.id}">${o.label}</label><output>${o.fmt(this.setup[o.id])}</output></div>
        <input type="range" id="set-${o.id}" data-set="${o.id}" min="${o.min}" max="${o.max}" step="${o.step}" value="${this.setup[o.id]}">
        <div class="g-slider-ends"><span>${o.left}</span><span>${o.right}</span></div>
      </div>`,
      ).join('')}
      <p class="g-sim" data-sim></p>
      <button class="g-ghost" data-action="reset-setup">Réglages d’usine</button>`;
  }

  private bind(): void {
    const r = this.root;
    r.querySelectorAll<HTMLButtonElement>('[data-car]').forEach((b) => b.addEventListener('click', () => this.cb.onSelect(b.dataset.car!)));
    r.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) =>
      b.addEventListener('click', () => {
        this.tab = b.dataset.tab as Tab;
        this.render();
      }),
    );
    r.querySelector<HTMLSelectElement>('#g-cmp')?.addEventListener('change', (e) => {
      this.compareId = (e.target as HTMLSelectElement).value || null;
      this.render();
    });
    r.querySelector<HTMLSelectElement>('#g-quality')?.addEventListener('change', (e) => {
      this.quality = (e.target as HTMLSelectElement).value as QualityId;
      this.cb.onQuality(this.quality);
    });
    r.querySelectorAll<HTMLButtonElement>('[data-paint]').forEach((b) =>
      b.addEventListener('click', () => {
        this.setup.paintIndex = Number(b.dataset.paint);
        this.cb.onSetup({ ...this.setup });
        this.render();
      }),
    );
    r.querySelectorAll<HTMLButtonElement>('[data-rim]').forEach((b) =>
      b.addEventListener('click', () => {
        this.setup.rimIndex = Number(b.dataset.rim);
        this.cb.onSetup({ ...this.setup });
        this.render();
      }),
    );
    r.querySelectorAll<HTMLInputElement>('[data-set]').forEach((i) =>
      i.addEventListener('input', () => {
        const opt = GarageUI.SETTINGS.find((o) => o.id === i.dataset.set)!;
        this.setup[opt.id] = Number(i.value);
        const out = i.parentElement?.querySelector('output');
        if (out) out.textContent = opt.fmt(this.setup[opt.id]);
        this.cb.onSetup({ ...this.setup });
        this.scheduleSim();
        this.renderSim();
      }),
    );
    r.querySelector('[data-action="reset-setup"]')?.addEventListener('click', () => {
      const d = defaultSetup(this.car);
      this.setup = { ...d, paintIndex: this.setup.paintIndex, rimIndex: this.setup.rimIndex };
      this.cb.onSetup({ ...this.setup });
      this.render();
      this.scheduleSim();
    });
    r.querySelector('[data-action="doors"]')?.addEventListener('click', (e) => {
      const open = this.cb.onDoors();
      (e.currentTarget as HTMLButtonElement).textContent = open ? 'Fermer les portes' : 'Ouvrir les portes';
    });
    r.querySelector('[data-action="drive"]')?.addEventListener('click', () => this.cb.onDrive());
  }

  dispose(): void {
    clearTimeout(this.simTimer);
    this.root.remove();
  }
}
