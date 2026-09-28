'use strict';
/* ============ Atlantide — visuels ============
   ATL_IMG liste les images définitives (générées à part). Tant qu'une entrée
   vaut null, le jeu utilise l'illustration vectorielle ci-dessous, convertie en
   image (data URI) une seule fois : le navigateur la met en cache et les 30
   cases restent légères à animer. */
const ATL_IMG = {
  sym: { PO: null, SI: null, HI: null, TU: null, NA: null, RU: null, SA: null, EM: null, AM: null, TP: null, AQ: null, W: null, S: null, PE: null, FR: null },
  bg: null, frame: null, logo: null, cover: null, kraken: null, map: null, sub: null, chest: null,
};

const ATL_ART = (() => {
  const f = n => Math.round(n * 100) / 100;
  const uri = svg => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace(/\s+/g, ' '));
  const wrap = (body, defs = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>${defs}</defs>${body}</svg>`;
  const GOLD = id => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF6CF"/><stop offset=".28" stop-color="#F3CF6B"/><stop offset=".55" stop-color="#B7832A"/><stop offset=".78" stop-color="#EBC260"/><stop offset="1" stop-color="#6F4710"/></linearGradient>`;
  const ORI = id => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE7B8"/><stop offset=".35" stop-color="#E7A65B"/><stop offset=".6" stop-color="#9A5A22"/><stop offset=".85" stop-color="#E2B274"/><stop offset="1" stop-color="#5E3210"/></linearGradient>`;
  const mix = (a, b, t) => { const p = x => [1, 3, 5].map(i => parseInt(x.slice(i, i + 2), 16)); const A = p(a), B = p(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  const sparkle = (x, y, s, o = 1) => `<path d="M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z" fill="#fff" opacity="${o}"/>`;

  /* ---- Gemmes facettées (symboles bas) ---- */
  function gem(id, pts, [light, mid, dark]) {
    const cx = 50, cy = 50, L = [-.55, -.83];
    const inner = pts.map(([x, y]) => [cx + (x - cx) * .5, cy + (y - cy) * .5 - 2]);
    let facets = '';
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], c = inner[(i + 1) % pts.length], d = inner[i];
      const mx = (a[0] + b[0]) / 2 - cx, my = (a[1] + b[1]) / 2 - cy, n = Math.hypot(mx, my) || 1;
      const t = Math.max(0, Math.min(1, .5 + .5 * ((mx / n) * L[0] + (my / n) * L[1])));
      const col = t > .5 ? mix(mid, light, (t - .5) * 2) : mix(dark, mid, t * 2);
      facets += `<path d="M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}L${f(c[0])} ${f(c[1])}L${f(d[0])} ${f(d[1])}Z" fill="${col}"/>`;
    }
    const poly = p => p.map(([x, y], i) => (i ? 'L' : 'M') + f(x) + ' ' + f(y)).join('') + 'Z';
    const defs = GOLD(id + 'g') + `<linearGradient id="${id}t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${mix(light, '#ffffff', .45)}"/><stop offset=".6" stop-color="${mid}"/><stop offset="1" stop-color="${mix(mid, dark, .4)}"/></linearGradient>`;
    const body = `<path d="${poly(pts)}" fill="#000" opacity=".35" transform="translate(1.5 3)"/>
      <path d="${poly(pts)}" fill="none" stroke="url(#${id}g)" stroke-width="7" stroke-linejoin="round"/>
      ${facets}
      <path d="${poly(inner)}" fill="url(#${id}t)"/>
      <path d="${poly(inner)}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width=".8"/>
      <path d="${poly(pts)}" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width=".8"/>
      <path d="M${f(inner[0][0] - 4)} ${f(inner[0][1] + 6)}q6 -8 14 -9" stroke="#fff" stroke-width="2.4" stroke-linecap="round" fill="none" opacity=".75"/>
      ${sparkle(68, 30, 6, .95)}${sparkle(34, 70, 3.5, .6)}`;
    return wrap(body, defs);
  }
  const ring = (n, rx, ry, cy = 50, rot = -Math.PI / 2) => Array.from({ length: n }, (_, i) => { const a = rot + i / n * Math.PI * 2; return [50 + Math.cos(a) * rx, cy + Math.sin(a) * ry]; });
  const GEMS = {
    RU: gem('ru', ring(14, 33, 38), ['#FF8FA3', '#E0173F', '#4A0414']),
    SA: gem('sa', [[26, 14], [74, 14], [86, 26], [86, 74], [74, 86], [26, 86], [14, 74], [14, 26]], ['#9CCBFF', '#2459E6', '#081A55']),
    EM: gem('em', [[34, 10], [66, 10], [78, 22], [78, 78], [66, 90], [34, 90], [22, 78], [22, 22]], ['#8DFFCB', '#0FA861', '#023A20']),
    AM: gem('am', [[50, 10], [66, 34], [88, 78], [72, 88], [50, 90], [28, 88], [12, 78], [34, 34]], ['#E7B4FF', '#9333EA', '#2B0A4F']),
    TP: gem('tp', ring(6, 38, 38, 50, 0), ['#FFE3A3', '#F29100', '#5A2800']),
    AQ: gem('aq', [[50, 8], [60, 24], [72, 44], [78, 62], [72, 80], [58, 90], [42, 90], [28, 80], [22, 62], [28, 44], [40, 24]], ['#C2FDFF', '#15C3DC', '#03465A']),
  };

  /* ---- Médaillons (symboles hauts) ---- */
  function medal(id, e1, e2, emblem, extraDefs = '') {
    const defs = GOLD(id + 'g') + ORI(id + 'o') + extraDefs +
      `<radialGradient id="${id}e" cx=".4" cy=".32" r=".8"><stop offset="0" stop-color="${e1}"/><stop offset="1" stop-color="${e2}"/></radialGradient>
       <radialGradient id="${id}s" cx=".5" cy=".3" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></radialGradient>`;
    const body = `<circle cx="51" cy="53" r="45" fill="#000" opacity=".38"/>
      <circle cx="50" cy="50" r="45" fill="url(#${id}o)"/>
      <circle cx="50" cy="50" r="40.5" fill="none" stroke="#5E3210" stroke-width="1.2" opacity=".6"/>
      ${Array.from({ length: 24 }, (_, i) => { const a = i / 24 * Math.PI * 2; return `<circle cx="${f(50 + Math.cos(a) * 42.8)}" cy="${f(50 + Math.sin(a) * 42.8)}" r="1.1" fill="#FFF1C9" opacity=".7"/>`; }).join('')}
      <circle cx="50" cy="50" r="38" fill="url(#${id}e)"/>
      <circle cx="50" cy="50" r="38" fill="url(#${id}s)"/>
      <g>${emblem}</g>
      <path d="M22 34a32 32 0 0 1 22-18" stroke="#fff" stroke-width="2.5" fill="none" opacity=".45" stroke-linecap="round"/>`;
    return wrap(body, defs);
  }
  const G = id => `url(#${id}g)`;
  const HIGH = {
    PO: medal('po', '#1B7BA8', '#062A45', `
      <path d="M50 16v68" stroke="${G('po')}" stroke-width="3" opacity=".55"/>
      <path d="M31 38 35 20 42 30 50 14 58 30 65 20 69 38Z" fill="${G('po')}" stroke="#5E3210" stroke-width="1"/>
      <circle cx="50" cy="24" r="2.6" fill="#E0173F"/><circle cx="37" cy="26" r="1.6" fill="#2459E6"/><circle cx="63" cy="26" r="1.6" fill="#2459E6"/>
      <path d="M36 40q0-4 14-4t14 4v6q0 9-14 10-14-1-14-10z" fill="${G('po')}" stroke="#5E3210" stroke-width=".8"/>
      <path d="M41 45q3-2 6 0M53 45q3-2 6 0" stroke="#3A1E05" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      <path d="M44 52q6 3 12 0" stroke="#3A1E05" stroke-width="1.2" fill="none"/>
      <path d="M34 50q-2 12 5 20 4 5 11 9 7-4 11-9 7-8 5-20-4 8-9 9-4 1-7-2-3 3-7 2-5-1-9-9z" fill="${G('po')}" stroke="#5E3210" stroke-width=".9"/>
      <path d="M40 58q3 6 2 12M46 60q2 7 1 14M54 60q-2 7-1 14M60 58q-3 6-2 12" stroke="#7A4A12" stroke-width="1" fill="none" opacity=".8"/>
      <path d="M30 40q-6 6-3 14M70 40q6 6 3 14" stroke="${G('po')}" stroke-width="3" fill="none" stroke-linecap="round"/>`),
    SI: medal('si', '#20B6A6', '#073B45', `
      <path d="M40 84C30 70 32 58 44 50c10-7 12-16 6-26" stroke="#000" stroke-opacity=".3" stroke-width="12" fill="none" stroke-linecap="round" transform="translate(1 2)"/>
      <path d="M40 84C30 70 32 58 44 50c10-7 12-16 6-26" stroke="${G('si')}" stroke-width="11" fill="none" stroke-linecap="round"/>
      <path d="M40 84C30 70 32 58 44 50c10-7 12-16 6-26" stroke="#1E8C7E" stroke-width="7" fill="none" stroke-linecap="round" stroke-dasharray="2.4 3" opacity=".7"/>
      <path d="M50 26C44 22 34 20 28 24c8 0 14 4 18 8M50 26c6-4 16-6 22-2-8 0-14 4-18 8" fill="${G('si')}" stroke="#5E3210" stroke-width="1"/>
      <path d="M50 24c-6-8-16-12-24-10 10 2 16 8 20 14zM50 24c6-8 16-12 24-10-10 2-16 8-20 14z" fill="${G('si')}" stroke="#5E3210" stroke-width="1"/>
      <circle cx="64" cy="66" r="3" fill="#FFF" opacity=".6"/><circle cx="70" cy="58" r="2" fill="#FFF" opacity=".5"/><circle cx="68" cy="74" r="1.6" fill="#FFF" opacity=".5"/>`),
    HI: medal('hi', '#E9689A', '#4A0A2A', `
      <path d="M56 18c9-1 15 6 12 13-2 4-7 5-10 5 4 6 5 14 1 21-4 7-12 9-13 17-1 7 6 11 11 7 3-3 1-8-3-7-3 1-2 5 0 4" stroke="#000" stroke-opacity=".3" stroke-width="9" fill="none" stroke-linecap="round" transform="translate(1 2)"/>
      <path d="M56 18c9-1 15 6 12 13-2 4-7 5-10 5 4 6 5 14 1 21-4 7-12 9-13 17-1 7 6 11 11 7 3-3 1-8-3-7-3 1-2 5 0 4" stroke="${G('hi')}" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M66 25l12-3-3 7z" fill="${G('hi')}" stroke="#5E3210" stroke-width=".8"/>
      <path d="M52 18l-4-7 7 3M48 26l-7-3 5 7M46 36l-8-1 6 6" fill="${G('hi')}" stroke="#5E3210" stroke-width=".8"/>
      <circle cx="61" cy="25" r="1.8" fill="#3A1E05"/>
      <path d="M58 40c-5 2-8 7-8 12" stroke="#7A4A12" stroke-width="1.2" fill="none" stroke-dasharray="1.6 2"/>`),
    TU: medal('tu', '#3FA36B', '#0B3A26', `
      <path d="M50 20c6 0 9 4 9 7s-3 5-9 5-9-2-9-5 3-7 9-7z" fill="${G('tu')}" stroke="#5E3210" stroke-width="1"/>
      <path d="M30 40c-10-6-16-4-18 0 6 2 12 6 18 8M70 40c10-6 16-4 18 0-6 2-12 6-18 8M34 66c-8 4-10 10-8 14 4-2 8-6 12-10M66 66c8 4 10 10 8 14-4-2-8-6-12-10" fill="${G('tu')}" stroke="#5E3210" stroke-width="1"/>
      <ellipse cx="50" cy="54" rx="22" ry="25" fill="${G('tu')}" stroke="#5E3210" stroke-width="1.2"/>
      <path d="M50 38l8 6v10l-8 6-8-6V44zM42 44l-9 3M58 44l9 3M42 54l-9 5M58 54l9 5M50 60v14M42 54l-6 12M58 54l6 12" stroke="#6E4210" stroke-width="1.4" fill="none"/>
      <path d="M50 38l8 6v10l-8 6-8-6V44z" fill="#1E8C5E" opacity=".45"/>`),
    NA: medal('na', '#8B5CF6', '#241046', `
      <path d="M50 20a30 30 0 1 1-2 60 22 22 0 0 1-12-40 15 15 0 0 1 22 10 9 9 0 0 1-12 8" stroke="#000" stroke-opacity=".3" stroke-width="5" fill="none" transform="translate(1 2)"/>
      <path d="M50 20a30 30 0 1 1-2 60 22 22 0 0 1-12-40 15 15 0 0 1 22 10 9 9 0 0 1-12 8z" fill="${G('na')}" stroke="#5E3210" stroke-width="1.2"/>
      ${[0, 1, 2, 3, 4, 5, 6].map(i => { const a = -1.2 + i * .62, r1 = 12, r2 = 29; return `<path d="M${f(50 + Math.cos(a) * r1)} ${f(50 + Math.sin(a) * r1)}Q${f(50 + Math.cos(a + .3) * 22)} ${f(50 + Math.sin(a + .3) * 22)} ${f(50 + Math.cos(a) * r2)} ${f(50 + Math.sin(a) * r2)}" stroke="#8A4A18" stroke-width="2" fill="none" opacity=".7"/>`; }).join('')}
      <circle cx="44" cy="52" r="3" fill="#5E3210"/>`),
  };

  /* ---- Spéciaux ---- */
  const W = wrap(`
    <circle cx="50" cy="50" r="46" fill="url(#wg2)"/>
    <circle cx="50" cy="50" r="46" fill="none" stroke="url(#wgd)" stroke-width="4"/>
    <circle cx="50" cy="50" r="40" fill="url(#wgr)" opacity=".9"/>
    <path d="M50 12 44 22 48 22 48 30 36 30 36 18 30 24 30 34 Q30 42 38 42 L48 42 48 86 52 86 52 42 62 42 Q70 42 70 34 L70 24 64 18 64 30 52 30 52 22 56 22Z" fill="#000" opacity=".35" transform="translate(1.5 2.5)"/>
    <path d="M50 12 44 22 48 22 48 30 36 30 36 18 30 24 30 34 Q30 42 38 42 L48 42 48 86 52 86 52 42 62 42 Q70 42 70 34 L70 24 64 18 64 30 52 30 52 22 56 22Z" fill="url(#wgd)" stroke="#5E3210" stroke-width="1"/>
    <path d="M18 30l8 4-6 4 9 3M82 30l-8 4 6 4-9 3" stroke="#BFF8FF" stroke-width="1.6" fill="none" stroke-linejoin="round" opacity=".9"/>
    <rect x="14" y="62" width="72" height="20" rx="5" fill="url(#wgd)" stroke="#5E3210" stroke-width="1"/>
    <text x="50" y="77" text-anchor="middle" font-family="Georgia,serif" font-weight="900" font-size="16" fill="#0A3A55" letter-spacing="1.5">WILD</text>`,
    GOLD('wgd') + `<radialGradient id="wg2" cx=".5" cy=".45" r=".6"><stop offset="0" stop-color="#8FF7FF"/><stop offset=".55" stop-color="#1397C4"/><stop offset="1" stop-color="#062845"/></radialGradient>
    <radialGradient id="wgr" cx=".5" cy=".4" r=".6"><stop offset="0" stop-color="#E6FFFF" stop-opacity=".9"/><stop offset=".5" stop-color="#5DE1F7" stop-opacity=".35"/><stop offset="1" stop-color="#5DE1F7" stop-opacity="0"/></radialGradient>`);
  const S = wrap(`
    <ellipse cx="51" cy="56" rx="38" ry="30" fill="#000" opacity=".35"/>
    <path d="M18 60C14 40 30 20 52 18c20-2 34 14 32 30-1 12-10 22-24 26L36 82C26 80 20 72 18 60z" fill="url(#sc1)" stroke="url(#scg)" stroke-width="3"/>
    <path d="M52 18c-6 10-4 22 4 30s10 20 4 26M40 22c-4 12 0 24 8 32M30 32c-2 10 2 22 10 30" stroke="#9C3A5A" stroke-width="1.6" fill="none" opacity=".7"/>
    <path d="M60 74c10 2 22 6 26 14-10 0-20-2-30-6z" fill="url(#scg)" stroke="#5E3210" stroke-width="1"/>
    <path d="M28 46c6-10 16-16 26-16" stroke="#fff" stroke-width="3" fill="none" opacity=".55" stroke-linecap="round"/>
    <rect x="16" y="78" width="68" height="16" rx="4" fill="url(#scg)" stroke="#5E3210" stroke-width="1"/>
    <text x="50" y="90.5" text-anchor="middle" font-family="Georgia,serif" font-weight="900" font-size="11" fill="#5A1030" letter-spacing="1.2">BONUS</text>`,
    GOLD('scg') + `<radialGradient id="sc1" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#FFE6EE"/><stop offset=".45" stop-color="#F59AB7"/><stop offset="1" stop-color="#9C2D55"/></radialGradient>`);
  const PE = wrap(`
    <ellipse cx="50" cy="88" rx="26" ry="5" fill="#000" opacity=".35"/>
    <circle cx="50" cy="50" r="38" fill="url(#pe1)"/>
    <circle cx="50" cy="50" r="38" fill="url(#pe2)"/>
    <circle cx="50" cy="50" r="37" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1.2"/>
    <ellipse cx="38" cy="34" rx="12" ry="8" fill="#fff" opacity=".85" transform="rotate(-30 38 34)"/>
    <circle cx="66" cy="68" r="4" fill="#fff" opacity=".4"/>`,
    `<radialGradient id="pe1" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".45" stop-color="#EAF2FF"/><stop offset=".8" stop-color="#B9C6E6"/><stop offset="1" stop-color="#7A86B5"/></radialGradient>
     <radialGradient id="pe2" cx=".7" cy=".75" r=".6"><stop offset="0" stop-color="#FFC9F2" stop-opacity=".55"/><stop offset=".5" stop-color="#9DEBFF" stop-opacity=".25"/><stop offset="1" stop-color="#9DEBFF" stop-opacity="0"/></radialGradient>`);
  const FR = wrap(`
    <path d="M16 20l20-6 14 5 18-4 16 8-4 16 6 14-6 18-18 8-16-5-14 6-12-12 4-16-6-14z" fill="#000" opacity=".35" transform="translate(1.5 3)"/>
    <path d="M16 20l20-6 14 5 18-4 16 8-4 16 6 14-6 18-18 8-16-5-14 6-12-12 4-16-6-14z" fill="url(#fr1)" stroke="#6E4618" stroke-width="1.5"/>
    <path d="M24 70c8-6 12-18 22-20s18 6 24-4" stroke="#8A2A18" stroke-width="2" fill="none" stroke-dasharray="3 3"/>
    <path d="M66 42l6 6M72 42l-6 6" stroke="#B3261E" stroke-width="2.6" stroke-linecap="round"/>
    <g transform="translate(40 40)"><circle r="13" fill="#F6E4B8" stroke="#6E4618" stroke-width="1.2"/>
    <path d="M0-12 3-3 12 0 3 3 0 12-3 3-12 0-3-3z" fill="url(#frg)" stroke="#5E3210" stroke-width=".7"/><circle r="2" fill="#1E3C8F"/></g>`,
    GOLD('frg') + `<linearGradient id="fr1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF4D6"/><stop offset=".6" stop-color="#E6C98E"/><stop offset="1" stop-color="#B98B4A"/></linearGradient>`);

  const SVG = Object.assign({}, HIGH, GEMS, { W, S, PE, FR });
  const cache = {};
  const src = k => ATL_IMG.sym[k] || cache[k] || (cache[k] = uri(SVG[k]));
  return { src, SVG, uri, GOLD };
})();

/* Couleurs de chaque symbole (courants gagnants, particules). */
const ATL_COL = { PO: '#3FC7FF', SI: '#3FF0D2', HI: '#FF6FA8', TU: '#5BE08A', NA: '#B07CFF', RU: '#FF4D6D', SA: '#4D8DFF', EM: '#2EE59D', AM: '#C77DFF', TP: '#FFB02E', AQ: '#5FF3FF', W: '#9FF6FF', S: '#FF9EC4', PE: '#F4F7FF', FR: '#F2D08B' };
