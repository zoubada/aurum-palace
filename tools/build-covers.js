'use strict';
/* Génère assets/covers/<id>.svg : une illustration de vignette par jeu.
   Usage : node tools/build-covers.js   (nécessite python3 + fonttools pour sous-ensembler les polices) */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'assets/covers');
const FONTS = { cinzel: path.join(ROOT, 'assets/fonts/cinzel-latin.woff2'), inter: path.join(ROOT, 'assets/fonts/inter-latin.woff2') };
const W = 300, H = 400;

let seed = 1;
const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 4294967296; };
const f = n => Math.round(n * 100) / 100;

function subsetFont(file, text) {
  const tmp = path.join(require('os').tmpdir(), 'cov-' + process.pid + '-' + path.basename(file));
  execFileSync('python3', ['-m', 'fontTools.subset', file, '--text=' + text, '--flavor=woff2', '--output-file=' + tmp, '--layout-features=*']);
  const b = fs.readFileSync(tmp).toString('base64'); fs.unlinkSync(tmp); return b;
}
const png = n => 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'assets/slots-symbols', n + '.png')).toString('base64');

/* ---------- primitives ---------- */
const COMMON_DEFS = `
<linearGradient id="goldT" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF9DC"/><stop offset=".38" stop-color="#F6D77A"/><stop offset=".55" stop-color="#C98E26"/><stop offset=".62" stop-color="#F3CE6A"/><stop offset="1" stop-color="#8C5A0A"/></linearGradient>
<linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF3BF"/><stop offset=".3" stop-color="#F0C75E"/><stop offset=".6" stop-color="#B8841E"/><stop offset=".8" stop-color="#E9BE55"/><stop offset="1" stop-color="#7A4E08"/></linearGradient>
<linearGradient id="goldV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF0B0"/><stop offset=".45" stop-color="#E2B13F"/><stop offset="1" stop-color="#8A5A0B"/></linearGradient>
<radialGradient id="goldR" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#FFF7D0"/><stop offset=".35" stop-color="#F1C95B"/><stop offset=".75" stop-color="#B07A17"/><stop offset="1" stop-color="#6E4506"/></radialGradient>
<linearGradient id="cardG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#E7E2D6"/></linearGradient>
<linearGradient id="fadeB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".55" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity=".92"/></linearGradient>
<radialGradient id="vig" cx=".5" cy=".42" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".7"/></radialGradient>
<radialGradient id="spk"><stop offset="0" stop-color="#fff"/><stop offset=".25" stop-color="#fff" stop-opacity=".7"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<filter id="ds" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000" flood-opacity=".6"/></filter>
<filter id="ds2" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="#000" flood-opacity=".55"/></filter>
<filter id="lds" x="-20%" y="-40%" width="140%" height="200%"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#000" flood-opacity=".85"/></filter>
<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="glow2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="blur8"><feGaussianBlur stdDeviation="8"/></filter>
<filter id="blur3"><feGaussianBlur stdDeviation="3"/></filter>
<filter id="blur18" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="18"/></filter>`;

const rays = (cx, cy, n, color, op, len = 520, rot = 0) => {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a1 = (i / n) * Math.PI * 2 + rot, a2 = a1 + Math.PI / n;
    d += `M${cx},${cy}L${f(cx + Math.cos(a1) * len)},${f(cy + Math.sin(a1) * len)}L${f(cx + Math.cos(a2) * len)},${f(cy + Math.sin(a2) * len)}Z`;
  }
  return `<path d="${d}" fill="${color}" opacity="${op}"/>`;
};
const glowBlob = (cx, cy, r, color, op = 1) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="${op}" filter="url(#blur18)"/>`;
const sparkle = (x, y, s, op = 1, color = '#fff') => `<g transform="translate(${f(x)} ${f(y)})" opacity="${f(op)}"><circle r="${f(s * 1.3)}" fill="url(#spk)"/><path d="M0,${-s}Q0,0 ${s},0Q0,0 0,${s}Q0,0 ${-s},0Q0,0 0,${-s}Z" fill="${color}"/></g>`;
const sparkles = (n, area, smin, smax, color) => Array.from({ length: n }, () => sparkle(area[0] + rnd() * area[2], area[1] + rnd() * area[3], smin + rnd() * (smax - smin), .5 + rnd() * .5, color)).join('');
const dust = (n, area, color, rmax = 1.8) => Array.from({ length: n }, () => `<circle cx="${f(area[0] + rnd() * area[2])}" cy="${f(area[1] + rnd() * area[3])}" r="${f(.4 + rnd() * rmax)}" fill="${color}" opacity="${f(.25 + rnd() * .6)}"/>`).join('');
const bokeh = (n, area, color, rmax = 16) => Array.from({ length: n }, () => `<circle cx="${f(area[0] + rnd() * area[2])}" cy="${f(area[1] + rnd() * area[3])}" r="${f(4 + rnd() * rmax)}" fill="${color}" opacity="${f(.06 + rnd() * .18)}" filter="url(#blur3)"/>`).join('');

const SUIT = {
  h: 'M0,0.95C-0.18,0.72 -1,0.2 -1,-0.36C-1,-0.82 -0.42,-1.02 0,-0.56C0.42,-1.02 1,-0.82 1,-0.36C1,0.2 0.18,0.72 0,0.95Z',
  d: 'M0,-1L0.74,0L0,1L-0.74,0Z',
  s: 'M0,-1C0.32,-0.55 1,-0.22 1,0.24C1,0.66 0.52,0.82 0.14,0.52C0.18,0.78 0.3,0.94 0.46,1L-0.46,1C-0.3,0.94 -0.18,0.78 -0.14,0.52C-0.52,0.82 -1,0.66 -1,0.24C-1,-0.22 -0.32,-0.55 0,-1Z',
  c: 'M0,-0.95A0.37,0.37 0 1 1 -0.01,-0.95ZM-0.46,-0.18A0.37,0.37 0 1 1 -0.47,-0.18ZM0.46,-0.18A0.37,0.37 0 1 1 0.45,-0.18ZM-0.1,0.1L0.1,0.1L0.3,1L-0.3,1Z'
};
const clubPath = 'M0,-0.9m-0.37,0a0.37,0.37 0 1,0 0.74,0a0.37,0.37 0 1,0 -0.74,0M-0.45,0.05m-0.37,0a0.37,0.37 0 1,0 0.74,0a0.37,0.37 0 1,0 -0.74,0M0.45,0.05m-0.37,0a0.37,0.37 0 1,0 0.74,0a0.37,0.37 0 1,0 -0.74,0M-0.1,0L0.1,0L0.32,1L-0.32,1Z';
const suit = (s, x, y, sz, color) => `<path d="${s === 'c' ? clubPath : SUIT[s]}" transform="translate(${f(x)} ${f(y)}) scale(${f(sz)})" fill="${color}"/>`;
const crown = (x, y, s, fill = 'url(#goldV)') => `<path transform="translate(${f(x)} ${f(y)}) scale(${f(s)})" d="M-1,0.55L-1.1,-0.55L-0.5,-0.05L0,-0.8L0.5,-0.05L1.1,-0.55L1,0.55Z" fill="${fill}" stroke="#6E4506" stroke-width="${f(0.06)}"/>`;

function card({ x, y, w, rot = 0, r, s, back = false, backColor = '#7A1022' }) {
  const h = w * 1.4, red = s === 'h' || s === 'd', col = red ? '#C4151C' : '#15171C';
  const rx = w * 0.08;
  if (back) {
    return `<g transform="translate(${f(x)} ${f(y)}) rotate(${rot})" filter="url(#ds)"><rect x="${f(-w / 2)}" y="${f(-h / 2)}" width="${f(w)}" height="${f(h)}" rx="${f(rx)}" fill="#F4F0E6"/><rect x="${f(-w / 2 + w * .07)}" y="${f(-h / 2 + w * .07)}" width="${f(w * .86)}" height="${f(h - w * .14)}" rx="${f(rx * .7)}" fill="${backColor}"/><rect x="${f(-w / 2 + w * .07)}" y="${f(-h / 2 + w * .07)}" width="${f(w * .86)}" height="${f(h - w * .14)}" rx="${f(rx * .7)}" fill="url(#lattice)" opacity=".55"/><path d="M0,${f(-w * .22)}L${f(w * .16)},0L0,${f(w * .22)}L${f(-w * .16)},0Z" fill="url(#goldV)" stroke="#5b3a05" stroke-width=".8"/></g>`;
  }
  const fs1 = w * 0.23, pip = w * 0.075;
  const idx = (flip) => `<g ${flip ? `transform="rotate(180)"` : ''}><text x="${f(-w / 2 + w * .15)}" y="${f(-h / 2 + fs1 * 1.05)}" font-family="Cinzel" font-weight="900" font-size="${f(fs1)}" text-anchor="middle" fill="${col}"${r === '10' ? ` textLength="${f(fs1 * 1.05)}" lengthAdjust="spacingAndGlyphs"` : ''}>${r}</text>${suit(s, -w / 2 + w * .15, -h / 2 + fs1 * 1.55, pip, col)}</g>`;
  let center;
  if (['K', 'Q', 'J'].includes(r)) {
    center = `<rect x="${f(-w * .3)}" y="${f(-h * .3)}" width="${f(w * .6)}" height="${f(h * .6)}" rx="${f(w * .04)}" fill="${red ? '#FBE9E4' : '#ECEFF6'}" stroke="url(#gold)" stroke-width="${f(w * .025)}"/>${crown(0, -h * .1, w * .17)}${suit(s, 0, h * .1, w * .15, col)}<text x="0" y="${f(h * .26)}" font-family="Cinzel" font-weight="900" font-size="${f(w * .12)}" text-anchor="middle" fill="${col}" opacity=".85">${r === 'K' ? 'ROI' : r === 'Q' ? 'DAME' : 'VALET'}</text>`;
  } else {
    center = suit(s, 0, 0, r === 'A' ? w * .3 : w * .2, col);
    if (r === 'A') center = `<circle r="${f(w * .36)}" fill="${red ? '#C4151C' : '#15171C'}" opacity=".05"/>` + center;
  }
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${rot})" filter="url(#ds)"><rect x="${f(-w / 2)}" y="${f(-h / 2)}" width="${f(w)}" height="${f(h)}" rx="${f(rx)}" fill="url(#cardG)" stroke="#BDB5A3" stroke-width=".8"/>${idx(false)}${idx(true)}${center}<rect x="${f(-w / 2)}" y="${f(-h / 2)}" width="${f(w)}" height="${f(h * .5)}" rx="${f(rx)}" fill="#fff" opacity=".18"/></g>`;
}

const CHIP = { red: ['#E23B3B', '#8E1414'], blue: ['#3C73E8', '#15327F'], black: ['#3A3F4C', '#101218'], green: ['#20B27A', '#0B5A3A'], purple: ['#9B5CF0', '#4A1D8A'], gold: ['#F4CD62', '#8C5E0C'] };
function chip(x, y, r, color, { top = true } = {}) {
  const [c1, c2] = CHIP[color], ry = r * 0.42, t = r * 0.2;
  const side = `<path d="M${f(x - r)},${f(y)}L${f(x - r)},${f(y + t)}A${f(r)},${f(ry)} 0 0 0 ${f(x + r)},${f(y + t)}L${f(x + r)},${f(y)}Z" fill="${c2}"/>` +
    [-.72, -.25, .25, .72].map(k => `<rect x="${f(x + k * r - r * .07)}" y="${f(y + Math.sqrt(1 - k * k) * ry * .2)}" width="${f(r * .14 * Math.sqrt(1 - k * k) + 1)}" height="${f(t + Math.sqrt(1 - k * k) * ry * .75)}" fill="#fff" opacity=".85"/>`).join('');
  const tp = top ? `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(r)}" ry="${f(ry)}" fill="${c1}"/><ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(r * .86)}" ry="${f(ry * .86)}" fill="none" stroke="#fff" stroke-width="${f(r * .14)}" stroke-dasharray="${f(r * .32)} ${f(r * .42)}" opacity=".9"/><ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(r * .58)}" ry="${f(ry * .58)}" fill="${c2}" opacity=".55"/><ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(r * .5)}" ry="${f(ry * .5)}" fill="none" stroke="#fff" stroke-width=".8" opacity=".6"/><path d="M${f(x)},${f(y - ry * .3)}L${f(x + r * .18)},${f(y)}L${f(x)},${f(y + ry * .3)}L${f(x - r * .18)},${f(y)}Z" fill="#fff" opacity=".85"/><ellipse cx="${f(x - r * .25)}" cy="${f(y - ry * .35)}" rx="${f(r * .45)}" ry="${f(ry * .3)}" fill="#fff" opacity=".18"/>` : '';
  return side + tp;
}
function stack(x, y, r, colors) {
  const t = r * 0.2; let s = `<ellipse cx="${f(x)}" cy="${f(y + t + 4)}" rx="${f(r * 1.15)}" ry="${f(r * .5)}" fill="#000" opacity=".45" filter="url(#blur3)"/>`;
  colors.forEach((c, i) => { s += chip(x, y - i * t, r, c, { top: i === colors.length - 1 }); });
  return s;
}
function gem(x, y, s, c, rot = 0) {
  const [l, m, d] = c;
  const P = (pts) => pts.map(p => `${f(p[0] * s)},${f(p[1] * s)}`).join(' ');
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${rot})" filter="url(#ds2)">
  <polygon points="${P([[-1, -.3], [-.55, -.8], [.55, -.8], [1, -.3], [0, 1]])}" fill="${m}"/>
  <polygon points="${P([[-.55, -.8], [.55, -.8], [.3, -.3], [-.3, -.3]])}" fill="${l}"/>
  <polygon points="${P([[-1, -.3], [-.55, -.8], [-.3, -.3]])}" fill="${m}"/>
  <polygon points="${P([[1, -.3], [.55, -.8], [.3, -.3]])}" fill="${d}"/>
  <polygon points="${P([[-1, -.3], [-.3, -.3], [0, 1]])}" fill="${l}" opacity=".75"/>
  <polygon points="${P([[-.3, -.3], [.3, -.3], [0, 1]])}" fill="${m}"/>
  <polygon points="${P([[.3, -.3], [1, -.3], [0, 1]])}" fill="${d}"/>
  <polygon points="${P([[-.45, -.72], [-.1, -.72], [-.3, -.38]])}" fill="#fff" opacity=".7"/></g>`;
}
function coin(x, y, r, tilt = 1, rot = 0) {
  const ry = r * tilt, t = r * .16 * (1 - tilt + .3);
  return `<g transform="rotate(${rot} ${f(x)} ${f(y)})" filter="url(#ds2)"><ellipse cx="${f(x)}" cy="${f(y + t)}" rx="${f(r)}" ry="${f(ry)}" fill="#7A4E08"/><ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(r)}" ry="${f(ry)}" fill="url(#goldR)"/><ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(r * .8)}" ry="${f(ry * .8)}" fill="none" stroke="#8C5A0A" stroke-width="${f(r * .06)}" opacity=".7"/><path d="M${f(x)},${f(y - ry * .45)}L${f(x + r * .32)},${f(y)}L${f(x)},${f(y + ry * .45)}L${f(x - r * .32)},${f(y)}Z" fill="#9A6410" opacity=".75"/><path d="M${f(x)},${f(y - ry * .3)}L${f(x + r * .2)},${f(y)}L${f(x)},${f(y + ry * .3)}L${f(x - r * .2)},${f(y)}Z" fill="#FFE9A3" opacity=".8"/></g>`;
}

/* Logotype : titre doré biseauté + sous-titre */
function logo({ main, sub, subPos = 'below', y = 352, size = 44, accent = '#F5D76E', maxW = 262 }) {
  const est = main.length * size * .78;
  const tl = est > maxW ? ` textLength="${maxW}" lengthAdjust="spacingAndGlyphs"` : '';
  const mainY = sub && subPos === 'above' ? y + 6 : y;
  let s = `<rect x="0" y="240" width="${W}" height="${H - 240}" fill="url(#fadeB)"/>`;
  s += `<ellipse cx="150" cy="${f(mainY - size * .35)}" rx="140" ry="${f(size * .9)}" fill="${accent}" opacity=".22" filter="url(#blur18)"/>`;
  const T = (extra) => `<text x="150" y="${mainY}" font-family="Cinzel" font-weight="900" font-size="${size}" text-anchor="middle" letter-spacing="1"${tl} ${extra}>${main}</text>`;
  s += `<g filter="url(#lds)">${T(`fill="#2A1703" stroke="#2A1703" stroke-width="${f(size * .2)}" stroke-linejoin="round"`)}</g>`;
  s += T(`fill="url(#goldT)" stroke="#FFF3C4" stroke-width=".6" stroke-opacity=".6"`);
  if (sub) {
    const sy = subPos === 'above' ? mainY - size * .95 : mainY + size * .5 + 4;
    const sw = sub.length * 8.4 + 10;
    s += `<path d="M${f(150 - sw / 2 - 34)},${f(sy - 4)}H${f(150 - sw / 2 - 6)}M${f(150 + sw / 2 + 6)},${f(sy - 4)}H${f(150 + sw / 2 + 34)}" stroke="url(#gold)" stroke-width="1.4"/>`;
    s += `<path d="M${f(150 - sw / 2 - 38)},${f(sy - 4)}l3,-3 3,3 -3,3z M${f(150 + sw / 2 + 32)},${f(sy - 4)}l3,-3 3,3 -3,3z" fill="#F5D76E"/>`;
    s += `<text x="150" y="${f(sy)}" font-family="Inter" font-weight="800" font-size="11.5" text-anchor="middle" letter-spacing="3.2" fill="#FBEBC0" filter="url(#lds)">${sub}</text>`;
  }
  return s;
}

/* ---------- Scènes ---------- */
const S = {};

S.pharaon = () => {
  seed = 11;
  const defs = `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0B0820"/><stop offset=".38" stop-color="#3A1636"/><stop offset=".62" stop-color="#B24E1E"/><stop offset=".72" stop-color="#E89A3A"/><stop offset="1" stop-color="#3A1E08"/></linearGradient>
  <radialGradient id="sun"><stop offset="0" stop-color="#FFF6D0"/><stop offset=".35" stop-color="#FFD36B"/><stop offset=".7" stop-color="#F29A2E" stop-opacity=".6"/><stop offset="1" stop-color="#F29A2E" stop-opacity="0"/></radialGradient>
  <linearGradient id="pyrL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#F2B35A"/><stop offset="1" stop-color="#B8691F"/></linearGradient>
  <linearGradient id="pyrR" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5E300F"/><stop offset="1" stop-color="#2B1406"/></linearGradient>
  <pattern id="nemes" width="12" height="11" patternUnits="userSpaceOnUse"><rect width="12" height="11" fill="#1E3C8F"/><rect width="12" height="6.5" fill="#EBBB4A"/><rect width="12" height="1.5" y="5" fill="#B7861E"/></pattern>
  <pattern id="beard" width="10" height="7" patternUnits="userSpaceOnUse"><rect width="10" height="7" fill="#1E3C8F"/><rect width="10" height="4" fill="#D9A43A"/></pattern>
  <radialGradient id="face" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#FFF1B8"/><stop offset=".4" stop-color="#F0C04E"/><stop offset=".85" stop-color="#B07418"/><stop offset="1" stop-color="#7A4A08"/></radialGradient>
  <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></linearGradient>`;
  const nemes = 'M0,-104C36,-104 60,-84 68,-48L76,18C78,50 72,82 64,104L40,104L42,34L-42,34L-40,104L-64,104C-72,82 -78,50 -76,18L-68,-48C-60,-84 -36,-104 0,-104Z';
  const faceP = 'M0,-62C25,-62 37,-44 37,-14C37,20 23,44 0,51C-23,44 -37,20 -37,-14C-37,-44 -25,-62 0,-62Z';
  const eye = (sx) => `<g transform="scale(${sx} 1)"><path d="M-30,-29Q-18,-38 -5,-29" stroke="#1B2F6B" stroke-width="4.5" fill="none" stroke-linecap="round"/><path d="M-29,-15Q-18,-25 -6,-16Q-17,-8 -29,-15Z" fill="#F6F1E4" stroke="#0E0E12" stroke-width="2.6"/><circle cx="-16.5" cy="-15.8" r="4" fill="#0E0E12"/><circle cx="-15.2" cy="-17" r="1.2" fill="#fff"/><path d="M-29,-15L-38,-11" stroke="#0E0E12" stroke-width="2.6" stroke-linecap="round"/></g>`;
  const collarBands = [['#2BB3A3', 0], ['#F0C04E', 8], ['#B3261E', 15], ['#1E3C8F', 22], ['#F0C04E', 29]].map(([c, o]) => `<path d="M${-66 - o * .2},${58 + o}Q0,${128 + o * 1.4} ${66 + o * .2},${58 + o}" stroke="${c}" stroke-width="7.5" fill="none"/>`).join('');
  const body = `<rect width="300" height="400" fill="url(#sky)"/>
  ${dust(40, [0, 0, 300, 150], '#FFF3D6', 1.1)}
  ${rays(150, 205, 22, '#FFD27A', .09)}
  <circle cx="150" cy="205" r="150" fill="url(#sun)"/>
  <polygon points="-30,300 95,168 220,300" fill="url(#pyrL)"/><polygon points="95,168 220,300 150,300" fill="url(#pyrR)" opacity=".92"/>
  <polygon points="140,300 238,196 336,300" fill="url(#pyrL)" opacity=".85"/><polygon points="238,196 336,300 285,300" fill="url(#pyrR)"/>
  ${[0, 1, 2, 3, 4, 5, 6].map(i => `<path d="M${-30 + i * 17},${300 - i * 18.6}H${220 - i * 17}" stroke="#6b3a12" stroke-width=".7" opacity=".45"/>`).join('')}
  <path d="M0,292C60,270 120,300 180,284C230,272 270,286 300,280V400H0Z" fill="#2A1506"/>
  <path d="M0,318C70,300 150,330 220,312C255,304 285,310 300,308V400H0Z" fill="#1A0D03"/>
  <g transform="translate(150 158) scale(.98)" filter="url(#ds)">
    <path d="${nemes}" fill="url(#nemes)"/><path d="${nemes}" fill="url(#shade)"/>
    <path d="M-60,-40Q0,-78 60,-40" stroke="#F4D17A" stroke-width="2" fill="none" opacity=".6"/>
    <path d="M-43,28L-44,98Q0,110 44,98L43,28Z" fill="url(#face)"/><path d="M-43,28L-44,98Q0,110 44,98L43,28Z" fill="#000" opacity=".4"/>
    <path d="M-72,56Q0,150 72,56L76,88Q0,178 -76,88Z" fill="#1E3C8F"/>
    ${collarBands}
    <path d="M-74,94Q0,176 74,94" stroke="#EBBB4A" stroke-width="3" fill="none"/>
    ${Array.from({length:15},(_,i)=>{const t=i/14,x=-70+t*140,y=94+Math.sin(t*Math.PI)*40;return `<path d="M${(x).toFixed(1)},${(y).toFixed(1)}l-2.4,7h4.8z" fill="#B3261E"/>`}).join('')}
    <path d="${faceP}" fill="url(#face)"/>
    <path d="M-38,-58H38L36,-49H-36Z" fill="#EBBB4A"/><path d="M-37,-53.5H37" stroke="#1E3C8F" stroke-width="3"/>
    ${eye(1)}${eye(-1)}
    <path d="M0,-12L-6,10Q0,14 6,10Z" fill="#C48A22"/><path d="M-1,-12L-5,9" stroke="#FFF1B8" stroke-width="1" opacity=".7"/>
    <path d="M-10,22Q0,17 10,22Q0,29 -10,22Z" fill="#A45A18"/>
    <path d="M-8,50L8,50L10,94Q0,101 -10,94Z" fill="url(#beard)" stroke="#6E4506" stroke-width="1"/>
    <path d="M0,-86C7,-86 9,-76 6,-66L-6,-66C-9,-76 -7,-86 0,-86Z" fill="url(#goldV)" stroke="#6E4506" stroke-width="1"/><circle cx="0" cy="-78" r="1.8" fill="#D62828"/>
    <path d="${faceP}" fill="url(#shade)" opacity=".6"/>
  </g>
  ${sparkles(9, [20, 40, 260, 230], 3, 7, '#FFF4C7')}
  ${sparkle(212, 92, 11)}${sparkle(84, 118, 7)}
  <rect width="300" height="400" fill="url(#vig)"/>`;
  return { defs, body: body + logo({ main: 'PHARAON', sub: 'D’OR', size: 46, accent: '#F29A2E' }) };
};

S.fruit = () => {
  seed = 22;
  const defs = `<radialGradient id="bg" cx=".5" cy=".38" r=".8"><stop offset="0" stop-color="#5A1470"/><stop offset=".55" stop-color="#26083A"/><stop offset="1" stop-color="#0C0214"/></radialGradient>
  <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF3FD2" stop-opacity="0"/><stop offset="1" stop-color="#FF3FD2" stop-opacity=".55"/></linearGradient>`;
  const grid = Array.from({ length: 13 }, (_, i) => `<path d="M150,250L${-150 + i * 50},400" stroke="#FF5FDC" stroke-width=".8" opacity=".5"/>`).join('') + [262, 280, 305, 340, 390].map(y => `<path d="M0,${y}H300" stroke="#FF5FDC" stroke-width=".8" opacity=".45"/>`).join('');
  const im = (n, x, y, s, r) => `<image href="${png(n)}" x="${f(x - s / 2)}" y="${f(y - s / 2)}" width="${s}" height="${s}" transform="rotate(${r} ${x} ${y})" filter="url(#ds)"/>`;
  const body = `<rect width="300" height="400" fill="url(#bg)"/>
  ${rays(150, 165, 16, '#FF7BE5', .07)}
  <rect x="0" y="250" width="300" height="150" fill="url(#floor)"/>${grid}
  ${glowBlob(150, 165, 110, '#D946EF', .55)}
  <circle cx="150" cy="165" r="112" fill="none" stroke="#FF4FD8" stroke-width="6" filter="url(#glow)"/><circle cx="150" cy="165" r="112" fill="none" stroke="#FFD6F7" stroke-width="1.6"/>
  <circle cx="150" cy="165" r="124" fill="none" stroke="#4FE3FF" stroke-width="2.5" filter="url(#glow)" opacity=".9"/><circle cx="150" cy="165" r="124" fill="none" stroke="#E0FAFF" stroke-width=".8"/>
  ${Array.from({ length: 28 }, (_, i) => { const a = i / 28 * Math.PI * 2; return `<circle cx="${f(150 + Math.cos(a) * 124)}" cy="${f(165 + Math.sin(a) * 124)}" r="2.4" fill="${i % 2 ? '#FFF6B0' : '#FF9BEA'}" filter="url(#glow2)"/>`; }).join('')}
  ${im('diamond', 74, 88, 64, -14)}${im('bell', 232, 96, 74, 14)}
  ${im('seven', 150, 165, 158, -4)}
  ${im('cherry', 66, 222, 96, -12)}${im('grapefruit', 236, 226, 88, 10)}
  ${sparkles(10, [20, 30, 260, 230], 3, 7, '#FFE6FA')}${sparkle(196, 110, 10)}
  <rect width="300" height="400" fill="url(#vig)"/>`;
  return { defs, body: body + logo({ main: 'FRUIT', sub: 'CLASSIC', size: 54, accent: '#FF4FD8' }) };
};

S.dragon = () => {
  seed = 33;
  const defs = `<radialGradient id="bg" cx=".5" cy=".4" r=".8"><stop offset="0" stop-color="#B81D1D"/><stop offset=".55" stop-color="#5E0909"/><stop offset="1" stop-color="#1E0202"/></radialGradient>
  <radialGradient id="lan" cx=".38" cy=".38" r=".7"><stop offset="0" stop-color="#FFB37A"/><stop offset=".4" stop-color="#E5261F"/><stop offset="1" stop-color="#7A0808"/></radialGradient>
  <linearGradient id="body" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE79A"/><stop offset=".5" stop-color="#D99A23"/><stop offset="1" stop-color="#8A5208"/></linearGradient>`;
  const cloud = (x, y, s, op) => `<g transform="translate(${x} ${y}) scale(${s})" opacity="${op}" fill="none" stroke="#F5C04E" stroke-width="2.2" stroke-linecap="round"><path d="M-40,0C-40,-14 -22,-16 -18,-8C-16,-22 6,-24 8,-8C12,-18 30,-14 28,0Z" fill="#8E1010"/><path d="M-26,-4c0,-6 8,-6 8,0M0,-8c0,-7 9,-7 9,0"/></g>`;
  const lantern = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0,-90V-34" stroke="#F5C04E" stroke-width="1.5"/>${glowBlob(0, 0, 34, '#FF6A2A', .6)}<rect x="-14" y="-38" width="28" height="8" rx="2" fill="url(#goldV)"/><ellipse cx="0" cy="0" rx="30" ry="34" fill="url(#lan)"/>${[-18, -8, 0, 8, 18].map(k => `<path d="M${k},-32Q${k * 1.9},0 ${k},32" stroke="#F5C04E" stroke-width="1" fill="none" opacity=".55"/>`).join('')}<rect x="-14" y="30" width="28" height="8" rx="2" fill="url(#goldV)"/><path d="M0,38V60M-4,40V58M4,40V58" stroke="#F5C04E" stroke-width="1.4"/></g>`;
  const ingot = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})" filter="url(#ds2)"><path d="M-32,0Q-36,-16 -22,-13Q-12,-28 0,-28Q12,-28 22,-13Q36,-16 32,0Q0,14 -32,0Z" fill="url(#goldR)"/><ellipse cx="0" cy="-14" rx="13" ry="9" fill="#FFE9A3" opacity=".75"/><path d="M-30,-2Q0,10 30,-2" stroke="#7A4E08" stroke-width="1.5" fill="none"/></g>`;
  const dragonPath = 'M52,90C18,130 30,212 80,250C130,290 230,276 262,212C290,150 250,78 190,70';
  const body = `<rect width="300" height="400" fill="url(#bg)"/>
  ${rays(150, 170, 24, '#FFCF6B', .08)}
  ${cloud(60, 300, 1.2, .5)}${cloud(250, 60, .9, .4)}${cloud(240, 300, 1, .45)}${cloud(46, 40, .8, .35)}
  ${glowBlob(150, 170, 100, '#FFB23E', .45)}
  <path d="${dragonPath}" stroke="#4A1A02" stroke-width="30" fill="none" stroke-linecap="round" opacity=".5" transform="translate(0 6)" filter="url(#blur3)"/>
  <path d="${dragonPath}" stroke="url(#body)" stroke-width="24" fill="none" stroke-linecap="round"/>
  <path d="${dragonPath}" stroke="#8A5208" stroke-width="18" fill="none" stroke-dasharray="1.5 7" stroke-linecap="round" opacity=".8"/>
  <path d="${dragonPath}" stroke="#FFF1B8" stroke-width="3" fill="none" transform="translate(-4 -6)" opacity=".55"/>
  <path d="${dragonPath}" stroke="#C4151C" stroke-width="3" fill="none" stroke-dasharray="6 5" transform="translate(3 9)" opacity=".9"/>
  <g transform="translate(58 82) rotate(-22) scale(1.18)" filter="url(#ds2)">
    <path d="M-4,-20L-30,-36L-18,-16L-42,-14L-20,-4L-40,8L-16,6L-30,24L-4,12Z" fill="#E5261F" stroke="#FFD27A" stroke-width="1"/>
    <path d="M4,-24C0,-44 -12,-56 -24,-60M-3,-42L-14,-40M8,-26C10,-46 22,-56 34,-58M16,-46L26,-42" stroke="#FFE08A" stroke-width="3.4" fill="none" stroke-linecap="round"/>
    <path d="M36,-4L62,-6C58,4 56,12 60,18C50,12 44,8 36,-4Z" fill="#4A0404"/>
    <path d="M-8,-18C4,-30 26,-30 40,-22C50,-18 58,-20 66,-25C73,-28 78,-20 73,-13C70,-9 64,-7 60,-6L36,-4C24,-2 10,2 -4,4C-12,2 -14,-10 -8,-18Z" fill="url(#body)" stroke="#6E4506" stroke-width="1.2"/>
    <path d="M0,6C14,6 30,4 44,8C52,10 58,14 61,19C50,21 38,19 26,17C14,17 4,14 0,6Z" fill="url(#body)" stroke="#6E4506" stroke-width="1.2"/>
    <path d="M42,-4l2.5,5 2.5,-5M50,-5l2.5,5 2.5,-5M56,-5.5l2,4.5 2,-4.5M44,9l2,-4 2,4M52,12l2,-4 2,4" fill="#fff"/>
    <circle cx="69" cy="-20" r="4.2" fill="url(#goldR)" stroke="#6E4506" stroke-width=".8"/>
    <path d="M10,-24Q22,-34 36,-25" stroke="#8A5208" stroke-width="4" fill="none" stroke-linecap="round"/>
    <ellipse cx="23" cy="-16" rx="6.5" ry="5" fill="#FFF6D0"/><circle cx="24.5" cy="-16" r="3.4" fill="#C4151C"/><circle cx="25" cy="-16" r="1.5" fill="#000"/>
    <path d="M-2,-12Q14,-8 30,-8M4,-2Q18,-4 34,-2" stroke="#8A5208" stroke-width="1" fill="none" opacity=".6"/>
    <path d="M70,-16C86,-8 94,-30 114,-20M62,16C74,30 86,22 100,34" stroke="#FFE08A" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <path d="M10,12L4,26L16,18L14,32L24,18L28,30L32,16Z" fill="#E5261F" stroke="#FFD27A" stroke-width=".8"/>
  </g>
  <g filter="url(#ds)"><circle cx="150" cy="168" r="80" fill="url(#goldR)"/><circle cx="150" cy="168" r="80" fill="none" stroke="#7A4E08" stroke-width="3"/><circle cx="150" cy="168" r="68" fill="none" stroke="#8C5A0A" stroke-width="2" opacity=".8"/>
  ${Array.from({ length: 24 }, (_, i) => { const a = i / 24 * Math.PI * 2; return `<circle cx="${f(150 + Math.cos(a) * 74)}" cy="${f(168 + Math.sin(a) * 74)}" r="2" fill="#FFF1B8" opacity=".8"/>`; }).join('')}
  <rect x="124" y="142" width="52" height="52" fill="#7A0B0B" stroke="#7A4E08" stroke-width="4"/><rect x="116" y="134" width="68" height="68" fill="none" stroke="#FFE9A3" stroke-width="1.5" opacity=".7"/>
  ${[[150, 110], [150, 226], [92, 168], [208, 168]].map(([x, y]) => `<path d="M${x},${y - 11}L${x + 9},${y}L${x},${y + 11}L${x - 9},${y}Z" fill="#9A6410"/><path d="M${x},${y - 6}L${x + 5},${y}L${x},${y + 6}L${x - 5},${y}Z" fill="#FFE9A3"/>`).join('')}
  <ellipse cx="128" cy="130" rx="38" ry="16" fill="#fff" opacity=".22" transform="rotate(-30 128 130)"/></g>
  ${lantern(226, 40, .5)}${lantern(268, 118, .72)}
  ${ingot(70, 268, 1.1)}${ingot(232, 272, 1.2)}${ingot(150, 262, .9)}
  ${sparkles(10, [20, 30, 260, 240], 3, 7, '#FFF1C4')}${sparkle(210, 118, 10)}
  <rect width="300" height="400" fill="url(#vig)"/>`;
  return { defs, body: body + logo({ main: 'DRAGON', sub: 'FORTUNE', size: 48, accent: '#FF5A2A' }) };
};

S.roulette = () => {
  seed = 44;
  const defs = `<radialGradient id="bg" cx=".5" cy=".35" r=".85"><stop offset="0" stop-color="#1C7A52"/><stop offset=".55" stop-color="#0C4A31"/><stop offset="1" stop-color="#03170E"/></radialGradient>
  <radialGradient id="wood" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#8A4A1C"/><stop offset="1" stop-color="#3A1806"/></radialGradient>
  <radialGradient id="cone" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="#C47A34"/><stop offset=".7" stop-color="#6B3710"/><stop offset="1" stop-color="#3A1806"/></radialGradient>
  <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF7D6" stop-opacity=".22"/><stop offset="1" stop-color="#FFF7D6" stop-opacity="0"/></linearGradient>`;
  const RN = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  const n = 37, R1 = 104, R0 = 74;
  let pockets = '';
  for (let i = 0; i < n; i++) {
    const a1 = (i / n) * Math.PI * 2 - Math.PI / 2, a2 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
    const c = RN[i] === 0 ? '#0E8A4F' : RED.has(RN[i]) ? '#B8141C' : '#16181E';
    pockets += `<path d="M${f(Math.cos(a1) * R0)},${f(Math.sin(a1) * R0)}L${f(Math.cos(a1) * R1)},${f(Math.sin(a1) * R1)}A${R1},${R1} 0 0 1 ${f(Math.cos(a2) * R1)},${f(Math.sin(a2) * R1)}L${f(Math.cos(a2) * R0)},${f(Math.sin(a2) * R0)}Z" fill="${c}" stroke="#E9C46A" stroke-width=".7"/>`;
  }
  const body = `<rect width="300" height="400" fill="url(#bg)"/>
  <polygon points="110,0 190,0 290,300 10,300" fill="url(#beam)"/>
  ${dust(30, [40, 0, 220, 260], '#FFF7D6', 1)}
  <ellipse cx="150" cy="200" rx="138" ry="70" fill="#000" opacity=".5" filter="url(#blur8)"/>
  <g transform="translate(150 168)">
    <ellipse cx="0" cy="18" rx="130" ry="74" fill="#2A1004"/>
    <g transform="scale(1 .56)">
      <circle r="130" fill="url(#wood)"/><circle r="126" fill="none" stroke="url(#gold)" stroke-width="5"/>
      <circle r="112" fill="#1A0B04"/>${pockets}
      <circle r="${R0}" fill="url(#cone)"/><circle r="${R0}" fill="none" stroke="url(#gold)" stroke-width="3"/>
      ${Array.from({ length: 8 }, (_, i) => { const a = i / 8 * Math.PI * 2; return `<path d="M${f(Math.cos(a) * 22)},${f(Math.sin(a) * 22)}L${f(Math.cos(a) * 60)},${f(Math.sin(a) * 60)}" stroke="#E9C46A" stroke-width="2.4" opacity=".6"/>`; }).join('')}
    </g>
    <g filter="url(#ds2)"><ellipse cx="0" cy="0" rx="18" ry="10" fill="url(#goldR)"/><path d="M-4,-2V-28H4V-2Z" fill="url(#gold)"/>
    <path d="M-30,-30H30" stroke="url(#gold)" stroke-width="4" stroke-linecap="round"/><circle cx="-30" cy="-30" r="4.5" fill="url(#goldR)"/><circle cx="30" cy="-30" r="4.5" fill="url(#goldR)"/><circle cx="0" cy="-32" r="6" fill="url(#goldR)"/></g>
    <circle cx="52" cy="38" r="6.5" fill="#fff" filter="url(#ds2)"/><circle cx="50" cy="36" r="2.2" fill="#fff" opacity=".9"/><circle cx="52" cy="38" r="6.5" fill="none" stroke="#bbb" stroke-width=".6"/>
  </g>
  ${stack(58, 292, 30, ['red', 'red', 'red', 'black', 'red', 'red'])}
  ${stack(244, 300, 30, ['blue', 'blue', 'gold', 'blue'])}
  ${chip(170, 312, 26, 'green')}
  ${sparkles(8, [30, 20, 240, 240], 3, 6, '#FFF7D6')}${sparkle(98, 118, 9)}
  <rect width="300" height="400" fill="url(#vig)"/>`;
  return { defs, body: body + logo({ main: 'ROULETTE', sub: 'EUROPÉENNE', size: 42, accent: '#22C58B' }) };
};

const felt = (c0, c1, c2) => `<radialGradient id="bg" cx=".5" cy=".35" r=".85"><stop offset="0" stop-color="${c0}"/><stop offset=".6" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient>
<pattern id="lattice" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0,0H8M0,0V8" stroke="#F5D76E" stroke-width="1.2"/></pattern>
<linearGradient id="beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF7D6" stop-opacity=".2"/><stop offset="1" stop-color="#FFF7D6" stop-opacity="0"/></linearGradient>`;

S.blackjack = () => {
  seed = 55;
  const defs = felt('#1F8157', '#0D4C33', '#03170E') + `<path id="arc" d="M30,120A150,150 0 0 1 270,120"/>`;
  const body = `<rect width="300" height="400" fill="url(#bg)"/>
  <polygon points="100,0 200,0 300,320 0,320" fill="url(#beam)"/>
  <path d="M20,132A160,160 0 0 1 280,132" stroke="#E9C46A" stroke-width="1.2" fill="none" opacity=".55"/><path d="M34,146A150,150 0 0 1 266,146" stroke="#E9C46A" stroke-width=".8" fill="none" opacity=".4"/>
  <text font-family="Cinzel" font-weight="700" font-size="11" letter-spacing="2.4" fill="#E9C46A" opacity=".8"><textPath href="#arc" startOffset="50%" text-anchor="middle">BLACKJACK PAIE 3 CONTRE 2</textPath></text>
  ${card({ x: 116, y: 196, w: 108, rot: -13, r: 'A', s: 's' })}
  ${card({ x: 188, y: 204, w: 108, rot: 11, r: 'K', s: 'h' })}
  ${stack(52, 300, 28, ['black', 'black', 'gold', 'black', 'black'])}
  ${stack(252, 296, 26, ['red', 'red', 'red'])}
  ${sparkles(7, [30, 40, 240, 220], 3, 6, '#FFF7D6')}${sparkle(236, 132, 10)}
  <rect width="300" height="400" fill="url(#vig)"/>`;
  return { defs, body: body + logo({ main: 'BLACKJACK', sub: 'VINGT-ET-UN', size: 40, accent: '#22C58B' }) };
};

S.baccarat = () => {
  seed = 66;
  const defs = felt('#8A1633', '#4A0A1B', '#150207');
  const deco = Array.from({ length: 7 }, (_, i) => `<path d="M150,410L${f(150 + Math.cos(Math.PI + (i + 1) * Math.PI / 8) * 420)},${f(410 + Math.sin(Math.PI + (i + 1) * Math.PI / 8) * 420)}" stroke="#E9C46A" stroke-width=".8" opacity=".22"/>`).join('') +
    [120, 180, 240].map(r => `<path d="M${150 - r},410A${r},${r} 0 0 1 ${150 + r},410" stroke="#E9C46A" stroke-width=".8" fill="none" opacity=".22"/>`).join('');
  const body = `<rect width="300" height="400" fill="url(#bg)"/>${deco}
  <polygon points="100,0 200,0 300,320 0,320" fill="url(#beam)"/>
  ${card({ x: 150, y: 170, w: 100, rot: 0, back: true, backColor: '#15327F' })}
  ${card({ x: 100, y: 196, w: 100, rot: -16, r: '9', s: 'd' })}
  ${card({ x: 200, y: 196, w: 100, rot: 16, r: 'K', s: 'c' })}
  ${stack(56, 302, 26, ['gold', 'gold', 'black', 'gold'])}
  ${stack(246, 302, 26, ['purple', 'purple', 'purple', 'gold', 'purple'])}
  ${sparkles(7, [30, 40, 240, 220], 3, 6, '#FFF1D6')}${sparkle(62, 128, 9)}
  <rect width="300" height="400" fill="url(#vig)"/>`;
  return { defs, body: body + logo({ main: 'BACCARAT', sub: 'PUNTO BANCO', size: 42, accent: '#E11D48' }) };
};

S.videopoker = () => {
  seed = 77;
  const defs = felt('#1C3C9A', '#0B1B52', '#030717') + `<pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="2" fill="#000" opacity=".22"/></pattern>`;
  const cards = [['10', -26], ['J', -13], ['Q', 0], ['K', 13], ['A', 26]].map(([r, a], i) => card({ x: 150 + Math.sin(a * Math.PI / 180) * 170, y: 250 - Math.cos(a * Math.PI / 180) * 110, w: 74, rot: a, r, s: 's' })).join('');
  const body = `<rect width="300" height="400" fill="url(#bg)"/>
  ${glowBlob(150, 150, 110, '#3B82F6', .55)}
  ${rays(150, 160, 18, '#9CC4FF', .07)}
  ${cards}
  <g transform="translate(150 72)" filter="url(#glow2)"><rect x="-72" y="-15" width="144" height="30" rx="15" fill="#0B1B52" stroke="#6EA8FF" stroke-width="1.5"/><text y="5" font-family="Inter" font-weight="800" font-size="12" letter-spacing="2" text-anchor="middle" fill="#DCEBFF">QUINTE ROYALE</text></g>
  ${sparkles(8, [30, 30, 240, 220], 3, 6, '#E6F0FF')}${sparkle(236, 120, 9)}
  <rect width="300" height="400" fill="url(#scan)"/>
  <rect width="300" height="400" fill="url(#vig)"/>`;
  return { defs, body: body + logo({ main: 'VIDÉO POKER', sub: 'JACKS OR BETTER', size: 38, accent: '#3B82F6' }) };
};

S.holdem = () => {
  seed = 88;
  const defs = felt('#12314A', '#081A2A', '#02070D') + `<radialGradient id="tbl" cx=".5" cy=".35" r=".7"><stop offset="0" stop-color="#1F8A5B"/><stop offset="1" stop-color="#0A4029"/></radialGradient>`;
  const comm = [['A', 'd'], ['K', 'c'], ['7', 'h'], ['Q', 'c'], ['2', 's']].map(([r, s], i) => card({ x: 70 + i * 40, y: 128, w: 36, r, s })).join('');
  const body = `<rect width="300" height="400" fill="url(#bg)"/>
  <ellipse cx="150" cy="150" rx="176" ry="102" fill="#2A160A"/><ellipse cx="150" cy="150" rx="168" ry="94" fill="none" stroke="#5A3418" stroke-width="10"/>
  <ellipse cx="150" cy="150" rx="150" ry="80" fill="url(#tbl)"/><ellipse cx="150" cy="150" rx="140" ry="72" fill="none" stroke="#E9C46A" stroke-width=".8" opacity=".5"/>
  ${comm}
  ${stack(150, 194, 16, ['red', 'blue', 'gold', 'black'])}${stack(118, 200, 14, ['green', 'green'])}${stack(184, 202, 14, ['purple', 'purple', 'purple'])}
  ${card({ x: 120, y: 276, w: 96, rot: -12, r: 'A', s: 'c' })}
  ${card({ x: 186, y: 282, w: 96, rot: 9, r: 'K', s: 'c' })}
  ${sparkles(6, [30, 30, 240, 200], 3, 6, '#E6F7EE')}${sparkle(240, 70, 9)}
  <rect width="300" height="400" fill="url(#vig)"/>`;
  return { defs, body: body + logo({ main: 'HOLD’EM', sub: 'CASINO POKER', size: 46, accent: '#22C58B' }) };
};

S.crash = () => {
  seed = 99;
  const defs = `<radialGradient id="bg" cx=".3" cy=".8" r="1"><stop offset="0" stop-color="#3A1C6B"/><stop offset=".5" stop-color="#12163A"/><stop offset="1" stop-color="#04050E"/></radialGradient>
  <linearGradient id="curve" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#22C58B"/><stop offset=".6" stop-color="#F5D76E"/><stop offset="1" stop-color="#FF7A45"/></linearGradient>
  <linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F5D76E" stop-opacity=".35"/><stop offset="1" stop-color="#22C58B" stop-opacity="0"/></linearGradient>
  <linearGradient id="hull" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".55" stop-color="#D5DBE8"/><stop offset="1" stop-color="#8891A6"/></linearGradient>
  <radialGradient id="flame" cx=".5" cy=".2" r=".8"><stop offset="0" stop-color="#FFFBE0"/><stop offset=".35" stop-color="#FFD24A"/><stop offset=".7" stop-color="#FF6A2A"/><stop offset="1" stop-color="#FF2A2A" stop-opacity="0"/></radialGradient>`;
  const stars = Array.from({ length: 60 }, () => `<circle cx="${f(rnd() * 300)}" cy="${f(rnd() * 330)}" r="${f(.3 + rnd() * 1.3)}" fill="#fff" opacity="${f(.3 + rnd() * .7)}"/>`).join('');
  const curve = 'M10,300C110,296 170,250 212,120';
  const body = `<rect width="300" height="400" fill="url(#bg)"/>${stars}
  ${glowBlob(70, 90, 70, '#7C3AED', .35)}${glowBlob(250, 250, 80, '#2563EB', .3)}
  <circle cx="246" cy="64" r="26" fill="#E9D5FF" opacity=".9"/><circle cx="238" cy="58" r="26" fill="#12163A" opacity=".55"/>
  ${[80, 140, 200, 260].map(y => `<path d="M0,${y}H300" stroke="#fff" stroke-width=".5" opacity=".08"/>`).join('')}
  <path d="${curve}L212,320L10,320Z" fill="url(#area)"/>
  <path d="${curve}" stroke="url(#curve)" stroke-width="6" fill="none" stroke-linecap="round" filter="url(#glow2)"/>
  <g transform="translate(222 100) rotate(38)">
    <ellipse cx="0" cy="62" rx="15" ry="42" fill="url(#flame)" filter="url(#glow)"/>
    <g filter="url(#ds)"><path d="M-17,10L-30,40L-14,34Z" fill="#E23B3B"/><path d="M17,10L30,40L14,34Z" fill="#B81D1D"/>
    <path d="M0,-52C18,-32 20,0 16,36H-16C-20,0 -18,-32 0,-52Z" fill="url(#hull)"/>
    <path d="M0,-52C10,-42 14,-32 15,-24H-15C-14,-32 -10,-42 0,-52Z" fill="#E23B3B"/>
    <circle cx="0" cy="-6" r="8.5" fill="#1E3A8A" stroke="#C9D1E3" stroke-width="3"/><circle cx="-2.5" cy="-8.5" r="2.6" fill="#9CC4FF"/>
    <path d="M-6,36V44H6V36Z" fill="#555C6E"/><path d="M-2,14V34" stroke="#fff" stroke-width="2" opacity=".6"/></g>
  </g>
  <g transform="translate(96 112)" filter="url(#glow2)"><rect x="-54" y="-24" width="108" height="48" rx="14" fill="#07130E" stroke="#22C58B" stroke-width="1.5" opacity=".92"/><text y="11" font-family="Inter" font-weight="800" font-size="30" text-anchor="middle" fill="#5EEFC0">12,47×</text></g>
  ${sparkles(6, [20, 20, 260, 200], 2, 5, '#fff')}
  <rect width="300" height="400" fill="url(#vig)"/>`;
  return { defs, body: body + logo({ main: 'CRASH', sub: 'ORIGINALS', size: 58, accent: '#FF7A45' }) };
};

S.mines = () => {
  seed = 111;
  const defs = `<radialGradient id="bg" cx=".5" cy=".35" r=".85"><stop offset="0" stop-color="#17364A"/><stop offset=".6" stop-color="#0A1722"/><stop offset="1" stop-color="#03070B"/></radialGradient>
  <linearGradient id="tile" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3A4560"/><stop offset="1" stop-color="#232A3D"/></linearGradient>
  <radialGradient id="bomb" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#6B7285"/><stop offset=".45" stop-color="#23262F"/><stop offset="1" stop-color="#050608"/></radialGradient>`;
  const G = [['#B9FFE4', '#22C58B', '#0B6B48']];
  let tiles = '';
  const open = { '0,1': 'g', '1,3': 'g', '2,0': 'g', '3,2': 'g', '1,1': 'g', '2,3': 'b' };
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    const x = 42 + c * 56, y = 36 + r * 56, k = open[r + ',' + c];
    tiles += `<rect x="${x}" y="${y + 5}" width="48" height="48" rx="9" fill="#0E131E"/>`;
    if (k === 'g') tiles += `<rect x="${x}" y="${y}" width="48" height="48" rx="9" fill="#0B3A2A" stroke="#22C58B" stroke-width="1.5"/>${gem(x + 24, y + 24, 14, G[0])}`;
    else if (k === 'b') tiles += `<rect x="${x}" y="${y}" width="48" height="48" rx="9" fill="#3A0B0B" stroke="#EF5B5B" stroke-width="1.5"/>`;
    else tiles += `<rect x="${x}" y="${y}" width="48" height="48" rx="9" fill="url(#tile)"/><rect x="${x + 3}" y="${y + 3}" width="42" height="14" rx="6" fill="#fff" opacity=".07"/>`;
  }
  const body = `<rect width="300" height="400" fill="url(#bg)"/>
  ${glowBlob(150, 150, 110, '#22C58B', .28)}
  <g transform="translate(150 150) scale(1 .92) translate(-150 -150)" opacity=".95">${tiles}</g>
  ${glowBlob(200, 230, 46, '#EF5B5B', .6)}
  <g transform="translate(206 226)" filter="url(#ds)"><circle r="34" fill="url(#bomb)"/><rect x="-8" y="-44" width="16" height="12" rx="3" fill="#4A4F5E"/><path d="M0,-44C4,-58 18,-60 22,-70" stroke="#C9A36A" stroke-width="3" fill="none"/>${sparkle(23, -72, 10, 1, '#FFE08A')}<ellipse cx="-12" cy="-14" rx="10" ry="6" fill="#fff" opacity=".35" transform="rotate(-35 -12 -14)"/></g>
  ${glowBlob(96, 238, 50, '#22C58B', .5)}
  ${gem(96, 238, 40, ['#D6FFF0', '#2BD99A', '#0B6B48'], -8)}
  ${sparkles(9, [20, 20, 260, 250], 2.5, 6, '#E6FFF6')}${sparkle(122, 206, 9)}
  <rect width="300" height="400" fill="url(#vig)"/>`;
  return { defs, body: body + logo({ main: 'MINES', sub: 'ORIGINALS', size: 58, accent: '#22C58B' }) };
};

S.plinko = () => {
  seed = 122;
  const defs = `<radialGradient id="bg" cx=".5" cy=".3" r=".9"><stop offset="0" stop-color="#6A1B7A"/><stop offset=".55" stop-color="#2A0B3E"/><stop offset="1" stop-color="#0A0312"/></radialGradient>
  <radialGradient id="ball" cx=".35" cy=".3" r=".7"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".3" stop-color="#FFB0E8"/><stop offset="1" stop-color="#E0249A"/></radialGradient>`;
  let pegs = '';
  for (let r = 0; r < 8; r++) for (let i = 0; i <= r + 2; i++) { const x = 150 + (i - (r + 2) / 2) * 26, y = 58 + r * 26; pegs += `<circle cx="${f(x)}" cy="${y}" r="3.2" fill="#fff" filter="url(#glow2)" opacity=".95"/>`; }
  const mults = ['#EF4444', '#F97316', '#F59E0B', '#EAB308', '#FACC15', '#EAB308', '#F59E0B', '#F97316', '#EF4444'];
  const buckets = mults.map((c, i) => `<rect x="${f(150 + (i - 4) * 26 - 11.5)}" y="270" width="23" height="18" rx="4" fill="${c}" filter="url(#ds2)"/>`).join('');
  const body = `<rect width="300" height="400" fill="url(#bg)"/>
  ${glowBlob(150, 150, 110, '#EC4899', .35)}
  ${rays(150, 20, 16, '#FF9BEA', .06)}
  ${pegs}${buckets}
  <path d="M150,20C150,40 138,60 150,84C160,104 138,118 144,140" stroke="#FF7BD8" stroke-width="10" fill="none" stroke-linecap="round" opacity=".25" filter="url(#blur3)"/>
  ${glowBlob(144, 146, 18, '#FF4FD8', .9)}<circle cx="144" cy="146" r="11" fill="url(#ball)" filter="url(#ds2)"/>
  <circle cx="110" cy="228" r="9" fill="url(#ball)" filter="url(#ds2)" opacity=".85"/><circle cx="198" cy="194" r="9" fill="url(#ball)" filter="url(#ds2)" opacity=".85"/>
  ${sparkles(8, [20, 20, 260, 240], 2.5, 6, '#FFE6FA')}
  <rect width="300" height="400" fill="url(#vig)"/>`;
  return { defs, body: body + logo({ main: 'PLINKO', sub: 'ORIGINALS', size: 56, accent: '#EC4899' }) };
};

S.dice = () => {
  seed = 133;
  const defs = `<radialGradient id="bg" cx=".5" cy=".4" r=".85"><stop offset="0" stop-color="#1D3E8A"/><stop offset=".55" stop-color="#0C1A44"/><stop offset="1" stop-color="#03071A"/></radialGradient>
  <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#EF4444"/><stop offset=".52" stop-color="#EF4444"/><stop offset=".52" stop-color="#22C58B"/><stop offset="1" stop-color="#22C58B"/></linearGradient>`;
  const im = (x, y, s, r, op = 1, blur = false) => `<image href="${png('die')}" x="${f(x - s / 2)}" y="${f(y - s / 2)}" width="${s}" height="${s}" transform="rotate(${r} ${x} ${y})" filter="url(#${blur ? 'blur3' : 'ds'})" opacity="${op}"/>`;
  const body = `<rect width="300" height="400" fill="url(#bg)"/>
  ${rays(150, 160, 18, '#9CC4FF', .07)}
  ${glowBlob(150, 150, 110, '#3B82F6', .45)}
  ${bokeh(10, [0, 0, 300, 260], '#9CC4FF')}
  ${im(84, 96, 70, -30, .45, true)}
  ${im(110, 160, 130, -18)}${im(206, 196, 112, 22)}
  <ellipse cx="160" cy="262" rx="120" ry="12" fill="#000" opacity=".4" filter="url(#blur3)"/>
  <g transform="translate(0 20)"><rect x="40" y="262" width="220" height="12" rx="6" fill="url(#bar)"/><rect x="146" y="254" width="26" height="28" rx="8" fill="url(#goldV)" stroke="#fff" stroke-width="2.5" filter="url(#ds2)"/></g>
  ${sparkles(8, [20, 20, 260, 240], 2.5, 6, '#E6F0FF')}${sparkle(232, 130, 10)}
  <rect width="300" height="400" fill="url(#vig)"/>`;
  return { defs, body: body + logo({ main: 'DICE', sub: 'ORIGINALS', size: 60, accent: '#3B82F6' }) };
};

S.limbo = () => {
  seed = 144;
  const defs = `<radialGradient id="bg" cx=".5" cy=".75" r=".95"><stop offset="0" stop-color="#4A1070"/><stop offset=".5" stop-color="#170A30"/><stop offset="1" stop-color="#05030C"/></radialGradient>
  <linearGradient id="barg" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#7C3AED" stop-opacity=".2"/><stop offset="1" stop-color="#C084FC"/></linearGradient>
  <linearGradient id="barw" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#F59E0B" stop-opacity=".3"/><stop offset="1" stop-color="#FFE08A"/></linearGradient>`;
  const hs = [40, 64, 52, 90, 76, 118, 100, 150, 132, 190];
  const bars = hs.map((h, i) => `<rect x="${24 + i * 26}" y="${300 - h}" width="18" height="${h}" rx="4" fill="url(#${i === hs.length - 1 ? 'barw' : 'barg'})" ${i === hs.length - 1 ? 'filter="url(#glow2)"' : ''}/>`).join('');
  const body = `<rect width="300" height="400" fill="url(#bg)"/>
  ${[100, 160, 220, 280].map(y => `<path d="M0,${y}H300" stroke="#C084FC" stroke-width=".5" opacity=".12"/>`).join('')}
  ${glowBlob(250, 110, 70, '#F59E0B', .35)}${glowBlob(90, 220, 90, '#7C3AED', .45)}
  ${bars}
  <path d="M40,250L110,200L160,214L250,96" stroke="#FFE08A" stroke-width="3" fill="none" stroke-dasharray="6 6" opacity=".7"/>
  <g transform="translate(258 92)" filter="url(#glow2)"><circle r="30" fill="none" stroke="#FFE08A" stroke-width="2.5"/><circle r="18" fill="none" stroke="#FFE08A" stroke-width="2"/><circle r="5" fill="#FFE08A"/><path d="M0,-40V-24M0,24V40M-40,0H-24M24,0H40" stroke="#FFE08A" stroke-width="2.5"/></g>
  <g transform="translate(112 96)" filter="url(#glow2)"><text font-family="Inter" font-weight="800" font-size="46" text-anchor="middle" fill="#F3E8FF">100×</text></g>
  ${sparkles(7, [20, 20, 260, 240], 2.5, 6, '#F3E8FF')}
  <rect width="300" height="400" fill="url(#vig)"/>`;
  return { defs, body: body + logo({ main: 'LIMBO', sub: 'ORIGINALS', size: 58, accent: '#A855F7' }) };
};

S.hilo = () => {
  seed = 155;
  const defs = `<radialGradient id="bg" cx=".5" cy=".4" r=".85"><stop offset="0" stop-color="#6B4A10"/><stop offset=".55" stop-color="#2A1C05"/><stop offset="1" stop-color="#0B0702"/></radialGradient>
  <pattern id="lattice" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0,0H8M0,0V8" stroke="#F5D76E" stroke-width="1.2"/></pattern>
  <linearGradient id="up" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8CFFD2"/><stop offset="1" stop-color="#0E8A5A"/></linearGradient>
  <linearGradient id="dn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF9B9B"/><stop offset="1" stop-color="#A51D1D"/></linearGradient>`;
  const chev = (x, y, s, up) => `<path transform="translate(${x} ${y}) scale(${s}) ${up ? '' : 'rotate(180)'}" d="M0,-30L32,6H14V30H-14V6H-32Z" fill="url(#${up ? 'up' : 'dn'})" stroke="#fff" stroke-opacity=".5" stroke-width="1.2" filter="url(#glow2)"/>`;
  const body = `<rect width="300" height="400" fill="url(#bg)"/>
  ${rays(150, 170, 20, '#FFD27A', .08)}
  ${glowBlob(150, 170, 100, '#F5D76E', .35)}
  ${card({ x: 124, y: 170, w: 96, rot: -8, back: true, backColor: '#7A1022' })}
  ${card({ x: 160, y: 176, w: 108, rot: 6, r: 'Q', s: 'h' })}
  ${chev(48, 108, 1.1, true)}${chev(256, 244, 1.1, false)}
  ${sparkles(8, [20, 20, 260, 240], 2.5, 6, '#FFF4C7')}${sparkle(236, 96, 10)}
  <rect width="300" height="400" fill="url(#vig)"/>`;
  return { defs, body: body + logo({ main: 'HI-LO', sub: 'PLUS HAUT · PLUS BAS', size: 58, accent: '#F5D76E' }) };
};

S.keno = () => {
  seed = 166;
  const defs = `<radialGradient id="bg" cx=".5" cy=".35" r=".9"><stop offset="0" stop-color="#4C1D95"/><stop offset=".55" stop-color="#1E0A45"/><stop offset="1" stop-color="#07021A"/></radialGradient>
  <radialGradient id="glass" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".8" stop-color="#fff" stop-opacity=".04"/><stop offset="1" stop-color="#fff" stop-opacity=".2"/></radialGradient>` +
    ['#EF4444', '#F59E0B', '#22C58B', '#3B82F6', '#A855F7', '#EC4899', '#FACC15'].map((c, i) => `<radialGradient id="b${i}" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#fff"/><stop offset=".25" stop-color="${c}"/><stop offset="1" stop-color="${c}" stop-opacity=".95"/><stop offset="1" stop-color="#000"/></radialGradient>`).join('');
  const ball = (x, y, r, i, n) => `<g transform="translate(${x} ${y})" filter="url(#ds2)"><circle r="${r}" fill="url(#b${i})"/><circle r="${f(r * .5)}" fill="#fff"/><text y="${f(r * .19)}" font-family="Inter" font-weight="800" font-size="${f(r * .55)}" text-anchor="middle" fill="#1B1030">${n}</text><ellipse cx="${f(-r * .35)}" cy="${f(-r * .45)}" rx="${f(r * .3)}" ry="${f(r * .16)}" fill="#fff" opacity=".6" transform="rotate(-30 ${f(-r * .35)} ${f(-r * .45)})"/></g>`;
  const inner = [[118, 128, 20, 0, 7], [160, 112, 20, 1, 23], [186, 150, 20, 2, 11], [134, 168, 20, 3, 38], [104, 94, 16, 4, 5], [170, 70, 16, 5, 29], [200, 104, 16, 6, 17], [96, 150, 16, 1, 31]].map(a => ball(...a)).join('');
  const body = `<rect width="300" height="400" fill="url(#bg)"/>
  ${rays(150, 130, 18, '#C4B5FD', .07)}
  ${glowBlob(150, 130, 100, '#8B5CF6', .5)}
  <circle cx="150" cy="128" r="92" fill="#1A0B3A" opacity=".6"/>${inner}<circle cx="150" cy="128" r="92" fill="url(#glass)" stroke="#E9D5FF" stroke-width="2" stroke-opacity=".6"/>
  <ellipse cx="120" cy="80" rx="36" ry="14" fill="#fff" opacity=".18" transform="rotate(-28 120 80)"/>
  <path d="M130,218H170L180,244H120Z" fill="url(#goldV)" filter="url(#ds2)"/><rect x="104" y="244" width="92" height="14" rx="5" fill="url(#gold)" filter="url(#ds2)"/>
  ${ball(58, 262, 26, 0, 12)}${ball(244, 258, 26, 2, 40)}${ball(94, 290, 18, 6, 3)}${ball(210, 292, 18, 4, 26)}
  ${sparkles(8, [20, 20, 260, 240], 2.5, 6, '#F3E8FF')}${sparkle(236, 60, 10)}
  <rect width="300" height="400" fill="url(#vig)"/>`;
  return { defs, body: body + logo({ main: 'KENO', sub: 'TIRAGE ÉCLAIR', size: 60, accent: '#A855F7' }) };
};

S.wheel = () => {
  seed = 177;
  const defs = `<radialGradient id="bg" cx=".5" cy=".4" r=".85"><stop offset="0" stop-color="#C2410C"/><stop offset=".5" stop-color="#5A1A04"/><stop offset="1" stop-color="#1A0701"/></radialGradient>`;
  const cols = ['#E11D48', '#F59E0B', '#7C3AED', '#10B981', '#3B82F6', '#F43F5E', '#FACC15', '#0EA5E9', '#E11D48', '#F59E0B', '#7C3AED', '#10B981', '#3B82F6', '#F43F5E', '#FACC15', '#0EA5E9'];
  const n = cols.length, R = 100;
  let segs = '';
  for (let i = 0; i < n; i++) {
    const a1 = i / n * Math.PI * 2 - Math.PI / 2, a2 = (i + 1) / n * Math.PI * 2 - Math.PI / 2;
    segs += `<path d="M0,0L${f(Math.cos(a1) * R)},${f(Math.sin(a1) * R)}A${R},${R} 0 0 1 ${f(Math.cos(a2) * R)},${f(Math.sin(a2) * R)}Z" fill="${cols[i]}" stroke="#FFE9A3" stroke-width="1.2"/>`;
    const am = (a1 + a2) / 2; segs += `<path d="M${f(Math.cos(am) * 30)},${f(Math.sin(am) * 30)}L${f(Math.cos(am) * 90)},${f(Math.sin(am) * 90)}" stroke="#fff" stroke-width="3" opacity=".22"/>`;
  }
  const bulbs = Array.from({ length: 24 }, (_, i) => { const a = i / 24 * Math.PI * 2; return `<circle cx="${f(Math.cos(a) * 113)}" cy="${f(Math.sin(a) * 113)}" r="3.6" fill="${i % 2 ? '#FFF6B0' : '#FFFFFF'}" filter="url(#glow2)"/>`; }).join('');
  const body = `<rect width="300" height="400" fill="url(#bg)"/>
  ${rays(150, 162, 24, '#FFD27A', .12, 520, .1)}
  ${glowBlob(150, 162, 120, '#F59E0B', .45)}
  <g transform="translate(150 164)" filter="url(#ds)"><circle r="122" fill="url(#gold)"/><circle r="106" fill="#1A0701"/>${bulbs}${segs}
  <circle r="100" fill="none" stroke="#fff" stroke-opacity=".15" stroke-width="8"/>
  <path d="M-100,0A100,100 0 0 1 100,0" fill="#fff" opacity=".08"/>
  <circle r="24" fill="url(#goldR)" stroke="#7A4E08" stroke-width="2"/><circle r="9" fill="#7A4E08"/></g>
  <path d="M150,58L136,32H164Z" fill="url(#goldV)" stroke="#6E4506" stroke-width="1.5" filter="url(#ds2)"/><circle cx="150" cy="30" r="8" fill="url(#goldR)" filter="url(#ds2)"/>
  ${sparkles(8, [10, 20, 280, 260], 2.5, 7, '#FFF4C7')}${sparkle(250, 70, 11)}
  <rect width="300" height="400" fill="url(#vig)"/>`;
  return { defs, body: body + logo({ main: 'FORTUNE', sub: 'ROUE DE LA', subPos: 'above', size: 50, accent: '#F59E0B' }) };
};

S.eclair = () => {
  seed = 199;
  const defs = `<radialGradient id="bg" cx=".5" cy=".38" r=".9"><stop offset="0" stop-color="#E0243A"/><stop offset=".5" stop-color="#8A0A16"/><stop offset="1" stop-color="#2A0206"/></radialGradient>
  <linearGradient id="streak" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FF7A2A" stop-opacity="0"/><stop offset=".5" stop-color="#FF5A1F" stop-opacity=".55"/><stop offset="1" stop-color="#FF7A2A" stop-opacity="0"/></linearGradient>
  <linearGradient id="bolt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF7C2"/><stop offset=".45" stop-color="#FFD23F"/><stop offset="1" stop-color="#E88A10"/></linearGradient>
  <pattern id="lattice" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0,0H8M0,0V8" stroke="#F5D76E" stroke-width="1.2"/></pattern>`;
  const body = `<rect width="300" height="400" fill="url(#bg)"/>
  <path d="M-40,120L200,-20L260,-20L20,120Z" fill="url(#streak)" opacity=".7"/><path d="M60,330L340,160L360,190L90,350Z" fill="url(#streak)" opacity=".6"/><path d="M-20,260L180,150L200,165L0,280Z" fill="url(#streak)" opacity=".45"/>
  ${rays(150, 160, 22, '#FFB36B', .08)}
  ${glowBlob(150, 150, 110, '#FF7A2A', .45)}
  <g filter="url(#glow)"><path d="M168,34L96,176H144L118,290L214,128H160L190,34Z" fill="url(#bolt)" stroke="#8A4A05" stroke-width="3" stroke-linejoin="round"/></g>
  <path d="M168,34L96,176H144L118,290L214,128H160L190,34Z" fill="none" stroke="#FFF7C2" stroke-width="1.2" opacity=".8"/>
  ${card({ x: 104, y: 214, w: 92, rot: -14, r: 'K', s: 's' })}
  ${card({ x: 178, y: 220, w: 92, rot: 10, r: 'J', s: 'c' })}
  ${stack(50, 300, 26, ['red', 'red', 'black', 'red', 'red'])}
  ${stack(252, 296, 24, ['gold', 'gold', 'gold'])}
  ${sparkles(10, [20, 20, 260, 240], 3, 7, '#FFF4C7')}${sparkle(214, 96, 11)}
  <rect width="300" height="400" fill="url(#vig)"/>`;
  return { defs, body: body + logo({ main: 'ÉCLAIR', sub: 'POKER', subPos: 'above', size: 54, accent: '#FF5A1F' }) };
};

S.atlantide = () => {
  seed = 71;
  /* Les symboles du jeu (js/games/atlantide-art.js) sont réutilisés tels quels */
  const vm = require('vm'), ctx = { encodeURIComponent };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js/games/atlantide-art.js'), 'utf8') + ';this.A=ATL_ART;', ctx);
  const sym = (k, x, y, s, rot = 0, op = 1) => `<image href="${ctx.A.uri(ctx.A.SVG[k])}" x="${f(x - s / 2)}" y="${f(y - s / 2)}" width="${s}" height="${s}" opacity="${op}" transform="rotate(${rot} ${x} ${y})"/>`;
  const defs = `<radialGradient id="bg" cx=".5" cy=".05" r="1.05"><stop offset="0" stop-color="#1FB0D2"/><stop offset=".25" stop-color="#0B5876"/><stop offset=".55" stop-color="#063450"/><stop offset=".8" stop-color="#031A2B"/><stop offset="1" stop-color="#010810"/></radialGradient>
  <linearGradient id="ray" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#BFF6FF" stop-opacity=".35"/><stop offset="1" stop-color="#BFF6FF" stop-opacity="0"/></linearGradient>
  <linearGradient id="ruin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0B4A66" stop-opacity=".2"/><stop offset=".5" stop-color="#083A52" stop-opacity=".75"/><stop offset="1" stop-color="#021018"/></linearGradient>`;
  const lightRay = (x, w, sk, op) => `<path d="M${x},-10L${x + w},-10L${x + w + sk},300L${x + sk},300Z" fill="url(#ray)" opacity="${op}"/>`;
  const bubbles = Array.from({ length: 26 }, () => { const x = f(10 + rnd() * 280), y = f(20 + rnd() * 300), r = f(1 + rnd() * 4); return `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#CFF8FF" stroke-width=".8" opacity="${f(.25 + rnd() * .5)}"/><circle cx="${f(x - r * .35)}" cy="${f(y - r * .35)}" r="${f(r * .3)}" fill="#fff" opacity=".6"/>`; }).join('');
  const body = `<rect width="300" height="400" fill="url(#bg)"/>
  ${lightRay(60, 26, 40, .7)}${lightRay(120, 14, 30, .5)}${lightRay(170, 34, 20, .6)}${lightRay(236, 18, -10, .45)}
  <g fill="url(#ruin)">
    <path d="M70,330V190L150,152L230,190V330Z"/><rect x="64" y="186" width="172" height="8"/>
    ${[0, 1, 2, 3, 4].map(i => `<rect x="${84 + i * 30}" y="198" width="12" height="140" rx="2"/>`).join('')}
    <path d="M10,330V250q0-22 20-22t20,22v80h-9v-76q0-12-11-12t-11,12v76z"/><path d="M262,330V230h10v100zM282,330V252l10-5v83z"/>
  </g>
  ${glowBlob(150, 150, 95, '#22D3EE', .45)}
  ${rays(150, 150, 18, '#9FF6FF', .07, 300)}
  ${sym('W', 150, 150, 150)}
  ${sym('PE', 64, 250, 58, 0, .95)}${sym('S', 242, 246, 70, 12)}${sym('SA', 96, 112, 46, -14, .9)}${sym('RU', 214, 100, 42, 14, .9)}
  ${bubbles}
  ${sparkles(8, [20, 40, 260, 220], 3, 7, '#E6FFFF')}${sparkle(196, 86, 10)}
  <rect width="300" height="400" fill="url(#vig)"/>`;
  return { defs, body: body + logo({ main: 'ATLANTIDE', sub: 'L’ÉVEIL DE POSÉIDON', size: 42, accent: '#22D3EE' }) };
};

/* ---------- Écriture ---------- */
function writeSvg(file, defs, body, w = W, h = H) {
  const textsFor = fam => {
    let chars = '';
    const re = new RegExp(`<text[^>]*font-family="${fam}"[^>]*>([\\s\\S]*?)</text>`, 'g');
    let m; while ((m = re.exec(body))) chars += m[1].replace(/<[^>]+>/g, '');
    return [...new Set(chars)].join('');
  };
  const cz = textsFor('Cinzel'), it = textsFor('Inter');
  let style = '';
  if (cz) style += `@font-face{font-family:Cinzel;src:url(data:font/woff2;base64,${subsetFont(FONTS.cinzel, cz)}) format('woff2');font-weight:100 900}`;
  if (it) style += `@font-face{font-family:Inter;src:url(data:font/woff2;base64,${subsetFont(FONTS.inter, it)}) format('woff2');font-weight:100 900}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs>${style ? `<style>${style}</style>` : ''}${COMMON_DEFS}${defs}</defs>${body}</svg>`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, svg);
  return svg.length;
}

module.exports = { f, rnd, setSeed: v => { seed = v; }, png, rays, glowBlob, sparkle, sparkles, dust, bokeh, suit, crown, card, chip, stack, gem, coin, writeSvg };

if (require.main === module) {
  const only = process.argv[2];
  for (const [id, fn] of Object.entries(S)) {
    if (only && only !== id) continue;
    const { defs, body } = fn();
    const n = writeSvg(path.join(OUT, id + '.svg'), defs, body);
    console.log(id.padEnd(11), (n / 1024).toFixed(1) + ' KB');
  }
}
