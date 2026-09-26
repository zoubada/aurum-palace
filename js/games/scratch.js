'use strict';
/* ============ Cartes à gratter ============
   Les symboles réutilisent le même système de badge SVG que les
   machines à sous (symBadge, défini dans slots.js) au lieu d'emojis
   bruts, avec une palette propre à chaque thème de carte. */
const SCRATCH_THEMES=[
 {id:'gold',name:'Trésor Doré',syms:[
   {k:'bag',n:'Sac d’or',c1:'#E3B23C',c2:'#7A5C0E',ic:'<path d="M9 3h6l2 4c2 1 3 3 3 6a8 8 0 0 1-16 0c0-3 1-5 3-6z"/><path d="M9 3c1 2 1 3 3 3s2-1 3-3"/>'},
   {k:'gem',n:'Diamant',c1:'#5EEAD4',c2:'#0F6E64',ic:'<path d="M6 3h12l3 6-9 12L3 9z"/><path d="M3 9h18M9 3 6 9l6 12 6-12-3-6M9 3h6"/>'},
   {k:'7',n:'7',c1:'#FF6B6B',c2:'#8B0F1E',ic:null,g:'7'},
   {k:'crown',n:'Couronne',c1:'#F5D76E',c2:'#8B6508',ic:'<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>'},
   {k:'star',n:'Étoile',c1:'#FFE28A',c2:'#C9982A',ic:'<path d="m12 3 2.8 5.8 6.2.9-4.5 4.4 1 6.3L12 17.5 6.5 20.4l1-6.3L3 9.7l6.2-.9z"/>'},
   {k:'bell',n:'Cloche',c1:'#FFD54A',c2:'#B4650A',ic:'<path d="M12 3.2a5 5 0 0 0-5 5V11c0 1.2-.8 2.2-1.8 3h13.6c-1-.8-1.8-1.8-1.8-3V8.2a5 5 0 0 0-5-5z"/><path d="M9.3 19a2.7 2.7 0 0 0 5.4 0"/>'},
   {k:'grape',n:'Raisin',c1:'#9B6FD8',c2:'#402270',ic:'<circle cx="9.2" cy="10.4" r="2.1"/><circle cx="14" cy="10.4" r="2.1"/><circle cx="7" cy="14.6" r="2.1"/><circle cx="11.6" cy="14.6" r="2.1"/><circle cx="16.4" cy="14.6" r="2.1"/><circle cx="9.7" cy="18.6" r="2.1"/><circle cx="14.3" cy="18.6" r="2.1"/><path d="M11.8 9.5V4.4M11.8 4.4c1.2-1.3 3.2-1.3 4-.2"/>'},
   {k:'coin',n:'Pièce',c1:'#F0C674',c2:'#8A5A17',ic:'<circle cx="12" cy="12" r="7.5"/><path d="M12 8l3 4-3 4-3-4z"/>'},
   {k:'medal',n:'Médaille',c1:'#F0C674',c2:'#8A5A17',ic:'<path d="M9 10 7 3h3l2 5M15 10l2-7h-3l-2 5"/><circle cx="12" cy="15" r="5"/><path d="m10 15 1.5 1.5L15 13"/>'},
   {k:'cherry',n:'Cerise',c1:'#FF6B7A',c2:'#8C0F22',ic:'<circle cx="8.6" cy="17.3" r="2.9"/><circle cx="15.6" cy="17.3" r="2.9"/><path d="M8.6 14.6C8.6 8.6 11.6 6.4 14.6 4.4M15.6 14.6c0-2.8.9-4.8 2.8-5.9" fill="none"/>'},
   {k:'diamond',n:'Losange',c1:'#FF9D6B',c2:'#8A3A0A',ic:'<path d="M12 3 20 12 12 21 4 12z"/>'},
   {k:'bronze',n:'Bronze',c1:'#CD7F32',c2:'#5C3512',ic:'<path d="M9 10 7 3h3l2 5M15 10l2-7h-3l-2 5"/><circle cx="12" cy="15" r="5"/><path d="m10 15 1.5 1.5L15 13"/>'},
 ]},
 {id:'fruit',name:'Verger Chanceux',syms:[
   {k:'watermelon',n:'Pastèque',c1:'#6FD87F',c2:'#1E7A34',ic:'<path d="M3 15.5a9 9 0 0 1 18 0z"/><path d="M6.2 15.5a5.8 5.8 0 0 1 11.6 0"/><circle cx="9.6" cy="13.4" r=".6"/><circle cx="14.4" cy="13.4" r=".6"/><circle cx="12" cy="11" r=".6"/>'},
   {k:'strawberry',n:'Fraise',c1:'#FF6B7A',c2:'#8C0F22',ic:'<path d="M12 8c4 0 6 3 6 7a6 6 0 0 1-12 0c0-4 2-7 6-7z"/><path d="M9 6l1 2M12 5v3M15 6l-1 2"/><circle cx="9.5" cy="12" r=".5" fill="currentColor"/><circle cx="14.5" cy="12" r=".5" fill="currentColor"/><circle cx="12" cy="15" r=".5" fill="currentColor"/>'},
   {k:'pineapple',n:'Ananas',c1:'#FFD54A',c2:'#B4650A',ic:'<path d="M9 9c-2 1-3 3-3 6a6 5 0 0 0 12 0c0-3-1-5-3-6"/><path d="M12 9V4M9 6l3-2 3 2"/><path d="M9 11h6M8.5 14h7"/>'},
   {k:'peach',n:'Pêche',c1:'#FFB27A',c2:'#A2500A',ic:'<path d="M12 9a6 6 0 1 1 0 12 6 6 0 0 1 0-12z"/><path d="M12 9c0-2 1-3 2-4"/><path d="M12 9v6" opacity=".5"/>'},
   {k:'grape',n:'Raisin',c1:'#9B6FD8',c2:'#402270',ic:'<circle cx="9.2" cy="10.4" r="2.1"/><circle cx="14" cy="10.4" r="2.1"/><circle cx="7" cy="14.6" r="2.1"/><circle cx="11.6" cy="14.6" r="2.1"/><circle cx="16.4" cy="14.6" r="2.1"/><circle cx="9.7" cy="18.6" r="2.1"/><circle cx="14.3" cy="18.6" r="2.1"/><path d="M11.8 9.5V4.4M11.8 4.4c1.2-1.3 3.2-1.3 4-.2"/>'},
   {k:'orange',n:'Orange',c1:'#FF9D4D',c2:'#A4490A',ic:'<circle cx="12" cy="13.2" r="6.9"/><path d="M12 6.3V4M12 4c1.1-.9 2.7-.9 3.2.5"/>'},
   {k:'lemon',n:'Citron',c1:'#F4E04D',c2:'#8C7A0E',ic:'<ellipse cx="12" cy="13" rx="6.6" ry="7.6"/><path d="M12.5 5.3c.8-1.7 2.6-2.6 3.7-2"/>'},
   {k:'apple',n:'Pomme',c1:'#8FDD6B',c2:'#2E7A1E',ic:'<path d="M12 8c3.5 0 6 2.8 6 6.2A5.8 5.8 0 0 1 12.2 20 5.8 5.8 0 0 1 6 14.2C6 10.8 8.5 8 12 8z"/><path d="M12 8V5M12 5c1-1.3 2.6-1.3 3 0"/>'},
   {k:'cherry',n:'Cerise',c1:'#FF6B7A',c2:'#8C0F22',ic:'<circle cx="8.6" cy="17.3" r="2.9"/><circle cx="15.6" cy="17.3" r="2.9"/><path d="M8.6 14.6C8.6 8.6 11.6 6.4 14.6 4.4M15.6 14.6c0-2.8.9-4.8 2.8-5.9" fill="none"/>'},
   {k:'blueberry',n:'Myrtille',c1:'#6B8FDD',c2:'#1E3A7A',ic:'<circle cx="9" cy="10" r="2.6"/><circle cx="15" cy="10" r="2.6"/><circle cx="12" cy="15" r="2.6"/><path d="M9 7.5c.3-.8 1-.8 1.2 0M15 7.5c.3-.8 1-.8 1.2 0M12 12.5c.3-.8 1-.8 1.2 0"/>'},
   {k:'melon',n:'Melon',c1:'#D9E85A',c2:'#7A8A1E',ic:'<path d="M3 15.5a9 9 0 0 1 18 0z"/><path d="M12 6.5v9M7.5 8l3 7.5M16.5 8l-3 7.5"/>'},
   {k:'kiwi',n:'Kiwi',c1:'#7ACB5A',c2:'#2E5A1E',ic:'<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/><circle cx="12" cy="9" r=".5" fill="currentColor"/><circle cx="9" cy="12" r=".5" fill="currentColor"/><circle cx="15" cy="12" r=".5" fill="currentColor"/><circle cx="12" cy="15" r=".5" fill="currentColor"/>'},
 ]},
 {id:'egypt',name:'Pyramide d’Or',syms:[
   {k:'crown',n:'Couronne',c1:'#F5D76E',c2:'#8B6508',ic:'<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>'},
   {k:'eye',n:'Œil d’Horus',c1:'#2E8FB0',c2:'#0F2F40',ic:'<path d="M2.5 12S6.5 7 12 7s9.5 5 9.5 5-4 5-9.5 5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.6"/><path d="M12 14.6v3.4M9.5 17l-1.2 2"/>'},
   {k:'urn',n:'Vase canope',c1:'#4FAE8A',c2:'#0F4A38',ic:'<path d="M9.5 3h5M10.5 3v2.6c0 1.3-2 2.4-2 5.4v7a2 2 0 0 0 2 2h3a2 2 0 0 0 2-2v-7c0-3-2-4.1-2-5.4V3"/>'},
   {k:'camel',n:'Chameau',c1:'#C79A5C',c2:'#5C3E17',ic:'<path d="M2 18c1.6-.8 2.4-3.2 4-3.2s1.6 2.4 3.2 2.4 1-4 2.8-4 1.8 3.4 3.6 3.4 1.4-1.6 2.8-1.6" fill="none"/><path d="M2 20.5h20"/>'},
   {k:'vase',n:'Amphore',c1:'#3EAE9A',c2:'#0F4A44',ic:'<path d="M8 4h8M9 4v3c0 2 3 2 3 5s3 3 3 5v3H6v-3c0-2 3-2 3-5s-3-3-3-5V4"/>'},
   {k:'scorpion',n:'Scorpion',c1:'#B25A3C',c2:'#4A1F12',ic:'<path d="M3 13c2 2 4 2 6 0s4-2 6 0 3 1 4-1" fill="none"/><path d="M19 12c1-1 1-3 2-3" fill="none"/><circle cx="21" cy="8" r="1.3"/><circle cx="3" cy="13" r="1"/>'},
   {k:'cobra',n:'Cobra',c1:'#5FAE4F',c2:'#1B4A15',ic:'<path d="M6 20c0-5.5 2.6-5.8 2.6-9.2S6.8 4.6 8.8 3.6s3.8 1.8 2.8 4.6 2.6 3.8 2.6 7.4"/><circle cx="13.4" cy="6" r="1.3"/>'},
   {k:'moon',n:'Lune',c1:'#8FA8D9',c2:'#2A3A6A',ic:'<path d="M15 3a9 9 0 1 0 6 15.5A9 9 0 0 1 15 3z"/>'},
   {k:'sun',n:'Soleil',c1:'#FFD98A',c2:'#C97A1A',ic:'<circle cx="12" cy="12" r="4.2"/><path d="M12 3v2.4M12 18.6V21M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M3 12h2.4M18.6 12H21M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7"/>'},
   {k:'star',n:'Étoile',c1:'#FFE28A',c2:'#C9982A',ic:'<path d="m12 3 2.8 5.8 6.2.9-4.5 4.4 1 6.3L12 17.5 6.5 20.4l1-6.3L3 9.7l6.2-.9z"/>'},
   {k:'rock',n:'Pierre',c1:'#8A8578',c2:'#3A362C',ic:'<path d="M4 17c0-3 2-5 4-6 1-2 3-3 5-3 3 0 5 2 6 4 2 1 3 3 3 5H4z"/>'},
   {k:'nazar',n:'Œil protecteur',c1:'#2E6EA8',c2:'#0F2A44',ic:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="2"/>'},
 ]},
];
const SCRATCH_W=[1,2,3,4,6,8,10,12,14,16,16,16];
const SCRATCH_PAYT=[53.4,26.7,17.8,11.1,6.7,4,2.7,1.8,1.3,0.9,0.9,0.7];
reg({id:'scratch',name:'Cartes à Gratter',cat:'instant',rtp:'90 %',vol:'Faible',badge:null,pop:38,
  bg:'radial-gradient(circle at 50% 30%,#3a3008,#121002)',glyph:ic('ticket',64),
  init(stage){
    let theme=SCRATCH_THEMES[0];
    stage.innerHTML=`<div class="chips" id="themes" style="margin-bottom:14px">${SCRATCH_THEMES.map((t,i)=>`<button class="chip ${i?'':'on'}" data-t="${t.id}">${t.name}</button>`).join('')}</div>
    <div class="sc-card"><h3 id="sctitle">${theme.name}</h3><div class="sc-area"><div class="sc-grid" id="sg"></div><canvas id="sc"></canvas></div><div class="sc-foot" id="scfoot">Gratte les 9 cases — 3 symboles identiques gagnent</div></div>
    <div class="msg" id="msg">&nbsp;</div>
    <div class="ctrl"><div class="ctrl-row" id="betrow"></div><button class="btn btn-gold btn-big" id="go">Acheter une carte</button></div>`;
    const bc=betCtl('scratch',50,{label:'Prix de la carte'});$('#betrow',stage).appendChild(bc.el);
    const sg=$('#sg',stage),cv=$('#sc',stage),ctx=cv.getContext('2d'),go=$('#go',stage),msg=$('#msg',stage),scfoot=$('#scfoot',stage),sctitle=$('#sctitle',stage);
    $$('#themes .chip',stage).forEach(c=>c.addEventListener('click',()=>{theme=SCRATCH_THEMES.find(t=>t.id===c.dataset.t);sctitle.textContent=theme.name;$$('#themes .chip',stage).forEach(x=>x.classList.toggle('on',x===c));reset()}));
    let grid=[],scratched=new Set(),bet=0,active=false,drawing=false;
    function pickIdx(){const tot=SCRATCH_W.reduce((a,w)=>a+w,0);let r=rand()*tot;for(let i=0;i<SCRATCH_W.length;i++){r-=SCRATCH_W[i];if(r<0)return i}return SCRATCH_W.length-1}
    function sizeCv(){const r=sg.getBoundingClientRect();const d=devicePixelRatio||1;cv.width=r.width*d;cv.height=r.height*d;cv.style.width=r.width+'px';cv.style.height=r.height+'px';ctx.setTransform(d,0,0,d,0,0);coverAll(r.width,r.height)}
    function coverAll(w,hh){ctx.clearRect(0,0,w,hh);const g=ctx.createLinearGradient(0,0,w,hh);g.addColorStop(0,'#C9C9D4');g.addColorStop(1,'#9EA0AE');ctx.fillStyle=g;ctx.fillRect(0,0,w,hh);ctx.fillStyle='rgba(255,255,255,.5)';ctx.font='bold 13px Inter';for(let i=0;i<18;i++)ctx.fillText('◈',Math.random()*w,Math.random()*hh)}
    function reset(){grid=[];sg.innerHTML='';for(let i=0;i<9;i++){const idx=pickIdx();grid.push(idx);sg.appendChild(h(`<div class="sc-cell">${symBadge(theme.syms[idx])}</div>`))}scratched=new Set();sizeCv();active=false;scfoot.textContent='Achète une carte pour commencer';}
    const ro=new ResizeObserver(sizeCv);ro.observe(cv);
    reset();
    function cellAt(x,y){const r=sg.getBoundingClientRect();const cw=r.width/3,ch=r.height/3;const cx=Math.min(2,Math.max(0,Math.floor(x/cw))),cy=Math.min(2,Math.max(0,Math.floor(y/ch)));return cy*3+cx}
    function scratchAt(clientX,clientY){const r=cv.getBoundingClientRect();const x=clientX-r.left,y=clientY-r.top;ctx.globalCompositeOperation='destination-out';ctx.beginPath();ctx.arc(x,y,22,0,6.283);ctx.fill();ctx.globalCompositeOperation='source-over';
      const idx=cellAt(x,y);if(!scratched.has(idx)){scratched.add(idx);sg.children[idx].classList.add('w');if(scratched.size===9)finish()}}
    function pos(e){if(e.touches)return[e.touches[0].clientX,e.touches[0].clientY];return[e.clientX,e.clientY]}
    cv.addEventListener('pointerdown',e=>{if(!active)return;drawing=true;const[x,y]=pos(e);scratchAt(x,y)});
    cv.addEventListener('pointermove',e=>{if(!active||!drawing)return;const[x,y]=pos(e);scratchAt(x,y)});
    addEventListener('pointerup',()=>drawing=false);
    function finish(){
      active=false;const counts={};grid.forEach(s=>counts[s]=(counts[s]||0)+1);
      let win=0,winIdx=null;for(const[s,c] of Object.entries(counts))if(c>=3&&SCRATCH_PAYT[s]*bet>win){win=SCRATCH_PAYT[s]*bet;winIdx=+s}
      win=r2(win);
      if(win>0){give(win);snd(win/bet>=15?'big':'win');scfoot.innerHTML=`3× ${theme.syms[winIdx].n} — Gagné ◈ ${fmt(win)} !`}else{snd('lose');scfoot.textContent='Pas de combinaison — Perdu'}
      msg.textContent=win>0?`Gagné ◈ ${fmt(win)}`:'Perdu, retente ta chance';msg.className='msg '+(win>0?'w':'l');
      record('scratch',bet,win,winIdx!=null?`3× ${theme.syms[winIdx].n}`:'');
      go.disabled=false;bc.lock(false);
    }
    go.addEventListener('click',()=>{
      const b=bc.get();if(!canBet(b))return;bet=b;take(bet);go.disabled=true;bc.lock(true);rngStart();
      reset();active=true;msg.textContent=' ';msg.className='msg';scfoot.textContent='Gratte les 9 cases avec la souris ou le doigt';snd('click');
    });
    return()=>{ro.disconnect()};
  },
  rules:()=>`<h4>Cartes à Gratter</h4><p>Achète une carte à 3 thèmes, gratte les 9 cases pour révéler les symboles. Trois symboles identiques ou plus rapportent un gain : les symboles rares (en haut de la table) sont bien plus difficiles à obtenir et paient donc bien plus que les symboles communs.</p>
  <p class="mu2" style="font-size:12px">RTP théorique ≈ 90 %. Environ 6 cartes sur 10 rapportent un gain, la plupart du temps modeste.</p>`});
