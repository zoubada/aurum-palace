import type { Vehicle } from '../physics/vehicle';
import { G, clamp } from '../physics/math';

/**
 * In-race HUD (SPEC §9): speed, gear, rev bar with shift lights, G-meter,
 * pedals, active-aid indicators, FPS. Plain DOM, updated once per frame
 * with only the values that changed.
 */

const RPM_SEGMENTS = 32;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, parent?: HTMLElement): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  parent?.appendChild(e);
  return e;
}

export class HUD {
  readonly root: HTMLDivElement;
  private readonly speed: HTMLDivElement;
  private readonly gear: HTMLDivElement;
  private readonly gearMode: HTMLDivElement;
  private readonly rpmSegs: HTMLDivElement[] = [];
  private readonly rpmText: HTMLDivElement;
  private readonly chips: Record<'abs' | 'tc' | 'esp', HTMLDivElement>;
  private readonly fps: HTMLDivElement;
  private readonly info: HTMLDivElement;
  private readonly gCanvas: HTMLCanvasElement;
  private readonly throttleBar: HTMLDivElement;
  private readonly brakeBar: HTMLDivElement;
  private readonly steerDot: HTMLDivElement;
  private readonly help: HTMLDivElement;
  private readonly debug: HTMLPreElement;
  private readonly toast: HTMLDivElement;
  private toastTimer = 0;
  private gTrail: Array<[number, number]> = [];
  private frames = 0;
  private fpsStart = performance.now();
  /** CPU time of the last frame's simulation / render submission (ms), shown with F3. */
  perf = { sim: 0, render: 0 };
  private lastRpmLit = -1;
  debugVisible = false;

  constructor(parent: HTMLElement, carName: string, placeholder: boolean) {
    this.root = el('div', 'hud', parent);

    const tl = el('div', 'hud-tl', this.root);
    this.fps = el('div', 'hud-fps', tl);
    this.info = el('div', 'hud-info', tl);

    if (placeholder) {
      const banner = el('div', 'hud-banner', this.root);
      banner.innerHTML = `<b>PHASE 1 — PROVISOIRE</b> · ${carName} (voiture placeholder) · piste d'essai plate`;
    }

    // Bottom-right cluster.
    const cluster = el('div', 'hud-cluster', this.root);
    const rpm = el('div', 'hud-rpm', cluster);
    for (let i = 0; i < RPM_SEGMENTS; i++) this.rpmSegs.push(el('div', 'seg', rpm));
    const row = el('div', 'hud-row', cluster);
    const speedBox = el('div', 'hud-speedbox', row);
    this.speed = el('div', 'hud-speed', speedBox);
    el('div', 'hud-unit', speedBox).textContent = 'km/h';
    const gearBox = el('div', 'hud-gearbox', row);
    this.gear = el('div', 'hud-gear', gearBox);
    this.gearMode = el('div', 'hud-gearmode', gearBox);
    this.rpmText = el('div', 'hud-rpmtext', cluster);
    const chips = el('div', 'hud-chips', cluster);
    this.chips = {
      abs: el('div', 'chip', chips),
      tc: el('div', 'chip', chips),
      esp: el('div', 'chip', chips),
    };
    this.chips.abs.textContent = 'ABS';
    this.chips.tc.textContent = 'TC';
    this.chips.esp.textContent = 'ESP';

    // Bottom-left: G-meter + pedals + steering.
    const bl = el('div', 'hud-bl', this.root);
    this.gCanvas = el('canvas', 'hud-g', bl);
    this.gCanvas.width = this.gCanvas.height = 240;
    const pedals = el('div', 'hud-pedals', bl);
    const mk = (label: string, cls: string) => {
      const w = el('div', 'pedal', pedals);
      const bar = el('div', `fill ${cls}`, w);
      el('span', '', w).textContent = label;
      return bar;
    };
    this.throttleBar = mk('ACC', 'thr');
    this.brakeBar = mk('FRN', 'brk');
    const steer = el('div', 'hud-steer', bl);
    this.steerDot = el('div', 'dot', steer);

    this.help = el('div', 'hud-help', this.root);
    this.help.innerHTML = [
      '<b>↑ / Z·W</b> accélérer',
      '<b>↓ / S</b> freiner · marche arrière',
      '<b>← → / Q·A D</b> diriger',
      '<b>Espace</b> frein à main',
      '<b>E / A·Q</b> rapport + / −',
      '<b>C</b> caméra · <b>V</b> regarder derrière',
      '<b>R</b> replacer · <b>Échap</b> menu',
    ].join('<br>');

    this.toast = el('div', 'hud-toast', this.root);
    this.debug = el('pre', 'hud-debug', this.root);
    this.debug.style.display = 'none';
    setTimeout(() => this.help.classList.add('faded'), 12000);
  }

  setVisible(v: boolean): void {
    this.root.style.display = v ? '' : 'none';
  }

  toggleDebug(): void {
    this.debugVisible = !this.debugVisible;
    this.debug.style.display = this.debugVisible ? '' : 'none';
  }

  showToast(text: string): void {
    this.toast.textContent = text;
    this.toast.classList.add('show');
    this.toastTimer = 1.8;
  }

  setInfo(lines: string[]): void {
    this.info.innerHTML = lines.join('<br>');
  }

  update(dt: number, v: Vehicle, steerInput: number): void {
    // FPS from wall-clock time (not the capped simulation dt), averaged over 0.5 s.
    this.frames++;
    const now = performance.now();
    const elapsed = (now - this.fpsStart) / 1000;
    if (elapsed >= 0.5) {
      const fps = this.frames / elapsed;
      this.fps.textContent = `${fps < 10 ? fps.toFixed(1) : Math.round(fps)} FPS`;
      this.frames = 0;
      this.fpsStart = now;
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toast.classList.remove('show');
    }

    this.speed.textContent = String(Math.round(v.speedKmh));
    const g = v.gear;
    this.gear.textContent = g === -1 ? 'R' : g === 0 ? 'N' : String(g);
    this.gear.classList.toggle('shifting', v.shiftTimer > 0);
    this.gearMode.textContent = v.assists.autoGear ? 'AUTO' : 'MANUEL';

    const red = v.cfg.engine.redlineRpm;
    const maxRpm = red + 500;
    const lit = Math.round((clamp(v.engineRpm, 0, maxRpm) / maxRpm) * RPM_SEGMENTS);
    if (lit !== this.lastRpmLit) {
      this.lastRpmLit = lit;
      for (let i = 0; i < RPM_SEGMENTS; i++) {
        const seg = this.rpmSegs[i];
        const rpmAt = ((i + 1) / RPM_SEGMENTS) * maxRpm;
        seg.className = `seg${i < lit ? ' on' : ''}${rpmAt > red ? ' red' : rpmAt > red * 0.86 ? ' amber' : ''}`;
      }
    }
    const flash = v.engineRpm > red * 0.95 && v.gear > 0;
    this.root.classList.toggle('shift-flash', flash && Math.floor(performance.now() / 80) % 2 === 0);
    this.rpmText.textContent = `${Math.round(v.engineRpm / 10) * 10} tr/min`;

    this.chips.abs.className = `chip${v.assists.abs ? '' : ' off'}${v.absActive ? ' active' : ''}`;
    this.chips.tc.className = `chip${v.assists.tc ? '' : ' off'}${v.tcActive ? ' active' : ''}`;
    this.chips.esp.className = `chip${v.assists.esp ? '' : ' off'}${v.espActive ? ' active' : ''}`;

    this.throttleBar.style.transform = `scaleY(${v.appliedThrottle.toFixed(3)})`;
    this.brakeBar.style.transform = `scaleY(${v.appliedBrake.toFixed(3)})`;
    this.steerDot.style.left = `${50 + steerInput * 50}%`;

    this.drawG(v);
    if (this.debugVisible) this.drawDebug(v);
  }

  private drawG(v: Vehicle): void {
    const ctx = this.gCanvas.getContext('2d')!;
    const S = this.gCanvas.width;
    const c = S / 2;
    const scale = (S / 2 - 14) / 1.5; // 1.5 g at the edge
    ctx.clearRect(0, 0, S, S);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    for (const gR of [0.5, 1, 1.5]) {
      ctx.beginPath();
      ctx.arc(c, c, gR * scale, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(c, 10);
    ctx.lineTo(c, S - 10);
    ctx.moveTo(10, c);
    ctx.lineTo(S - 10, c);
    ctx.stroke();
    // The dot shows the force felt by the driver: right turn → left, braking → up (forward).
    const gx = v.ayF / G;
    const gy = v.axF / G;
    this.gTrail.push([gx, gy]);
    if (this.gTrail.length > 40) this.gTrail.shift();
    this.gTrail.forEach(([x, y], i) => {
      ctx.fillStyle = `rgba(120,190,255,${(i / this.gTrail.length) * 0.4})`;
      ctx.beginPath();
      ctx.arc(c + x * scale, c + y * scale, 4, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath();
    ctx.arc(c + gx * scale, c + gy * scale, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '600 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.hypot(gx, gy).toFixed(2)} g`, c, S - 18);
  }

  private drawDebug(v: Vehicle): void {
    const names = ['AVG', 'AVD', 'ARG', 'ARD'];
    const rows = v.wheels.map(
      (w, i) =>
        `${names[i]}  Fz ${(w.fz / 1000).toFixed(2).padStart(5)} kN  κ ${w.kappa.toFixed(3).padStart(7)}  α ${((w.alpha * 180) / Math.PI).toFixed(1).padStart(6)}°  ρ ${w.rho.toFixed(2)}  ABS ${w.absFactor.toFixed(2)}  T ${w.driveTorque.toFixed(0).padStart(5)}`,
    );
    const beta = (Math.atan2(v.v, Math.max(0.1, Math.abs(v.u))) * 180) / Math.PI;
    this.debug.textContent = [
      `u ${v.u.toFixed(2)} m/s   v ${v.v.toFixed(2)} m/s   r ${v.r.toFixed(3)} rad/s   β ${beta.toFixed(1)}°`,
      `ax ${(v.axF / G).toFixed(2)} g   ay ${(v.ayF / G).toFixed(2)} g   δ ${((v.steerAngle * 180) / Math.PI).toFixed(1)}°`,
      `CPU : simulation ${this.perf.sim.toFixed(2)} ms · envoi rendu ${this.perf.render.toFixed(2)} ms`,
      `moteur ${v.engineRpm.toFixed(0)} tr/min  couple ${v.engineTorque.toFixed(0)} N·m  embrayage ${v.clutchSlipping ? 'patine' : 'verrouillé'}${v.revLimiterOn ? '  LIMITEUR' : ''}`,
      ...rows,
    ].join('\n');
  }
}
