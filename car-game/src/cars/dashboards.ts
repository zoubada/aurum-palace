import type { DashStyle } from './types';

/**
 * Instrument clusters drawn on a canvas, one layout per brand, inspired by each car's real
 * display (PROVISIONAL until the real models bring their own screens):
 *  - Audi virtual cockpit: two round dials with a central info area
 *  - Porsche GT: central analogue rev counter to 9 000 rpm, digital side panels
 *  - Ford Mustang: 12.4" digital cluster with an arc rev counter
 *  - BMW M: curved display, segmented rev band
 *  - Nissan GT-R: large central analogue rev counter
 *  - McLaren: folding driver display, horizontal rev bar and big gear
 */

export interface DashState {
  speedKmh: number;
  rpm: number;
  redline: number;
  gear: number;
  boost: number;
  autoGear: boolean;
}

export const DASH_WIDTH = 768;
export const DASH_HEIGHT = 288;

const gearLabel = (g: number) => (g === -1 ? 'R' : g === 0 ? 'N' : String(g));

function dial(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  value: number,
  max: number,
  opts: { start?: number; sweep?: number; major: number; red?: number; label?: (v: number) => string; needle: string; face?: string; tick?: string },
): void {
  const start = opts.start ?? Math.PI * 0.75;
  const sweep = opts.sweep ?? Math.PI * 1.5;
  ctx.save();
  if (opts.face) {
    ctx.fillStyle = opts.face;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  if (opts.red !== undefined) {
    ctx.strokeStyle = '#d61f1f';
    ctx.lineWidth = r * 0.07;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.9, start + (opts.red / max) * sweep, start + sweep);
    ctx.stroke();
  }
  ctx.strokeStyle = opts.tick ?? '#e9edf2';
  ctx.fillStyle = opts.tick ?? '#e9edf2';
  ctx.font = `600 ${Math.round(r * 0.16)}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let v = 0; v <= max + 1e-6; v += opts.major / 2) {
    const a = start + (v / max) * sweep;
    const major = Math.abs(v / opts.major - Math.round(v / opts.major)) < 1e-6;
    ctx.lineWidth = major ? r * 0.03 : r * 0.015;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 0.95, cy + Math.sin(a) * r * 0.95);
    ctx.lineTo(cx + Math.cos(a) * r * (major ? 0.8 : 0.87), cy + Math.sin(a) * r * (major ? 0.8 : 0.87));
    ctx.stroke();
    if (major && opts.label) ctx.fillText(opts.label(v), cx + Math.cos(a) * r * 0.64, cy + Math.sin(a) * r * 0.64);
  }
  const a = start + (Math.min(value, max * 1.02) / max) * sweep;
  ctx.strokeStyle = opts.needle;
  ctx.lineWidth = r * 0.045;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - Math.cos(a) * r * 0.12, cy - Math.sin(a) * r * 0.12);
  ctx.lineTo(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9);
  ctx.stroke();
  ctx.fillStyle = '#16191e';
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, weight = 700, align: CanvasTextAlign = 'center'): void {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px Arial, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}

export function drawDash(ctx: CanvasRenderingContext2D, style: DashStyle, s: DashState): void {
  const W = DASH_WIDTH;
  const H = DASH_HEIGHT;
  const rpmMax = Math.ceil((s.redline + 500) / 1000) * 1000;
  const speed = Math.round(s.speedKmh);
  ctx.fillStyle = '#040507';
  ctx.fillRect(0, 0, W, H);

  switch (style) {
    case 'audi-virtual': {
      const k = (v: number) => String(v / 1000);
      dial(ctx, 150, 150, 128, s.speedKmh, 320, { major: 40, label: (v) => String(v), needle: '#ff2a1f' });
      dial(ctx, W - 150, 150, 128, s.rpm, rpmMax, { major: 1000, red: s.redline, label: k, needle: '#ff2a1f' });
      text(ctx, String(speed), W / 2, 112, 64, '#f4f6f8');
      text(ctx, 'km/h', W / 2, 152, 20, '#9aa3ad', 500);
      text(ctx, gearLabel(s.gear), W / 2, 210, 44, '#ff2a1f');
      text(ctx, s.autoGear ? 'S' : 'M', W / 2 + 42, 214, 20, '#9aa3ad');
      break;
    }
    case 'porsche-gt': {
      dial(ctx, W / 2, 150, 134, s.rpm, rpmMax, { major: 1000, red: s.redline, label: (v) => String(v / 1000), needle: '#ffb000', face: '#0b0d10' });
      text(ctx, gearLabel(s.gear), W / 2, 205, 40, '#f4f6f8');
      text(ctx, String(speed), 120, 130, 56, '#f4f6f8');
      text(ctx, 'km/h', 120, 172, 18, '#9aa3ad', 500);
      const on = s.rpm > s.redline * 0.92;
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = on ? (i < 2 ? '#25d05a' : i < 4 ? '#ffb000' : '#ff2a1f') : '#1c2026';
        ctx.fillRect(W - 210 + i * 34, 120, 26, 26);
      }
      break;
    }
    case 'ford-digital': {
      const start = Math.PI * 0.85;
      const sweep = Math.PI * 1.3;
      const frac = Math.min(1, s.rpm / rpmMax);
      ctx.lineWidth = 22;
      ctx.strokeStyle = '#13202c';
      ctx.beginPath();
      ctx.arc(W / 2, 175, 150, start, start + sweep);
      ctx.stroke();
      const grad = ctx.createLinearGradient(W / 2 - 150, 0, W / 2 + 150, 0);
      grad.addColorStop(0, '#1d8bff');
      grad.addColorStop(0.75, '#22c3ff');
      grad.addColorStop(1, '#ff4b1f');
      ctx.strokeStyle = grad;
      ctx.beginPath();
      ctx.arc(W / 2, 175, 150, start, start + sweep * frac);
      ctx.stroke();
      text(ctx, String(speed), W / 2, 160, 74, '#f4f6f8');
      text(ctx, 'km/h', W / 2, 206, 18, '#8fb4d6', 500);
      text(ctx, gearLabel(s.gear), W / 2, 248, 30, '#22c3ff');
      text(ctx, 'GT', 70, 50, 22, '#8fb4d6');
      break;
    }
    case 'bmw-curved': {
      const segs = 36;
      const frac = Math.min(1, s.rpm / rpmMax);
      for (let i = 0; i < segs; i++) {
        const at = (i + 1) / segs;
        const lit = at <= frac;
        const rpmAt = at * rpmMax;
        ctx.fillStyle = !lit ? '#191c21' : rpmAt > s.redline ? '#ff3b2f' : rpmAt > s.redline * 0.85 ? '#ff8a1f' : '#e9edf2';
        const x = 40 + i * 14;
        const y = 210 - Math.sin((i / segs) * Math.PI * 0.7) * 120;
        ctx.fillRect(x, y, 10, 22);
      }
      text(ctx, String(speed), W - 170, 130, 70, '#f4f6f8');
      text(ctx, 'km/h', W - 170, 176, 18, '#9aa3ad', 500);
      text(ctx, gearLabel(s.gear), W - 60, 130, 46, '#ff8a1f');
      ctx.fillStyle = '#0066b1';
      ctx.fillRect(W - 250, 230, 40, 8);
      ctx.fillStyle = '#1b3f8f';
      ctx.fillRect(W - 206, 230, 40, 8);
      ctx.fillStyle = '#e4002b';
      ctx.fillRect(W - 162, 230, 40, 8);
      break;
    }
    case 'nissan-analog': {
      dial(ctx, 170, 160, 112, s.speedKmh, 340, { major: 40, label: (v) => String(v), needle: '#ff3b2f', face: '#0a0b0e' });
      dial(ctx, W / 2 + 60, 150, 134, s.rpm, rpmMax, { major: 1000, red: s.redline, label: (v) => String(v / 1000), needle: '#ff3b2f', face: '#0a0b0e' });
      text(ctx, gearLabel(s.gear), W / 2 + 60, 210, 36, '#f4f6f8');
      text(ctx, `${speed}`, W - 85, 120, 34, '#f4f6f8');
      text(ctx, 'km/h', W - 85, 150, 14, '#9aa3ad', 500);
      text(ctx, `BOOST ${(s.boost * 1.1).toFixed(1)}`, W - 85, 200, 16, '#9aa3ad', 600);
      break;
    }
    case 'mclaren-folding': {
      const frac = Math.min(1, s.rpm / rpmMax);
      ctx.fillStyle = '#15181d';
      ctx.fillRect(40, 40, W - 80, 30);
      ctx.fillStyle = s.rpm > s.redline * 0.93 ? '#ff6a00' : '#f0f2f5';
      ctx.fillRect(40, 40, (W - 80) * frac, 30);
      text(ctx, gearLabel(s.gear), W / 2, 160, 120, '#ff8000');
      text(ctx, String(speed), W / 2 - 220, 170, 58, '#f4f6f8');
      text(ctx, 'km/h', W / 2 - 220, 214, 16, '#9aa3ad', 500);
      text(ctx, `${Math.round(s.rpm / 10) * 10}`, W / 2 + 220, 170, 40, '#f4f6f8');
      text(ctx, 'tr/min', W / 2 + 220, 206, 16, '#9aa3ad', 500);
      break;
    }
    default: {
      text(ctx, String(speed), W / 2, 140, 80, '#f4f6f8');
      text(ctx, gearLabel(s.gear), W - 80, 140, 60, '#ffb000');
    }
  }
}
