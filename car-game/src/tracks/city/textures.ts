import * as THREE from 'three';

/** Canvas textures for the city: kerbs, ad boards, neon signs, LED screens, tunnel tiles. */

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function tex(c: HTMLCanvasElement, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** Red/white kerb stripes (one red + one white block along v). */
export function kerbTexture(): THREE.Texture {
  const [c, g] = canvas(64, 256);
  g.fillStyle = '#c8141c';
  g.fillRect(0, 0, 64, 128);
  g.fillStyle = '#e8e8e4';
  g.fillRect(0, 128, 64, 128);
  return tex(c);
}

/** Start/finish chequers. */
export function chequerTexture(): THREE.Texture {
  const [c, g] = canvas(256, 64);
  for (let x = 0; x < 16; x++)
    for (let y = 0; y < 4; y++) {
      g.fillStyle = (x + y) % 2 ? '#111' : '#eee';
      g.fillRect(x * 16, y * 16, 16, 16);
    }
  return tex(c);
}

/** Fictional sponsors for the wall panels (no real brands). */
const SPONSORS: Array<[string, string, string]> = [
  ['MÉTROPOLE GRAND PRIX', '#0d1c3a', '#ffcf3f'],
  ['VOLTA ÉNERGIE', '#0b2f22', '#7cf2b0'],
  ['NOVA TÉLÉCOM', '#2a0d36', '#e6a8ff'],
  ['ATLAS PNEUMATIQUES', '#1a1a1a', '#ff6a1f'],
  ['LUMEN', '#f2f2ee', '#14161a'],
  ['CAFÉ ORBITE', '#3a1a0c', '#ffd8a8'],
];

/** One texture holding all sponsor panels stacked vertically (u along the wall). */
export function sponsorTexture(): THREE.Texture {
  const [c, g] = canvas(1024, 64 * SPONSORS.length);
  SPONSORS.forEach(([name, bg, fg], i) => {
    g.fillStyle = bg;
    g.fillRect(0, i * 64, 1024, 64);
    g.fillStyle = fg;
    g.font = 'bold 40px Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(name, 512, i * 64 + 34);
  });
  const t = tex(c);
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
export const SPONSOR_COUNT = SPONSORS.length;

/** Glowing neon sign (emissive map: bright tube on black). */
export function neonTexture(text: string, color: string): THREE.Texture {
  const [c, g] = canvas(512, 128);
  g.fillStyle = '#000';
  g.fillRect(0, 0, 512, 128);
  g.font = 'bold 76px "Arial Rounded MT Bold", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 24;
  g.strokeStyle = color;
  g.lineWidth = 6;
  g.strokeText(text, 256, 68);
  g.fillStyle = '#fff';
  g.shadowBlur = 8;
  g.fillText(text, 256, 68);
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export const NEON_SIGNS: Array<[string, string]> = [
  ['HÔTEL', '#ff3b6b'],
  ['NOODLES', '#3bd5ff'],
  ['CINÉMA', '#ffb43b'],
  ['BAR 24H', '#c03bff'],
  ['PHARMACIE', '#3bff7a'],
  ['KARAOKÉ', '#ff4fd8'],
  ['PARKING', '#4f8cff'],
  ['SUSHI', '#ff6a3b'],
  ['JAZZ CLUB', '#ffe23b'],
  ['LAVERIE', '#7affef'],
];

/** Animated LED screen: redrawn by `drawLed` a few times per second. */
export function ledScreen(): { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture } {
  const [c] = canvas(512, 256);
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return { canvas: c, texture: t };
}

export function drawLed(c: HTMLCanvasElement, time: number, variant: number): void {
  const g = c.getContext('2d')!;
  const W = c.width;
  const H = c.height;
  const hue = (time * 20 + variant * 120) % 360;
  const grad = g.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, `hsl(${hue}, 85%, 45%)`);
  grad.addColorStop(1, `hsl(${(hue + 60) % 360}, 85%, 25%)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,255,255,0.92)';
  g.font = 'bold 54px Arial, sans-serif';
  g.textBaseline = 'middle';
  const msgs = ['MÉTROPOLE GRAND PRIX', 'NUIT DE COURSE', 'VOLTA ÉNERGIE', 'BIENVENUE EN VILLE'];
  const msg = msgs[(Math.floor(time / 6) + variant) % msgs.length];
  const w = g.measureText(msg).width;
  const x = W - ((time * 160 + variant * 200) % (W + w));
  g.fillText(msg, x, H / 2);
  // Pixel grid of the LED panel.
  g.fillStyle = 'rgba(0,0,0,0.35)';
  for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);
  for (let xx = 0; xx < W; xx += 4) g.fillRect(xx, 0, 1, H);
}

/** Tunnel wall tiles. */
export function tunnelTileTexture(): THREE.Texture {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#b9bcbd';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#8d9192';
  g.lineWidth = 2;
  for (let i = 0; i <= 256; i += 32) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i, 256);
    g.moveTo(0, i);
    g.lineTo(256, i);
    g.stroke();
  }
  g.fillStyle = '#1e5aa8';
  g.fillRect(0, 190, 256, 14);
  return tex(c);
}
