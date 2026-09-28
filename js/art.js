'use strict';
/* ============ Illustrations partagées (vignettes, médailles, décors de pages) ============ */
const COVER_PNG=new Set(['pharaon']);
const COVER_EXT={atlantide:'webp'};
const COVER=id=>COVER_EXT[id]?`assets/covers/${id}.${COVER_EXT[id]}`:COVER_PNG.has(id)?`assets/covers/${id}.png`:`assets/covers/${id}.svg`;
const SYM=n=>`assets/slots-symbols/${n}.png`;

const GOLD_DEFS=p=>`<linearGradient id="${p}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF3BF"/><stop offset=".3" stop-color="#F0C75E"/><stop offset=".6" stop-color="#B8841E"/><stop offset=".8" stop-color="#E9BE55"/><stop offset="1" stop-color="#7A4E08"/></linearGradient><radialGradient id="${p}r" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#FFF7D0"/><stop offset=".35" stop-color="#F1C95B"/><stop offset=".75" stop-color="#B07A17"/><stop offset="1" stop-color="#6E4506"/></radialGradient>`;

/* Emblème du Palace : médaillon doré, couronne et monogramme */
const LOGO=(s=34)=>`<svg width="${s}" height="${s}" viewBox="0 0 48 48" aria-hidden="true"><defs>${GOLD_DEFS('lo'+s)}<radialGradient id="lo${s}d" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#1D2233"/><stop offset="1" stop-color="#07080C"/></radialGradient></defs>
<circle cx="24" cy="24" r="23" fill="url(#lo${s}g)"/><circle cx="24" cy="24" r="19.2" fill="url(#lo${s}d)"/><circle cx="24" cy="24" r="17.4" fill="none" stroke="url(#lo${s}g)" stroke-width=".8" stroke-dasharray="1.2 1.6" opacity=".8"/>
<path d="M16.5 15.2 15.8 11l3.4 2.2L24 8.6l4.8 4.6 3.4-2.2-.7 4.2z" fill="url(#lo${s}g)"/>
<path d="M24 16.4 31.2 34h-3.9l-1.5-3.9h-3.6L20.7 34h-3.9zm0 6.1-1.3 4.3h2.6z" fill="url(#lo${s}g)"/></svg>`;

/* Médaille de palier VIP */
const TIER=[['#F3C9A0','#CD7F32','#6B3A12'],['#FFFFFF','#C0C7D1','#5E6675'],['#FFF3BF','#E2B13F','#7A4E08'],['#F0FFFE','#A5E4E0','#3D7A77'],['#EAF8FF','#7DD3FC','#1E5A86'],['#FFF7D0','#F5D76E','#8C5A0A']];
function medal(i,s=64){const [a,b,c]=TIER[Math.min(i,TIER.length-1)];const id='md'+i+'_'+s;
  const stars=Math.min(i+1,5);
  return `<svg width="${s}" height="${s}" viewBox="0 0 64 64" aria-hidden="true" class="medal"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".45" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient><linearGradient id="${id}b" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${c}"/><stop offset=".5" stop-color="${b}"/><stop offset="1" stop-color="${a}"/></linearGradient></defs>
  <path d="M20 40 13 60l8-4 5 7 5-20zM44 40l7 20-8-4-5 7-5-20z" fill="${i===5?'#B3261E':'#1E3C8F'}" opacity=".95"/>
  <path d="M32 3l6.6 4 7.6-.8 3.1 7 6.6 3.8-1.6 7.5 3.1 7-5.1 5.7-.8 7.6-7.3 2.3-4.6 6.1-7-3.1-7 3.1-4.6-6.1-7.3-2.3-.8-7.6-5.1-5.7 3.1-7-1.6-7.5 6.6-3.8 3.1-7 7.6.8z" fill="url(#${id})" transform="translate(0 -2) scale(1) " />
  <circle cx="32" cy="29" r="16.5" fill="url(#${id}b)"/><circle cx="32" cy="29" r="13.5" fill="none" stroke="${a}" stroke-width="1" opacity=".7"/>
  ${Array.from({length:stars},(_,k)=>{const x=32+(k-(stars-1)/2)*6.4;return `<path transform="translate(${x} ${stars>3&&k%2?31:29}) scale(.9)" d="M0-4.2 1.2-1.3 4.3-1.2 1.9.8 2.7 3.8 0 2.1-2.7 3.8-1.9.8-4.3-1.2-1.2-1.3z" fill="${c}"/>`}).join('')}
  <path d="M19 22a14 14 0 0 1 13-7" stroke="#fff" stroke-width="2" fill="none" opacity=".5" stroke-linecap="round"/></svg>`}

/* Trophée pour le classement */
const TROPHY=(s=120)=>`<svg width="${s}" height="${s}" viewBox="0 0 120 120" aria-hidden="true"><defs>${GOLD_DEFS('tr')}</defs>
<ellipse cx="60" cy="112" rx="34" ry="5" fill="#000" opacity=".45"/>
<path d="M30 18h60v14c0 22-12 38-30 40-18-2-30-18-30-40z" fill="url(#trg)"/>
<path d="M30 24H16c0 16 8 26 20 28M90 24h14c0 16-8 26-20 28" stroke="url(#trg)" stroke-width="6" fill="none"/>
<path d="M52 72h16v14H52z" fill="url(#trg)"/><path d="M38 86h44l4 18H34z" fill="url(#trg)"/><rect x="44" y="92" width="32" height="7" rx="2" fill="#6E4506" opacity=".5"/>
<path d="M60 30l4.4 9 9.9 1.4-7.2 7 1.7 9.8L60 52.5l-8.8 4.7 1.7-9.8-7.2-7 9.9-1.4z" fill="#FFF7D0" opacity=".9"/>
<path d="M38 22c0 16 4 30 12 38" stroke="#fff" stroke-width="3" fill="none" opacity=".45" stroke-linecap="round"/></svg>`;

/* Coffre / cadeau pour les promotions */
const GIFT=(s=130)=>`<svg width="${s}" height="${s}" viewBox="0 0 130 130" aria-hidden="true"><defs>${GOLD_DEFS('gf')}<linearGradient id="gfb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E23B5A"/><stop offset="1" stop-color="#7A0B22"/></linearGradient></defs>
<ellipse cx="65" cy="120" rx="46" ry="6" fill="#000" opacity=".45"/>
<rect x="22" y="58" width="86" height="60" rx="6" fill="url(#gfb)"/><rect x="16" y="44" width="98" height="20" rx="5" fill="url(#gfb)"/>
<rect x="57" y="44" width="16" height="74" fill="url(#gfg)"/><rect x="16" y="64" width="98" height="5" fill="#000" opacity=".2"/>
<path d="M65 44c-6-18-30-26-32-12-2 10 18 12 32 12zM65 44c6-18 30-26 32-12 2 10-18 12-32 12z" fill="url(#gfg)" stroke="#7A4E08" stroke-width="1.2"/>
<circle cx="65" cy="44" r="6" fill="url(#gfr)"/>
${[[22,28,9],[106,22,7],[112,78,6],[14,92,7]].map(([x,y,r])=>`<g><ellipse cx="${x}" cy="${y+2}" rx="${r}" ry="${r*.9}" fill="#7A4E08"/><ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r*.9}" fill="url(#gfr)"/><path d="M${x} ${y-r*.45}l${r*.3} ${r*.45}-${r*.3} ${r*.45}-${r*.3}-${r*.45}z" fill="#9A6410"/></g>`).join('')}
<path d="M28 60v50" stroke="#fff" stroke-width="3" opacity=".25" stroke-linecap="round"/></svg>`;

/* Bouclier (jeu responsable / équité) */
const SHIELD=(s=120,glyph='check')=>`<svg width="${s}" height="${s}" viewBox="0 0 120 120" aria-hidden="true"><defs>${GOLD_DEFS('sh')}<linearGradient id="shb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1E2A4A"/><stop offset="1" stop-color="#0A0F1E"/></linearGradient></defs>
<ellipse cx="60" cy="114" rx="30" ry="4" fill="#000" opacity=".45"/>
<path d="M60 6 100 20v34c0 26-17 45-40 56C37 99 20 80 20 54V20z" fill="url(#shg)"/><path d="M60 14 92 25.5v28.5c0 21-13.5 37-32 46.5C41.5 91 28 75 28 54V25.5z" fill="url(#shb)"/>
${glyph==='check'?'<path d="m43 58 12 12 24-26" stroke="url(#shg)" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>':'<path d="M60 36v44M42 44h36M42 44l-8 18h16zM78 44l-8 18h16z" stroke="url(#shg)" stroke-width="4" fill="none" stroke-linejoin="round"/><path d="M34 62a8 5 0 0 0 16 0M70 62a8 5 0 0 0 16 0M50 82h20" stroke="url(#shg)" stroke-width="4" fill="none" stroke-linecap="round"/>'}
<path d="M34 26v26c0 14 6 26 16 34" stroke="#fff" stroke-width="2.5" fill="none" opacity=".3" stroke-linecap="round"/></svg>`;

/* Fan de trois vignettes (héros, catégories, en-têtes) */
const fan=(ids,cls='')=>`<div class="fan ${cls}">${ids.map((id,i)=>`<img src="${COVER(id)}" alt="" class="fan-${i}" decoding="async" width="300" height="400">`).join('')}</div>`;

/* Bandeau d'en-tête de page */
function pageHead({kicker,title,sub,art,accent='#D4AF37'}){
  return `<header class="phd" style="--ac:${accent}"><div class="phd-bg"></div><div class="phd-c">${kicker?`<span class="kick">${kicker}</span>`:''}<h1 class="ph">${title}</h1>${sub?`<p class="psub">${sub}</p>`:''}</div>${art?`<div class="phd-art">${art}</div>`:''}</header>`;
}

/* Compteur de jackpot à rouleaux */
const fmtJ=v=>r2(v).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2});
function odoHTML(v){return fmtJ(v).split('').map(ch=>/\d/.test(ch)?`<span class="od"><span class="od-s" style="transform:translateY(-${+ch*10}%)">${'0123456789'.split('').join('<br>')}</span></span>`:`<span class="od-sep">${ch===' '||ch===' '||ch===' '?'&nbsp;':ch}</span>`).join('')}
function paintOdo(el){const v=fmtJ(S.jackpot);const digits=el.querySelectorAll('.od-s');const n=(v.match(/\d/g)||[]).length;
  if(digits.length!==n){el.innerHTML=odoHTML(S.jackpot);return}
  let k=0;for(const ch of v){if(/\d/.test(ch)){digits[k].style.transform=`translateY(-${+ch*10}%)`;k++}}}
const ACCENT={atlantide:'#22D3EE',pharaon:'#F29A2E',fruit:'#FF4FD8',dragon:'#FF5A2A',roulette:'#22C58B',blackjack:'#22C58B',baccarat:'#E11D48',videopoker:'#3B82F6',holdem:'#22C58B',crash:'#FF7A45',mines:'#22C58B',plinko:'#EC4899',dice:'#3B82F6',limbo:'#A855F7',hilo:'#F5D76E',keno:'#A855F7',wheel:'#F59E0B',eclair:'#FF5A1F'};
