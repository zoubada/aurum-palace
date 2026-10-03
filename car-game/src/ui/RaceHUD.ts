import type { Racer } from '../game-modes/RaceWorld';
import type { TimerEvents } from '../tracks/LapTimer';
import { formatLapTime } from '../tracks/LapTimer';

/**
 * Timing tower and minimap (SPEC §9): position, lap, running lap time, sector times against the
 * best ones (purple = new best sector, yellow = slower), last and best lap, invalid-lap warning,
 * start lights.
 */

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent: HTMLElement): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  parent.appendChild(e);
  return e;
}

/** Fixed dot colours for the cars on the minimap (player = accent). */
const DOTS = ['#4fb3ff', '#ff6a3d', '#b07cff', '#3ddc84', '#ff4fa3', '#f2f2f2'];

export class RaceHUD {
  readonly root: HTMLDivElement;
  private readonly pos: HTMLDivElement;
  private readonly lap: HTMLDivElement;
  private readonly time: HTMLDivElement;
  private readonly invalid: HTMLDivElement;
  private readonly sectors: HTMLDivElement[] = [];
  private readonly last: HTMLSpanElement;
  private readonly best: HTMLSpanElement;
  private readonly map: HTMLCanvasElement;
  private readonly lights: HTMLDivElement;
  private readonly lamps: HTMLDivElement[] = [];
  private outline: Array<[number, number]> | null;
  private bounds = { minX: 0, minZ: 0, scale: 1, ox: 0, oz: 0 };
  private mapTimer = 0;
  private sectorHold = 0;
  private readonly sectorCount: number;

  constructor(parent: HTMLElement, outline: Array<[number, number]> | null, sectorCount: number, showPosition: boolean) {
    this.root = el('div', 'race-hud', parent);
    const tower = el('div', 'race-tower', this.root);
    const head = el('div', 'race-head', tower);
    this.pos = el('div', 'race-pos', head);
    this.pos.hidden = !showPosition;
    this.lap = el('div', 'race-lap', head);
    this.time = el('div', 'race-time', tower);
    this.invalid = el('div', 'race-invalid', tower);
    this.invalid.hidden = true;
    this.sectorCount = sectorCount;
    const secRow = el('div', 'race-sectors', tower);
    for (let i = 0; i < sectorCount; i++) {
      const s = el('div', 'race-sector', secRow);
      s.textContent = `S${i + 1}`;
      this.sectors.push(s);
    }
    const rows = el('div', 'race-rows', tower);
    const row = (label: string) => {
      const r = el('div', 'race-row', rows);
      el('span', 'k', r).textContent = label;
      return el('span', 'v', r);
    };
    this.last = row('Dernier');
    this.best = row('Meilleur');

    this.map = el('canvas', 'race-map', this.root);
    this.map.width = this.map.height = 220;
    this.outline = outline;
    this.map.hidden = !outline;
    if (outline) this.fitMap(outline);

    this.lights = el('div', 'race-lights', this.root);
    for (let i = 0; i < 5; i++) this.lamps.push(el('div', 'lamp', this.lights));
    this.lights.hidden = true;
  }

  private fitMap(pts: Array<[number, number]>): void {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const [x, z] of pts) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }
    // Canvas shaped like the circuit (wide circuits get a wide map).
    const W = 236;
    const scale = W / Math.max(maxX - minX, maxZ - minZ);
    this.map.width = Math.round((maxX - minX) * scale + 24);
    this.map.height = Math.round((maxZ - minZ) * scale + 24);
    this.map.style.width = `${this.map.width * 0.8}px`;
    this.map.style.height = `${this.map.height * 0.8}px`;
    this.bounds = { minX, minZ, scale, ox: 12, oz: 12 };
  }

  /** Start lights: `t` = seconds before the start (5 lamps light one per second, out = go). */
  setCountdown(t: number | null): void {
    if (t === null) {
      this.lights.hidden = true;
      return;
    }
    this.lights.hidden = false;
    const lit = t > 0 ? Math.min(5, Math.max(0, Math.ceil(5 - t + 0.0001))) : 0;
    this.lamps.forEach((l, i) => {
      l.classList.toggle('on', t > 0 && i < lit);
      l.classList.toggle('go', t <= 0);
    });
  }

  /** Timing events of the player (sector deltas, lap end, invalidation). */
  event(ev: TimerEvents): void {
    if (ev.sector) {
      const s = ev.sector;
      const box = this.sectors[s.index];
      if (box) {
        box.className = 'race-sector ' + (s.delta === null ? 'done' : s.delta <= 0 ? 'best' : 'slower');
        box.textContent = s.delta === null ? s.time.toFixed(1) : `${s.delta <= 0 ? '−' : '+'}${Math.abs(s.delta).toFixed(2)}`;
      }
      this.sectorHold = 4;
    }
    if (ev.lap) {
      // Keep the finished lap's sectors on screen a moment, then reset for the new lap.
      this.sectorHold = 4;
    }
  }

  update(dt: number, player: Racer, racers: readonly Racer[]): void {
    const t = player.timer;
    if (!t) return;
    // Position by distance covered.
    let ahead = 0;
    for (const r of racers) if (r !== player && r.progress > player.progress) ahead++;
    this.pos.innerHTML = `<b>P${ahead + 1}</b><small>/${racers.length}</small>`;
    if (t.sprint) this.lap.innerHTML = t.finished ? '<b>Arrivée</b>' : t.started ? `Sprint <b>${((t.length - t.local(player.s)) / 1000).toFixed(1)} km</b>` : 'Vers le départ';
    else this.lap.innerHTML = t.started ? `Tour <b>${t.laps + 1}</b>` : 'Tour de lancement';
    this.time.textContent = t.finished && t.lastLap ? formatLapTime(t.lastLap.time) : t.started ? formatLapTime(t.current) : '–:––.–––';
    this.time.classList.toggle('bad', t.started && !t.valid);
    this.invalid.hidden = !(t.started && !t.valid);
    if (!this.invalid.hidden) this.invalid.textContent = `Tour invalidé · ${t.invalidReason}`;
    this.last.textContent = t.lastLap ? formatLapTime(t.lastLap.time) : '–';
    this.best.textContent = t.bestLap ? formatLapTime(t.bestLap.time) : '–';

    if (this.sectorHold > 0) {
      this.sectorHold -= dt;
      if (this.sectorHold <= 0 && t.currentSector === 0) {
        this.sectors.forEach((s, i) => {
          s.className = 'race-sector';
          s.textContent = `S${i + 1}`;
        });
      }
    }
    for (let i = 0; i < this.sectorCount; i++) this.sectors[i].classList.toggle('live', t.started && i === t.currentSector && this.sectorHold <= 0);

    this.mapTimer -= dt;
    if (this.outline && this.mapTimer <= 0) {
      this.mapTimer = 1 / 15;
      this.drawMap(player, racers);
    }
  }

  private drawMap(player: Racer, racers: readonly Racer[]): void {
    const g = this.map.getContext('2d')!;
    const b = this.bounds;
    const P = (x: number, z: number): [number, number] => [b.ox + (x - b.minX) * b.scale, b.oz + (z - b.minZ) * b.scale];
    g.clearRect(0, 0, this.map.width, this.map.height);
    g.lineJoin = 'round';
    g.beginPath();
    this.outline!.forEach(([x, z], i) => {
      const [px, pz] = P(x, z);
      if (i === 0) g.moveTo(px, pz);
      else g.lineTo(px, pz);
    });
    g.closePath();
    g.strokeStyle = 'rgba(0,0,0,0.55)';
    g.lineWidth = 9;
    g.stroke();
    g.strokeStyle = 'rgba(238,242,247,0.85)';
    g.lineWidth = 4;
    g.stroke();
    // Start line.
    const [sx, sz] = P(this.outline![0][0], this.outline![0][1]);
    g.fillStyle = '#ffcf3f';
    g.fillRect(sx - 2, sz - 7, 4, 14);
    racers.forEach((r, i) => {
      if (r === player) return;
      const [x, z] = P(r.vehicle.x, r.vehicle.z);
      g.fillStyle = DOTS[i % DOTS.length];
      g.beginPath();
      g.arc(x, z, 4.5, 0, Math.PI * 2);
      g.fill();
    });
    const [x, z] = P(player.vehicle.x, player.vehicle.z);
    g.fillStyle = '#ffcf3f';
    g.strokeStyle = '#000';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(x, z, 6.5, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
}
