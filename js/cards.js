'use strict';
/* ============ Cartes ============ */
const SUITS=['♠','♥','♦','♣'],RANKS=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const RFR={A:'A',J:'V',Q:'D',K:'R'};
function cardEl(c,{hidden=false,delay=0,cls=''}={}){const red=c&&(c.s==='♥'||c.s==='♦');const r=c?(RFR[c.r]||c.r):'';return `<div class="card ${red?'red':''} ${hidden?'back':''} ${cls}" style="animation-delay:${delay}ms"${c&&!hidden?` aria-label="${r} ${c.s}"`:''}><span class="cr">${r}<i>${c?c.s:''}</i></span><span class="cc">${c?c.s:''}</span></div>`}
function deck(n=1){const d=[];for(let k=0;k<n;k++)for(const s of SUITS)for(const r of RANKS)d.push({r,s});return shuffle(d)}
