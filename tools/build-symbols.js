'use strict';
/* Génère assets/symbols/<thème>/<clé>.svg : symboles illustrés des rouleaux Pharaon d'Or et Dragon Fortune.
   Usage : node tools/build-symbols.js */
const path = require('path');
const K = require('./build-covers.js');
const { f, glowBlob, sparkle, gem, rays, writeSvg } = K;
const OUT = path.join(__dirname, '..', 'assets/symbols');
const SZ = 128;

const DEFS = `
<linearGradient id="lapis" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4F7BE0"/><stop offset=".5" stop-color="#1E3C8F"/><stop offset="1" stop-color="#0D1C4A"/></linearGradient>
<linearGradient id="turq" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8FF0E3"/><stop offset=".5" stop-color="#2BB3A3"/><stop offset="1" stop-color="#0E5A52"/></linearGradient>
<linearGradient id="ruby" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF8A8A"/><stop offset=".5" stop-color="#D62828"/><stop offset="1" stop-color="#6E0A0A"/></linearGradient>
<linearGradient id="jade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9BF2BF"/><stop offset=".5" stop-color="#1FA565"/><stop offset="1" stop-color="#0A4A2B"/></linearGradient>
<linearGradient id="hl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></linearGradient>
<radialGradient id="halo"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`;

const cRays = (c, op) => `<clipPath id="rc"><circle cx="64" cy="56" r="54"/></clipPath><g clip-path="url(#rc)" opacity=".9">${rays(64, 56, 18, c, op, 80)}</g>`;
const halo = (c, op = .38, r = 58) => `<circle cx="64" cy="64" r="${r}" fill="${c}" opacity="${op}" filter="url(#blur8)"/>`;

/* Ruban « WILD » / « SCATTER » */
function ribbon(txt, c1, c2, y = 100) {
  const w = txt.length > 4 ? 116 : 96, x0 = 64 - w / 2, x1 = 64 + w / 2;
  return `<g filter="url(#ds2)"><linearGradient id="rb${txt}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
  <path d="M${x0 - 6},${y + 3}L${x0 + 4},${y + 3}L${x0 + 4},${y + 19}L${x0 - 6},${y + 19}L${x0 - 1},${y + 11}Z M${x1 + 6},${y + 3}L${x1 - 4},${y + 3}L${x1 - 4},${y + 19}L${x1 + 6},${y + 19}L${x1 + 1},${y + 11}Z" fill="${c2}"/>
  <rect x="${x0}" y="${y}" width="${w}" height="19" rx="3" fill="url(#rb${txt})" stroke="url(#gold)" stroke-width="1.6"/>
  <text x="64" y="${y + 14.5}" font-family="Cinzel" font-weight="900" font-size="${txt.length > 4 ? 12.5 : 14.5}" letter-spacing="1.5" text-anchor="middle" fill="url(#goldT)" stroke="#2A1703" stroke-width="2.4" paint-order="stroke">${txt}</text></g>`;
}

/* Lettre royale biseautée */
function letter(ch, fillId, glow, extra = '') {
  const fs = ch.length > 1 ? 70 : 88, y = ch.length > 1 ? 88 : 96;
  const tl = ch.length > 1 ? ` textLength="96" lengthAdjust="spacingAndGlyphs"` : '';
  const x = 64, sc = ch === 'Q' ? ' transform="translate(58 60) scale(.78) translate(-64 -60)"' : '';
  const T = a => `<text x="${x}" y="${y}" font-family="Cinzel" font-weight="900" font-size="${fs}" text-anchor="middle"${tl} ${a}>${ch}</text>`;
  return `${halo(glow, .4, 50)}${extra}<g${sc}><g filter="url(#ds)">${T('fill="#1A0E02" stroke="#1A0E02" stroke-width="13" stroke-linejoin="round"')}${T('fill="url(#gold)" stroke="url(#gold)" stroke-width="7" stroke-linejoin="round"')}</g>${T(`fill="url(#${fillId})"`)}${T('fill="url(#hl)"')}${T('fill="none" stroke="#FFF6D0" stroke-width=".8" stroke-opacity=".7"')}</g>${sparkle(94, 30, 6, .9)}`;
}

const P = {}, D = {};

/* ================= Pharaon d'Or ================= */
P.W = () => `${halo('#F5C04E', .5)}${cRays('#FFD27A', .2)}
  <g filter="url(#ds)">
  <path d="M22,90L16,42L40,62L52,26L64,50L76,26L88,62L112,42L106,90Z" fill="url(#gold)" stroke="#6E4506" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M26,86L22,52L40,68L52,36L60,58" fill="none" stroke="#FFF3C4" stroke-width="1.6" opacity=".6"/>
  ${[[16, 42], [52, 26], [76, 26], [112, 42]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5.5" fill="url(#lapis)" stroke="url(#gold)" stroke-width="1.5"/><circle cx="${x - 1.6}" cy="${y - 1.8}" r="1.5" fill="#fff" opacity=".8"/>`).join('')}
  <rect x="20" y="74" width="88" height="18" rx="3" fill="url(#goldV)" stroke="#6E4506" stroke-width="1.4"/>
  ${[30, 42, 86, 98].map(x => `<rect x="${x - 4}" y="79" width="8" height="8" rx="1.5" fill="url(#turq)" stroke="#6E4506" stroke-width=".8"/>`).join('')}
  <ellipse cx="64" cy="83" rx="11" ry="7" fill="url(#ruby)" stroke="#6E4506" stroke-width="1.2"/><ellipse cx="61" cy="80.5" rx="4" ry="2" fill="#fff" opacity=".7"/>
  <path d="M64,72C58,66 58,56 64,48C70,56 70,66 64,72Z" fill="url(#goldV)" stroke="#6E4506" stroke-width="1.2"/><circle cx="64" cy="54" r="1.8" fill="#D62828"/>
  </g>${ribbon('WILD', '#D62828', '#6E0A0A', 99)}${sparkle(100, 22, 7)}${sparkle(24, 66, 4, .8)}`;

P.P = () => `<linearGradient id="pyrL2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFF3BF"/><stop offset=".5" stop-color="#F0C75E"/><stop offset="1" stop-color="#C98E26"/></linearGradient>
  <linearGradient id="pyrR2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9A6410"/><stop offset="1" stop-color="#5A3606"/></linearGradient>
  ${halo('#FFD27A', .6)}${cRays('#FFF3C4', .28)}
  <g filter="url(#ds)">
  <path d="M64,10L112,94H16Z" fill="url(#pyrL2)"/><path d="M64,10L112,94H64Z" fill="url(#pyrR2)"/>
  ${[26, 42, 58, 74].map((y, i) => { const hw = (y - 10) * 48 / 84; return `<path d="M${(64 - hw).toFixed(1)},${y}H${(64 + hw).toFixed(1)}" stroke="#7A4E08" stroke-width="1.2" opacity=".55"/>`; }).join('')}
  <path d="M64,10L78,34H50Z" fill="#FFFBE6"/><path d="M64,10L78,34H64Z" fill="#F5D76E"/>
  <path d="M46,58Q64,44 82,58Q64,72 46,58Z" fill="#0D1C4A" stroke="#FFF3C4" stroke-width="2"/><circle cx="64" cy="58" r="6.5" fill="url(#lapis)"/><circle cx="62" cy="56" r="2" fill="#fff"/>
  <path d="M64,10L112,94H16Z" fill="none" stroke="#6E4506" stroke-width="1.6"/></g>
  ${ribbon('BONUS', '#1E3C8F', '#0D1C4A', 99)}${sparkle(98, 20, 8)}${sparkle(26, 40, 5, .9)}`;

P.S = () => {
  const wing = side => {
    const bands = [['url(#gold)', 0], ['url(#lapis)', 1], ['url(#turq)', 2]].map(([c, k]) => {
      const y0 = 44 + k * 9, y1 = 30 + k * 13;
      return `<path d="M76,${y0}C92,${y0 - 4} 108,${y1 + 4} 124,${y1}C120,${y1 + 8} 112,${y1 + 13} 100,${y1 + 15}C92,${y0 + 10} 84,${y0 + 10} 76,${y0 + 9}Z" fill="${c}" stroke="#6E4506" stroke-width="1"/>` +
        Array.from({ length: 5 }, (_, i) => { const x = 86 + i * 8; return `<path d="M${x},${y0 + (y1 - y0) * (x - 76) / 48 + 1}l-2,${10 - k}" stroke="#6E4506" stroke-width=".8" opacity=".6"/>`; }).join('');
    }).join('');
    return `<g ${side < 0 ? 'transform="translate(128 0) scale(-1 1)"' : ''}>${bands}</g>`;
  };
  return `${halo('#FF9A3A', .55)}${cRays('#FFD27A', .24)}
  <g filter="url(#ds)">${wing(1)}${wing(-1)}
  <circle cx="64" cy="54" r="22" fill="url(#goldR)"/><circle cx="64" cy="54" r="17" fill="url(#ruby)"/><circle cx="58" cy="48" r="6" fill="#fff" opacity=".35"/>
  <path d="M46,70C44,78 48,84 54,82M82,70C84,78 80,84 74,82" stroke="url(#gold)" stroke-width="4" fill="none" stroke-linecap="round"/></g>
  ${ribbon('SCATTER', '#E88A1A', '#7A3A05', 99)}${sparkle(98, 18, 7)}`;
};

P.E = () => `${halo('#2E8FB0', .45)}
  <g filter="url(#ds)"><circle cx="64" cy="62" r="52" fill="url(#gold)"/><circle cx="64" cy="62" r="46" fill="url(#lapis)"/>
  <circle cx="64" cy="62" r="42" fill="none" stroke="url(#gold)" stroke-width="1" stroke-dasharray="2 3" opacity=".8"/>
  ${Array.from({ length: 16 }, (_, i) => { const a = i / 16 * Math.PI * 2; return `<circle cx="${f(64 + Math.cos(a) * 49)}" cy="${f(62 + Math.sin(a) * 49)}" r="1.4" fill="#FFF3C4"/>`; }).join('')}
  <g stroke="url(#gold)" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M26,46Q62,28 100,42" stroke-width="7"/>
    <path d="M28,62Q58,42 94,60Q62,78 28,62Z" fill="#F6F1E4" stroke-width="5"/>
    <path d="M94,60L110,63" stroke-width="5"/>
    <path d="M52,74L46,100" stroke-width="6"/>
    <path d="M70,74C72,90 86,100 96,94C104,88 98,78 90,82" stroke-width="5"/>
  </g>
  <circle cx="60" cy="60" r="10" fill="#0E1633" stroke="url(#gold)" stroke-width="2"/><circle cx="57" cy="57" r="3" fill="#fff" opacity=".85"/>
  <ellipse cx="46" cy="30" rx="18" ry="8" fill="#fff" opacity=".18" transform="rotate(-25 46 30)"/></g>`;

P.N = () => `<clipPath id="med"><circle cx="64" cy="62" r="48"/></clipPath>
  <radialGradient id="sunb" cx=".5" cy=".62" r=".7"><stop offset="0" stop-color="#FFF1B8"/><stop offset=".35" stop-color="#FFB547"/><stop offset=".75" stop-color="#D2561E"/><stop offset="1" stop-color="#5A1A08"/></radialGradient>
  ${halo('#F29A2E', .45)}
  <g filter="url(#ds)"><circle cx="64" cy="62" r="53" fill="url(#gold)"/>
  <g clip-path="url(#med)"><rect x="0" y="0" width="128" height="128" fill="url(#sunb)"/><circle cx="64" cy="70" r="22" fill="#FFF3C4" opacity=".75"/>
  <path d="M8,86L30,64L52,86Z" fill="#A4541A"/><path d="M30,64L52,86H40Z" fill="#6B3410"/><path d="M78,86L96,68L114,86Z" fill="#A4541A"/><path d="M96,68L114,86H104Z" fill="#6B3410"/>
  <path d="M0,86C30,80 60,92 128,84V128H0Z" fill="#7A3A0E"/><path d="M0,98C40,90 80,104 128,94V128H0Z" fill="#4A2206"/>
  <path d="M30,80C27,72 23,64 21,60C17,58 13,56 11,52L15,48C21,46 25,50 27,54C29,60 33,66 37,70C41,60 47,50 55,52C59,53 61,58 65,58C67,50 77,46 85,54C91,58 96,66 98,76L101,84L98,84L96,80C95,84 93,86 91,88L92,110L88,110L86,90L85,110L81,110L80,88C69,90 57,90 49,88L48,110L44,110L43,90L41,110L37,110L37,88C34,86 32,84 30,80Z" fill="#241004" stroke="#FFD27A" stroke-width="1" stroke-opacity=".55"/>
  </g><circle cx="64" cy="62" r="48" fill="none" stroke="#6E4506" stroke-width="2"/>
  <ellipse cx="44" cy="30" rx="20" ry="8" fill="#fff" opacity=".16" transform="rotate(-25 44 30)"/></g>`;

P.B = () => {
  const body = 'M50,20H78V28C78,32 74,34 74,38C94,46 102,64 98,82C94,100 82,112 64,114C46,112 34,100 30,82C26,64 34,46 54,38C54,34 50,32 50,28Z';
  return `<clipPath id="vb"><path d="${body}"/></clipPath>${halo('#4FAE8A', .45)}
  <g filter="url(#ds)"><path d="${body}" fill="url(#gold)" stroke="#6E4506" stroke-width="1.6"/>
  <g clip-path="url(#vb)"><rect x="0" y="50" width="128" height="7" fill="url(#lapis)"/><rect x="0" y="58" width="128" height="4" fill="url(#turq)"/><rect x="0" y="94" width="128" height="6" fill="url(#lapis)"/><rect x="0" y="101" width="128" height="3" fill="url(#ruby)"/>
  ${Array.from({ length: 12 }, (_, i) => `<path d="M${14 + i * 9},62l4.5,6 4.5,-6" fill="url(#ruby)"/>`).join('')}
  <path d="${body}" fill="url(#shadeV)"/></g>
  <g transform="translate(64 80)" fill="url(#lapis)" stroke="#0D1C4A" stroke-width=".8"><ellipse cx="0" cy="-6" rx="6" ry="7.5" fill="none" stroke="url(#lapis)" stroke-width="3.6"/><rect x="-11" y="0" width="22" height="3.6" rx="1"/><rect x="-1.8" y="1" width="3.6" height="14" rx="1"/></g>
  <rect x="46" y="16" width="36" height="7" rx="3" fill="url(#goldV)" stroke="#6E4506" stroke-width="1.2"/>
  <path d="M40,58C38,72 40,90 48,102" stroke="#fff" stroke-width="3.4" fill="none" opacity=".4" stroke-linecap="round"/></g>
  ${sparkle(92, 34, 5)}`;
};

P.V = () => `${halo('#5FAE4F', .45)}
  <g filter="url(#ds)">
  <ellipse cx="64" cy="112" rx="40" ry="9" fill="#0F3A12"/><path d="M26,110C26,98 46,96 64,100C82,104 102,100 102,110" stroke="url(#jade)" stroke-width="10" fill="none" stroke-linecap="round"/>
  <path d="M64,34C90,34 104,52 102,70C100,86 86,96 76,100L52,100C42,96 28,86 26,70C24,52 38,34 64,34Z" fill="url(#gold)" stroke="#6E4506" stroke-width="1.6"/>
  <path d="M64,42C84,43 94,56 92,70C90,82 80,90 72,92L56,92C48,90 38,82 36,70C34,56 44,43 64,42Z" fill="url(#lapis)"/>
  ${[52, 62, 72, 82].map((y, i) => `<path d="M${40 + i * 1.5},${y}Q64,${y + 8} ${88 - i * 1.5},${y}" stroke="url(#turq)" stroke-width="3.4" fill="none"/>`).join('')}
  <path d="M64,44V92" stroke="url(#gold)" stroke-width="2.2"/>
  <path d="M56,46C54,38 56,30 58,26L70,26C72,30 74,38 72,46Z" fill="url(#jade)"/>
  <path d="M64,6C78,6 84,14 84,22C84,30 76,34 64,34C52,34 44,30 44,22C44,14 50,6 64,6Z" fill="url(#jade)" stroke="#0F3A12" stroke-width="1.4"/>
  <path d="M48,16Q64,8 80,16" stroke="url(#gold)" stroke-width="3" fill="none"/>
  <path d="M51,20L59,22L57,26Z M77,20L69,22L71,26Z" fill="#FF3B30" stroke="#300" stroke-width=".6"/>
  <path d="M52,29Q64,35 76,29L72,32L68,30L64,33L60,30L56,32Z" fill="#fff"/>
  <path d="M64,34V40M64,40L60,44M64,40L68,44" stroke="#E23B3B" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  <ellipse cx="56" cy="12" rx="7" ry="3.5" fill="#fff" opacity=".35" transform="rotate(-15 56 12)"/>
  <ellipse cx="44" cy="54" rx="6" ry="14" fill="#fff" opacity=".18" transform="rotate(20 44 54)"/></g>`;

const PL = { A: ['ruby', '#D62828'], K: ['lapis', '#3B6FE0'], Q: ['turq', '#2BB3A3'], J: ['jade', '#1FA565'], T: ['amethyst', '#8B5CF6'] };
for (const [k, [g, c]] of Object.entries(PL)) P[k] = () => letter(k === 'T' ? '10' : k, g, c);

/* ================= Dragon Fortune ================= */
D.W = () => `<radialGradient id="redR" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#FF6B5A"/><stop offset=".5" stop-color="#B81D1D"/><stop offset="1" stop-color="#4A0505"/></radialGradient>
  ${halo('#FF5A2A', .5)}
  <g filter="url(#ds)"><circle cx="64" cy="56" r="48" fill="url(#gold)"/><circle cx="64" cy="56" r="42" fill="url(#redR)"/>
  <circle cx="64" cy="56" r="38" fill="none" stroke="url(#gold)" stroke-width="1" stroke-dasharray="3 3" opacity=".7"/></g>
  <g transform="translate(36 68) scale(.9)" filter="url(#ds2)">
    <path d="M-4,-20L-26,-34L-16,-16L-36,-12L-18,-4L-32,8L-14,6L-24,22L-4,12Z" fill="#E5261F" stroke="#FFD27A" stroke-width="1"/>
    <path d="M4,-24C0,-44 -10,-54 -20,-58M-3,-42L-12,-40M8,-26C10,-46 22,-56 34,-58M16,-46L26,-42" stroke="#FFE08A" stroke-width="3.4" fill="none" stroke-linecap="round"/>
    <path d="M36,-4L62,-6C58,4 56,12 60,18C50,12 44,8 36,-4Z" fill="#4A0404"/>
    <path d="M-8,-18C4,-30 26,-30 40,-22C50,-18 58,-20 66,-25C73,-28 78,-20 73,-13C70,-9 64,-7 60,-6L36,-4C24,-2 10,2 -4,4C-12,2 -14,-10 -8,-18Z" fill="url(#body)" stroke="#6E4506" stroke-width="1.2"/>
    <path d="M0,6C14,6 30,4 44,8C52,10 58,14 61,19C50,21 38,19 26,17C14,17 4,14 0,6Z" fill="url(#body)" stroke="#6E4506" stroke-width="1.2"/>
    <path d="M42,-4l2.5,5 2.5,-5M50,-5l2.5,5 2.5,-5M56,-5.5l2,4.5 2,-4.5M44,9l2,-4 2,4M52,12l2,-4 2,4" fill="#fff"/>
    <circle cx="69" cy="-20" r="4.2" fill="url(#goldR)" stroke="#6E4506" stroke-width=".8"/>
    <path d="M10,-24Q22,-34 36,-25" stroke="#8A5208" stroke-width="4" fill="none" stroke-linecap="round"/>
    <ellipse cx="23" cy="-16" rx="6.5" ry="5" fill="#FFF6D0"/><circle cx="24.5" cy="-16" r="3.4" fill="#C4151C"/><circle cx="25" cy="-16" r="1.5" fill="#000"/>
    <path d="M70,-16C80,-12 86,-24 96,-18M62,16C70,26 78,22 88,30" stroke="#FFE08A" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <path d="M10,12L4,26L16,18L14,32L24,18L28,30L32,16Z" fill="#E5261F" stroke="#FFD27A" stroke-width=".8"/>
  </g>${ribbon('WILD', '#C4151C', '#5A0606', 99)}${sparkle(104, 20, 7)}`;

D.S = () => `<radialGradient id="pearl" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".35" stop-color="#E6F7FF"/><stop offset=".65" stop-color="#B9E4F2"/><stop offset=".85" stop-color="#F4C6E6"/><stop offset="1" stop-color="#7FB8D4"/></radialGradient>
  <linearGradient id="flame" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#C4151C"/><stop offset=".5" stop-color="#FF6A2A"/><stop offset="1" stop-color="#FFD24A"/></linearGradient>
  ${halo('#7FD9D4', .55)}
  <g filter="url(#glow2)">${Array.from({ length: 8 }, (_, i) => `<path transform="rotate(${i * 45} 64 54)" d="M64,54C58,42 60,26 70,14C68,26 74,32 72,42C71,48 68,52 64,54Z" fill="url(#flame)" opacity=".92"/>`).join('')}</g>
  <g filter="url(#ds)"><circle cx="64" cy="54" r="26" fill="url(#pearl)"/><circle cx="64" cy="54" r="26" fill="none" stroke="#fff" stroke-width="1" opacity=".6"/>
  <ellipse cx="55" cy="44" rx="9" ry="6" fill="#fff" opacity=".85" transform="rotate(-30 55 44)"/><circle cx="74" cy="66" r="3" fill="#fff" opacity=".6"/></g>
  ${ribbon('SCATTER', '#1FA5A0', '#0B4A48', 99)}${sparkle(100, 20, 7)}${sparkle(28, 26, 5)}`;

D.E = () => {
  const roof = (y, w, h) => `<path d="M${64 - w / 2 - 10},${y + h + 2}C${64 - w / 2},${y + h - 2} ${64 - w / 3},${y} 64,${y - 3}C${64 + w / 3},${y} ${64 + w / 2},${y + h - 2} ${64 + w / 2 + 10},${y + h + 2}C${64 + w / 3},${y + h + 1} ${64 - w / 3},${y + h + 1} ${64 - w / 2 - 10},${y + h + 2}Z" fill="url(#jade)" stroke="url(#gold)" stroke-width="1.8"/>`;
  const wall = (y, w, h) => `<rect x="${64 - w / 2}" y="${y}" width="${w}" height="${h}" fill="url(#ruby)" stroke="#5A0606" stroke-width=".8"/>${[-1, 1].map(s => `<rect x="${64 + s * (w / 2 - 4) - 2}" y="${y}" width="4" height="${h}" fill="url(#goldV)"/>`).join('')}<rect x="${64 - 5}" y="${y + 3}" width="10" height="${h - 3}" rx="5" fill="#2A0303"/>`;
  return `${halo('#E1544B', .45)}<g filter="url(#ds)">
  <rect x="20" y="106" width="88" height="8" rx="2" fill="#6B6F7C"/><rect x="26" y="100" width="76" height="7" rx="2" fill="#8A8F9C"/>
  ${wall(82, 60, 18)}${roof(68, 76, 14)}${wall(58, 44, 12)}${roof(46, 60, 12)}${wall(38, 30, 9)}${roof(26, 44, 11)}
  <path d="M64,10V24" stroke="url(#gold)" stroke-width="3"/><circle cx="64" cy="10" r="3.6" fill="url(#goldR)"/><circle cx="64" cy="17" r="2.6" fill="url(#goldR)"/>
  ${[[20, 86], [108, 86], [28, 62], [100, 62], [36, 40], [92, 40]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.4" fill="#FFD24A" filter="url(#glow2)"/>`).join('')}</g>`;
};

D.N = () => `<radialGradient id="lan" cx=".38" cy=".38" r=".7"><stop offset="0" stop-color="#FFB37A"/><stop offset=".4" stop-color="#E5261F"/><stop offset="1" stop-color="#7A0808"/></radialGradient>
  ${halo('#FF6A2A', .6)}
  <g filter="url(#ds)"><path d="M64,4V20" stroke="url(#gold)" stroke-width="2"/><rect x="46" y="18" width="36" height="10" rx="3" fill="url(#goldV)" stroke="#6E4506"/>
  <ellipse cx="64" cy="62" rx="40" ry="36" fill="url(#lan)"/>
  ${[-26, -13, 0, 13, 26].map(k => `<path d="M${64 + k},28Q${64 + k * 1.9},62 ${64 + k},96" stroke="#F5C04E" stroke-width="1.4" fill="none" opacity=".6"/>`).join('')}
  <ellipse cx="64" cy="62" rx="40" ry="36" fill="none" stroke="#6E0808" stroke-width="1.2"/>
  <circle cx="64" cy="62" r="14" fill="#FFE08A" opacity=".85"/><path d="M58,56h12M64,52v20M57,64h14M59,70h10" stroke="#B81D1D" stroke-width="2.4" stroke-linecap="round"/>
  <rect x="46" y="94" width="36" height="10" rx="3" fill="url(#goldV)" stroke="#6E4506"/>
  <path d="M64,104V124M58,106V122M70,106V122" stroke="#F5C04E" stroke-width="2" stroke-linecap="round"/>
  <ellipse cx="50" cy="44" rx="10" ry="16" fill="#fff" opacity=".22" transform="rotate(25 50 44)"/></g>`;

D.B = () => `<linearGradient id="porc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#C9D6EA"/></linearGradient>
  <linearGradient id="stick" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8A5208"/><stop offset=".5" stop-color="#E9BE55"/><stop offset="1" stop-color="#8A5208"/></linearGradient>
  ${halo('#C9A227', .45)}
  <g filter="url(#ds)">
  <ellipse cx="64" cy="60" rx="46" ry="12" fill="#F5F0E1"/>${Array.from({ length: 22 }, (_, i) => `<ellipse cx="${f(26 + (i % 11) * 7.5)}" cy="${f(56 + Math.floor(i / 11) * 5 + (i % 3))}" rx="3.6" ry="2" fill="#fff" stroke="#E2DACA" stroke-width=".5"/>`).join('')}
  <path d="M18,60C18,86 38,104 64,104C90,104 110,86 110,60C98,70 30,70 18,60Z" fill="url(#porc)"/>
  <path d="M22,70C40,78 88,78 106,70" stroke="#1E3C8F" stroke-width="3" fill="none"/>
  ${[36, 52, 76, 92].map(x => `<circle cx="${x}" cy="${86 + (x === 52 || x === 76 ? 4 : 0)}" r="5" fill="none" stroke="#1E3C8F" stroke-width="2"/><circle cx="${x}" cy="${86 + (x === 52 || x === 76 ? 4 : 0)}" r="1.6" fill="#1E3C8F"/>`).join('')}
  <rect x="48" y="104" width="32" height="7" rx="2" fill="#AAB6CC"/>
  <path d="M30,64C44,96 90,100 100,70" stroke="#fff" stroke-width="3" fill="none" opacity=".5"/></g>
  <g filter="url(#ds2)"><path d="M20,26L108,52L107,56L19,30Z" fill="url(#stick)"/><path d="M26,14L110,44L108,48L24,18Z" fill="url(#stick)"/><path d="M20,26L34,30L33,34L19,30ZM26,14L40,19L38,23L24,18Z" fill="#B81D1D"/></g>`;

D.V = () => `<linearGradient id="ivory" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFDF4"/><stop offset="1" stop-color="#E4DCC4"/></linearGradient>
  ${halo('#3E9A6A', .45)}
  <g transform="rotate(-8 64 64)" filter="url(#ds)">
  <rect x="30" y="18" width="72" height="96" rx="12" fill="url(#jade)"/><rect x="26" y="12" width="72" height="96" rx="12" fill="url(#ivory)" stroke="#BFB38E" stroke-width="1"/>
  <rect x="32" y="18" width="60" height="84" rx="8" fill="none" stroke="#D8CCA6" stroke-width="1"/>
  <rect x="38" y="46" width="48" height="24" rx="3" fill="none" stroke="#C4151C" stroke-width="6.5"/><path d="M62,28V92" stroke="#C4151C" stroke-width="7" stroke-linecap="round"/>
  <rect x="26" y="12" width="72" height="40" rx="12" fill="#fff" opacity=".35"/></g>
  ${sparkle(100, 22, 6)}`;

const DL = { A: ['ruby', '#E1544B'], K: ['jade', '#1FA565'], Q: ['lapis', '#3B6FE0'], J: ['goldOr', '#F59E0B'] };
for (const [k, [g, c]] of Object.entries(DL)) D[k] = () => letter(k, g, c, `<g opacity=".5" fill="none" stroke="#F5C04E" stroke-width="2" stroke-linecap="round"><path d="M14,104c0,-8 10,-9 12,-3c2,-10 16,-10 18,0M84,104c0,-8 10,-9 12,-3c2,-10 16,-10 18,0"/></g>`);

const EXTRA = `<linearGradient id="amethyst" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D8B4FE"/><stop offset=".5" stop-color="#8B5CF6"/><stop offset="1" stop-color="#3B1A7A"/></linearGradient>
<linearGradient id="goldOr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE08A"/><stop offset=".5" stop-color="#F59E0B"/><stop offset="1" stop-color="#8A4A05"/></linearGradient>
<linearGradient id="shadeV" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient>
<linearGradient id="body" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE79A"/><stop offset=".5" stop-color="#D99A23"/><stop offset="1" stop-color="#8A5208"/></linearGradient>`;

let total = 0;
for (const [theme, set] of [['pharaon', P], ['dragon', D]]) {
  for (const [k, fn] of Object.entries(set)) {
    K.setSeed(k.charCodeAt(0) * 7);
    total += writeSvg(path.join(OUT, theme, k + '.svg'), DEFS + EXTRA, fn(), SZ, SZ);
  }
}
console.log('symbols written:', (total / 1024).toFixed(0) + ' KB total');
