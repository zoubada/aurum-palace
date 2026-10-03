import * as THREE from 'three';

/**
 * Procedural, tileable textures generated at load time (no asset download).
 * They are good-looking stand-ins until the photogrammetry/PBR texture sets of the
 * circuits are added (Phases 3–5).
 */

function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** Tileable value noise in [0,1]; `period` = number of cells across the texture. */
function valueNoise(u: number, v: number, period: number, seed: number): number {
  const x = u * period;
  const y = v * period;
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const sx = xf * xf * (3 - 2 * xf);
  const sy = yf * yf * (3 - 2 * yf);
  const x0 = ((xi % period) + period) % period;
  const y0 = ((yi % period) + period) % period;
  const x1 = (x0 + 1) % period;
  const y1 = (y0 + 1) % period;
  const a = hash(x0, y0, seed);
  const b = hash(x1, y0, seed);
  const c = hash(x0, y1, seed);
  const d = hash(x1, y1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function fbm(u: number, v: number, base: number, octaves: number, seed: number): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let period = base;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(u, v, period, seed + i * 17) * amp;
    norm += amp;
    amp *= 0.5;
    period *= 2;
  }
  return sum / norm;
}

function canvasTexture(
  size: number,
  pixel: (u: number, v: number, x: number, y: number) => [number, number, number],
  srgb: boolean,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x / size, y / size, x, y);
      const i = (y * size + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

export interface SurfaceTextures {
  map: THREE.Texture;
  roughness: THREE.Texture;
  bump: THREE.Texture;
}

/** Asphalt: aggregate speckles, tar patches, polished wheel paths in the roughness. */
export function asphaltTextures(size = 1024): SurfaceTextures {
  const grain = new Float32Array(size * size);
  const blotch = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const i = y * size + x;
      const stone = hash(x, y, 7);
      const coarse = fbm(u, v, 64, 3, 3);
      grain[i] = stone > 0.93 ? 0.35 + stone * 0.4 : coarse * 0.35 + stone * 0.15;
      blotch[i] = fbm(u, v, 4, 4, 11);
    }
  }
  const map = canvasTexture(
    size,
    (_u, _v, x, y) => {
      const i = y * size + x;
      const base = 38 + grain[i] * 55 + (blotch[i] - 0.5) * 22;
      return [base, base * 1.01, base * 1.04];
    },
    true,
  );
  const roughness = canvasTexture(
    size,
    (_u, _v, x, y) => {
      const i = y * size + x;
      const r = 210 - grain[i] * 50 - (blotch[i] - 0.5) * 40;
      return [r, r, r];
    },
    false,
  );
  const bump = canvasTexture(
    size,
    (_u, _v, x, y) => {
      const b = grain[y * size + x] * 255;
      return [b, b, b];
    },
    false,
  );
  return { map, roughness, bump };
}

/** Short dry grass seen from a car: mottled greens and straw. */
export function grassTexture(size = 512): THREE.Texture {
  return canvasTexture(
    size,
    (u, v, x, y) => {
      const n = fbm(u, v, 8, 5, 21);
      const blade = hash(x, y, 5);
      const g = 70 + n * 60 + blade * 25;
      return [g * 0.62 + n * 25, g, g * 0.38];
    },
    true,
  );
}

/** Weathered concrete for barriers and buildings. */
export function concreteTexture(size = 512): THREE.Texture {
  return canvasTexture(
    size,
    (u, v, x, y) => {
      const n = fbm(u, v, 6, 5, 31);
      const s = hash(x, y, 9);
      const c = 150 + n * 60 + s * 18;
      return [c, c * 0.99, c * 0.96];
    },
    true,
  );
}

/**
 * Soft radial blob used for the car contact shadow and tire smoke.
 * Stored as opaque greyscale (white centre → black edge) so any channel can be
 * sampled as a mask: a canvas alpha gradient would leave RGB white everywhere.
 */
export function radialTexture(size = 128, inner = 0.0): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, size * inner * 0.5, size / 2, size / 2, size / 2);
  g.addColorStop(0, '#fff');
  g.addColorStop(0.55, '#7a7a7a');
  g.addColorStop(1, '#000');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

/** Text on a panel (distance boards, signs). */
export function signTexture(text: string, bg: string, fg: string, w = 256, h = 128): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = fg;
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, w - 12, h - 12);
  ctx.fillStyle = fg;
  ctx.font = `bold ${Math.floor(h * 0.62)}px "Arial Narrow", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 4);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
