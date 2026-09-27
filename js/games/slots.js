'use strict';
/* ============ Machines à sous — moteur commun ============ */
const LINES20=[[1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],[0,0,1,2,2],[2,2,1,0,0],[1,0,0,0,1],[1,2,2,2,1],[1,0,1,2,1],[1,2,1,0,1],[0,1,0,1,0],[2,1,2,1,2],[0,1,1,1,0],[2,1,1,1,2],[1,1,0,1,1],[1,1,2,1,1],[0,0,2,0,0],[2,2,0,2,2],[0,2,0,2,0]];
const LINES5=[[1,1,1],[0,0,0],[2,2,2],[0,1,2],[2,1,0]];

function evalLine(seq,pays,wildK,scK){
  let wn=0;while(wn<seq.length&&seq[wn]===wildK)wn++;
  let t=null,n=0;for(const s of seq){if(s===scK)break;if(s===wildK){n++;continue}if(t===null){t=s;n++;continue}if(s===t){n++;continue}break}
  let best=0,type=null,count=0;
  if(t&&pays[t]&&pays[t][n]){best=pays[t][n];type=t;count=n}
  if(wn>=3&&pays[wildK]&&pays[wildK][wn]>best){best=pays[wildK][wn];type=wildK;count=wn}
  return{amt:best,type,count};
}

/* ---- Jeux de symboles : chaque thème a sa propre palette et ses propres glyphes
   (SVG trait, cohérents avec le reste de l'iconographie du Palace) plutôt que des
   emojis. Les lettres A/K/Q/J/10 gardent le badge « carte à jouer » déjà utilisé
   ailleurs. Rien dans les poids (w), payables (p) ou drapeaux wild/scatter ne change
   ici : seule la couche visuelle est nouvelle. ---- */
const SYMS_PHARAON=[
  {k:'W',img:'assets/symbols/pharaon/W.png',g:'👑',w:2,wild:true,name:'Wild (Couronne)',p:{3:195,4:782,5:3910},ic:'<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>',c1:'#F5D76E',c2:'#8B6508'},
  {k:'S',img:'assets/symbols/pharaon/S.png',g:'☀️',w:2,name:'Scatter (Soleil)',ic:'<circle cx="12" cy="12" r="4.2"/><path d="M12 3v2.4M12 18.6V21M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M3 12h2.4M18.6 12H21M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7"/>',c1:'#FFD98A',c2:'#C97A1A'},
  {k:'E',img:'assets/symbols/pharaon/E.png',g:'𓁹',w:3,name:'Œil d’Horus',p:{3:117,4:489,5:2444},ic:'<path d="M2.5 12S6.5 7 12 7s9.5 5 9.5 5-4 5-9.5 5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.6"/><path d="M12 14.6v3.4M9.5 17l-1.2 2"/>',c1:'#2E8FB0',c2:'#0F2F40'},
  {k:'N',img:'assets/symbols/pharaon/N.svg',g:'🐫',w:4,name:'Chameau',p:{3:78,4:323,5:1173},ic:'<path d="M2 18c1.6-.8 2.4-3.2 4-3.2s1.6 2.4 3.2 2.4 1-4 2.8-4 1.8 3.4 3.6 3.4 1.4-1.6 2.8-1.6" fill="none"/><path d="M2 20.5h20"/>',c1:'#C79A5C',c2:'#5C3E17'},
  {k:'B',img:'assets/symbols/pharaon/B.svg',g:'🏺',w:5,name:'Vase',p:{3:64,4:195,5:782},ic:'<path d="M9.5 3h5M10.5 3v2.6c0 1.3-2 2.4-2 5.4v7a2 2 0 0 0 2 2h3a2 2 0 0 0 2-2v-7c0-3-2-4.1-2-5.4V3"/>',c1:'#4FAE8A',c2:'#0F4A38'},
  {k:'V',img:'assets/symbols/pharaon/V.svg',g:'🐍',w:6,name:'Cobra',p:{3:39,4:117,5:489},ic:'<path d="M6 20c0-5.5 2.6-5.8 2.6-9.2S6.8 4.6 8.8 3.6s3.8 1.8 2.8 4.6 2.6 3.8 2.6 7.4"/><circle cx="13.4" cy="6" r="1.3"/>',c1:'#5FAE4F',c2:'#1B4A15'},
  {k:'A',img:'assets/symbols/pharaon/A.svg',g:'A',w:8,name:'A',p:{3:24,4:78,5:323}},
  {k:'K',img:'assets/symbols/pharaon/K.svg',g:'K',w:9,name:'K',p:{3:24,4:64,5:244}},
  {k:'Q',img:'assets/symbols/pharaon/Q.svg',g:'Q',w:10,name:'Q',p:{3:16,4:49,5:195}},
  {k:'J',img:'assets/symbols/pharaon/J.svg',g:'J',w:11,name:'J',p:{3:16,4:39,5:156}},
  {k:'T',img:'assets/symbols/pharaon/T.svg',g:'10',w:12,name:'10',p:{3:8,4:32,5:117}},
];
const SYMS_FRUIT=[
  {k:'7',g:'7',w:2,name:'7 chanceux',p:{3:636},img:'assets/slots-symbols/seven.png'},
  {k:'R',g:'🔔',w:3,name:'Cloche',p:{3:255},img:'assets/slots-symbols/bell.png'},
  {k:'X',g:'⭐',w:4,name:'Diamant',p:{3:128},img:'assets/slots-symbols/diamond.png'},
  {k:'L',g:'🍋',w:5,name:'Citron',p:{3:80},img:'assets/slots-symbols/lemon.png'},
  {k:'G',g:'🍇',w:6,name:'Raisin',p:{3:48},img:'assets/slots-symbols/grapefruit.png'},
  {k:'O',g:'🍊',w:7,name:'Orange',p:{3:32},img:'assets/slots-symbols/orange.png'},
  {k:'M',g:'🍉',w:8,name:'Pastèque',p:{3:25},img:'assets/slots-symbols/watermelon.png'},
  {k:'C',g:'🍒',w:9,name:'Cerise',p:{3:19},img:'assets/slots-symbols/cherry.png'},
];
const SYMS_DRAGON=[
  {k:'W',img:'assets/symbols/dragon/W.svg',g:'🐉',w:2,wild:true,name:'Wild (Dragon)',p:{3:76,4:304,5:1518},ic:'<path d="M3 17c1.6-3.6 2-6.6 5.4-7.4S11 13 13.6 12s1.6-4.6 4.6-3.8" fill="none"/><path d="M18.2 8.2l2-2-.8 2.8 2 .8-2.8.7z"/><circle cx="17.6" cy="7.6" r=".7"/>',c1:'#F5D76E',c2:'#8B6508'},
  {k:'S',img:'assets/symbols/dragon/S.svg',g:'💠',w:3,name:'Scatter (Perle)',ic:'<circle cx="12" cy="12" r="6.6"/><path d="M8.7 8.2c1.3-1.2 3.3-1.7 5-1.1" fill="none"/>',c1:'#7FD9D4',c2:'#0E6E68'},
  {k:'E',img:'assets/symbols/dragon/E.svg',g:'⛩️',w:4,name:'Temple',p:{3:30,4:121,5:607},ic:'<path d="M3 8h18M4.6 8l-1.3 2.4M19.4 8l1.3 2.4M3.6 11.8h16.8M8 11.8v9M16 11.8v9"/>',c1:'#E1544B',c2:'#6E1913'},
  {k:'N',img:'assets/symbols/dragon/N.svg',g:'🏮',w:5,name:'Lanterne',p:{3:18,4:67,5:273},ic:'<path d="M9.5 3h5M8 6.4h8a2 2 0 0 1 2 2v7.2a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8.4a2 2 0 0 1 2-2z"/><path d="M12 3v3.4M12 17.6V21M8 10.2h8M8 13.8h8"/>',c1:'#FFB24D',c2:'#A85A06'},
  {k:'B',img:'assets/symbols/dragon/B.svg',g:'🥢',w:6,name:'Baguettes',p:{3:12,4:42,5:167},ic:'<path d="M6.5 20 16 4M10 20.5 19.5 4.5"/>',c1:'#C9A227',c2:'#63500D'},
  {k:'V',img:'assets/symbols/dragon/V.svg',g:'🀄',w:6,name:'Mahjong',p:{3:11,4:33,5:137},ic:'<rect x="5" y="4" width="14" height="16" rx="2.4"/><path d="M8.6 9.8h6.8M8.6 14.2h6.8M12 7.6v8.8"/>',c1:'#3E4A5C',c2:'#141B26'},
  {k:'A',img:'assets/symbols/dragon/A.svg',g:'A',w:9,name:'A',p:{3:6,4:21,5:85}},
  {k:'K',img:'assets/symbols/dragon/K.svg',g:'K',w:10,name:'K',p:{3:5,4:17,5:67}},
  {k:'Q',img:'assets/symbols/dragon/Q.svg',g:'Q',w:11,name:'Q',p:{3:4,4:14,5:55}},
  {k:'J',img:'assets/symbols/dragon/J.svg',g:'J',w:12,name:'J',p:{3:4,4:11,5:42}},
];

const symBadge=(s,mini)=>{
  if(s.img)return `<span class="symbadge photo${mini?' mini':''}"><img src="${s.img}" alt="${s.name}" draggable="false"></span>`;
  if(s.ic)return `<span class="symbadge${s.wild?' wild':''}${mini?' mini':''}" style="--c1:${s.c1};--c2:${s.c2}"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${s.ic}</svg></span>`;
  if(/^[0-9A-Z]{1,2}$/.test(s.g))return `<span class="ltb"${mini?' style="width:28px;display:inline-flex;vertical-align:middle;margin-right:7px"':''} data-r="${s.k}"><i>${s.g}</i></span>`;
  return `<span class="sy">${s.g}</span>`;
};

function slotMachine(cfg){
  return function init(stage){
    const cols=cfg.cols,rows=cfg.rows;
    const totalW=cfg.syms.reduce((a,s)=>a+s.w,0);
    const payMap=Object.fromEntries(cfg.syms.filter(s=>s.p).map(s=>[s.k,s.p]));
    const particles=Array.from({length:14},(_,i)=>`<i style="left:${(i*7+3)%100}%;animation-duration:${5+(i%5)*1.3}s;animation-delay:${(i%7)*-0.7}s"></i>`).join('');
    const orn=ic('sunburst',16);
    stage.innerHTML=`
      <div class="slot-stage${cfg.bgImage?' has-bg':''}" id="slotStage" style="--slot-accent:${cfg.accent||'#D4AF37'}${cfg.bgImage?`;background-image:url(${cfg.bgImage})`:''}">
      <div class="slot-glow"></div><div class="slot-particles">${particles}</div>
      <button class="slot-fsbtn" id="fsToggle" type="button" aria-label="Plein écran"></button>
      <div class="slot-cab">
        ${cfg.logo?`<div class="slot-logo" style="aspect-ratio:${cfg.logo.w}/${cfg.logo.h}"><img src="${cfg.logo.img}" alt=""><h1 style="left:${cfg.logo.l}%;right:${cfg.logo.r}%;top:${cfg.logo.t}%;bottom:${cfg.logo.b}%">${esc(cfg.title)}</h1></div>`:`<div class="slot-banner"><i class="orn">${orn}</i><h1>${esc(cfg.title)}</h1><i class="orn">${orn}</i></div>`}
        <div class="slot-frame">
          ${!cfg.frame?'<div class="slot-pillar l"></div>':''}
          <div class="slot-wrap${cfg.frame?' framed':''}"${cfg.frame?` style="aspect-ratio:${cfg.frame.w}/${cfg.frame.h}"`:''}>
          ${cfg.frame?`<img class="slot-frame-img" src="${cfg.frame.img}" alt="" aria-hidden="true">`:''}
          <div class="fsb" id="fsb" style="display:none"></div>
          <div class="slot ${cfg.skin||''}" style="--cols:${cols};--rows:${rows}${cfg.frame?`;position:absolute;left:${cfg.frame.l}%;right:${cfg.frame.r}%;top:${cfg.frame.t}%;bottom:${cfg.frame.b}%`:''}" id="reels"></div></div>
          ${!cfg.frame?'<div class="slot-pillar r"></div>':''}
        </div>
      </div>
      <div class="msg" id="msg" aria-live="polite">&nbsp;</div>
      <div class="ctrl">
        <div class="ctrl-row" id="betrow"></div>
        <div class="slot-ctrlrow">
          <button class="slot-auto" id="auto" type="button">Auto ×10</button>
          <button class="spin-fab" id="spin" type="button" aria-label="Lancer">${ic('refresh',28)}</button>
          <span style="width:78px" aria-hidden="true"></span>
        </div>
      </div></div>`;
    const slotStage=$('#slotStage',stage);
    const reelsEl=$('#reels',stage);
    for(let c=0;c<cols;c++){const r=h(`<div class="reel"></div>`);for(let k=0;k<rows;k++)r.appendChild(h(`<div class="cell"></div>`));reelsEl.appendChild(r)}
    const bc=betCtl(cfg.id,cfg.def,{});$('#betrow',stage).appendChild(bc.el);
    const spinBtn=$('#spin',stage),autoBtn=$('#auto',stage),msg=$('#msg',stage),fsb=$('#fsb',stage);
    const cellHTML=s=>symBadge(s,false);
    // grille de repos affichée avant le premier lancement
    const restGrid=()=>Array.from({length:cols},()=>Array.from({length:rows},()=>pickW(cfg.syms)));
    const paint=(grid,winCells=[])=>{for(let c=0;c<cols;c++){const cells=reelsEl.children[c].children;for(let r=0;r<rows;r++){const s=grid[c][r];const cell=cells[r];cell.innerHTML=cellHTML(s);cell.classList.remove('dim');const isWin=winCells.some(w=>w[0]===c&&w[1]===r);cell.classList.toggle('w',isWin);cell.style.animationDelay=isWin?(c*70)+'ms':''}}
      if(winCells.length)for(let c=0;c<cols;c++)for(let r=0;r<rows;r++)if(!winCells.some(w=>w[0]===c&&w[1]===r))reelsEl.children[c].children[r].classList.add('dim')};
    paint(restGrid());
    let freeSpins=0,fsTotal=0,fsWin=0,busy=false,auto=0;
    const setFS=()=>{fsb.style.display=freeSpins>0?'':'none';fsb.textContent=freeSpins>0?`TOURS GRATUITS — ${fsTotal-freeSpins+1} / ${fsTotal}`:''};

    /* ---- Plein écran : API native quand disponible, repli CSS position:fixed sinon ---- */
    const fsBtn=$('#fsToggle',stage);
    const paintFs=()=>{const on=document.fullscreenElement===slotStage||slotStage.classList.contains('fs-fake');fsBtn.innerHTML=ic(on?'compress':'expand',18);fsBtn.setAttribute('aria-label',on?'Quitter le plein écran':'Plein écran')};
    const onFsChange=()=>paintFs();
    document.addEventListener('fullscreenchange',onFsChange);
    paintFs();
    fsBtn.addEventListener('click',async()=>{
      snd('click');
      if(document.fullscreenElement===slotStage||slotStage.classList.contains('fs-fake')){
        if(document.fullscreenElement)try{await document.exitFullscreen()}catch(e){}
        slotStage.classList.remove('fs-fake');document.body.classList.remove('fs-lock');paintFs();return;
      }
      if(slotStage.requestFullscreen){try{await slotStage.requestFullscreen();return}catch(e){}}
      slotStage.classList.add('fs-fake');document.body.classList.add('fs-lock');paintFs();
    });

    async function spinOnce(){
      const bet=freeSpins>0?0:bc.get();
      if(freeSpins===0&&!canBet(bet))return false;
      busy=true;spinBtn.disabled=true;autoBtn.disabled=true;spinBtn.classList.add('spinning');bc.lock(true);msg.textContent=' ';msg.className='msg';
      if(freeSpins===0){take(bet);freeSpins===0&&0}
      $$('.reel',reelsEl).forEach(r=>{r.classList.add('spin');r.classList.remove('stop');$$('.cell',r).forEach(c=>c.classList.remove('w','dim'))});
      rngStart();
      const grid=[];for(let c=0;c<cols;c++){const col=[];for(let r=0;r<rows;r++)col.push(pickW(cfg.syms));grid.push(col)}
      snd('click');
      // Anticipation : le tirage est déjà figé (RNG ci-dessus) — on regarde juste si le
      // dernier rouleau s'apprête à compléter une ligne payante, pour ralentir sa chute
      // (pur effet de présentation, aucune influence sur le résultat).
      let anticipateLast=false;
      for(const ln of cfg.lines){
        const partial=ln.slice(0,cols-1).map((row,c)=>grid[c][row].k);
        const res=evalLine(partial,payMap,'W','S');
        if(res.amt>0&&res.count>=cols-1){anticipateLast=true;break}
      }
      for(let c=0;c<cols;c++){
        await sleep(220+c*160);
        const isLast=c===cols-1;
        if(isLast&&anticipateLast){
          const r0=reelsEl.children[c];r0.classList.add('anticip');snd('tick');
          await sleep(680);
          r0.classList.remove('anticip');
        }
        const r=reelsEl.children[c];r.classList.remove('spin');r.classList.add('stop');
        for(let k=0;k<rows;k++)r.children[k].innerHTML=cellHTML(grid[c][k]);
        snd('stop');
      }
      await sleep(140);
      let win=0;const winCells=[];let scatterCount=0;let bestType=null;
      for(const ln of cfg.lines){
        const seq=ln.map((row,c)=>grid[c][row].k);
        const res=evalLine(seq,payMap,'W','S');
        if(res.amt>0){win+=res.amt*bet_unit()/cfg.lines.length;for(let c=0;c<res.count;c++)winCells.push([c,ln[c]]);if(!bestType||res.amt>bestType.amt)bestType=res}
      }
      function bet_unit(){return freeSpins>0?fsBetRef:bet}
      const flat=grid.flat();scatterCount=flat.filter(s=>s.k==='S').length;
      let scWin=0;
      if(cfg.scatterPay&&scatterCount>=3)scWin=cfg.scatterPay[scatterCount]*bet_unit()||0;
      win=r2(win+scWin);
      if(winCells.length)paint(grid,winCells);
      let triggeredFS=false;
      if(cfg.freeSpins&&scatterCount>=cfg.freeSpins.need){
        if(freeSpins===0){freeSpins=cfg.freeSpins.count;fsTotal=cfg.freeSpins.count;fsWin=0;fsBetRef=bet;triggeredFS=true}
        else{freeSpins+=cfg.freeSpins.retrigger||0}
      }
      let jpWin=0;
      if(cfg.jackpot&&bestType&&bestType.count>=cfg.cols&&bestType.type===cfg.jackpot.sym){jpWin=S.jackpot;S.jackpot=cfg.jackpot.reset;unlock('jp')}
      const totalWin=r2(win+jpWin);
      if(freeSpins>0&&!triggeredFS){fsWin=r2(fsWin+totalWin);freeSpins--}
      if(totalWin>0){give(totalWin);snd(totalWin/Math.max(1,bet_unit())>=10?'big':'win')}
      else if(!triggeredFS)snd('lose');
      if(triggeredFS){snd('gem');toast(`${cfg.freeSpins.need} symboles Scatter : ${cfg.freeSpins.count} tours gratuits !`,'win')}
      setFS();
      const label=jpWin?`JACKPOT ◈ ${fmt(jpWin)} !`:totalWin>0?`Gagné ◈ ${fmt(totalWin)}`:triggeredFS?'Tours gratuits déclenchés !':'Perdu, réessaie';
      msg.textContent=label;msg.className='msg '+(totalWin>0||triggeredFS?'w':'l');
      record(cfg.id,bet,totalWin,triggeredFS?'Tours gratuits déclenchés':scatterCount>=3?`${scatterCount} Scatters`:'');
      busy=false;spinBtn.disabled=false;autoBtn.disabled=false;spinBtn.classList.remove('spinning');bc.lock(false);
      return true;
    }
    let fsBetRef=0;
    spinBtn.addEventListener('click',async()=>{if(busy)return;await spinOnce()});
    autoBtn.addEventListener('click',async()=>{if(busy)return;if(auto>0){auto=0;autoBtn.textContent='Auto ×10';autoBtn.classList.remove('on');return}auto=10;autoBtn.textContent='Arrêter';autoBtn.classList.add('on');while(auto>0&&!busy){auto--;const ok=await spinOnce();if(!ok){auto=0;break}await sleep(280)}autoBtn.textContent='Auto ×10';autoBtn.classList.remove('on')});
    return()=>{auto=0;document.removeEventListener('fullscreenchange',onFsChange);if(document.fullscreenElement===slotStage)document.exitFullscreen?.();document.body.classList.remove('fs-lock')};
  };
}

function slotRules(cfg){
  return()=>`<h4>${cfg.title}</h4><p>${cfg.desc}</p>
  <p>${cfg.cols} rouleaux × ${cfg.rows} lignes, ${cfg.lines.length} ligne${cfg.lines.length>1?'s':''} de paiement. Les combinaisons se comptent depuis le rouleau le plus à gauche.</p>
  ${cfg.freeSpins?`<p><b>Symbole Wild</b> : remplace tous les symboles sauf le Scatter. <b>Symbole Scatter</b> : ${cfg.freeSpins.need} symboles ou plus, n’importe où sur la grille, déclenchent ${cfg.freeSpins.count} tours gratuits.</p>`:''}
  ${cfg.jackpot?`<p><b>Jackpot progressif</b> : 5 symboles Couronne sur une ligne remportent le Jackpot Aurum affiché dans le lobby.</p>`:''}
  <table class="ptab"><thead><tr><th>Symbole</th><th>3</th><th>4</th><th>5</th></tr></thead><tbody>
  ${cfg.syms.filter(s=>s.p).map(s=>`<tr><td>${symBadge(s,true)}${s.name}</td><td>${s.p[3]||'—'}×</td><td>${s.p[4]||'—'}×</td><td>${s.p[5]||'—'}×</td></tr>`).join('')}
  </tbody></table><p class="mu2" style="font-size:12px">Multiplicateurs appliqués à la mise totale, divisés sur le nombre de lignes actives (comme dans une vraie machine à sous). RTP théorique ${cfg.id==='pharaon'?'≈ 94 %':cfg.id==='fruit'?'≈ 92 %':'≈ 94 %'} sur un grand nombre de tours.</p>`;
}

reg({id:'pharaon',name:'Pharaon d’Or',cat:'slots',rtp:'94 %',vol:'Haute',badge:'jp',pop:98,
  bg:'radial-gradient(circle at 50% 30%,#4a3208,#1c1305)',glyph:'👑',
  init:slotMachine({id:'pharaon',title:'Pharaon d’Or',def:100,cols:5,rows:3,lines:LINES20,accent:'#E3B23C',
    scatterPay:{3:2,4:10,5:49},freeSpins:{need:3,count:10,retrigger:5},jackpot:{sym:'W',reset:50000},
    bgImage:'assets/backgrounds/pharaon-bg.png',
    frame:{img:'assets/frames/pharaon-frame.png',w:1576,h:998,l:15.86,r:15.93,t:21.14,b:21.44},
    logo:{img:'assets/logos/pharaon-logo.png',w:1576,h:998,l:21.25,r:21.32,t:64.9,b:20.5},
    syms:SYMS_PHARAON}),
  rules:slotRules({id:'pharaon',title:'Pharaon d’Or',desc:'5 rouleaux, 20 lignes, dans les sables de l’Égypte ancienne.',cols:5,rows:3,lines:LINES20,freeSpins:{need:3,count:10},jackpot:{sym:'W'},
    syms:SYMS_PHARAON})});

reg({id:'fruit',name:'Fruit Classic',cat:'slots',rtp:'92 %',vol:'Moyenne',badge:null,pop:70,
  bg:'radial-gradient(circle at 50% 30%,#3a0a30,#12030f)',glyph:'<img src="assets/slots-symbols/cherry.png" alt="Cerise" style="width:clamp(56px,16vw,78px);height:auto;display:block">',
  init:slotMachine({id:'fruit',title:'Fruit Classic',def:50,cols:3,rows:3,lines:LINES5,skin:'fruit',accent:'#D946EF',
    syms:SYMS_FRUIT}),
  rules:slotRules({id:'fruit',title:'Fruit Classic',desc:'Le grand classique rétro à néons, 3 rouleaux et 5 lignes.',cols:3,rows:3,lines:LINES5,
    syms:SYMS_FRUIT})});

reg({id:'dragon',name:'Dragon Fortune',cat:'slots',rtp:'94 %',vol:'Haute',badge:'new',pop:64,
  bg:'radial-gradient(circle at 50% 30%,#3a0808,#150202)',glyph:'🐉',
  init:slotMachine({id:'dragon',title:'Dragon Fortune',def:80,cols:5,rows:4,skin:'dragon',accent:'#E1544B',
    lines:(()=>{const L=[];for(let r=0;r<4;r++)L.push([r,r,r,r,r]);
      L.push([0,1,2,1,0],[3,2,1,2,3],[1,2,3,2,1],[2,1,0,1,2],[0,1,1,1,0],[3,2,2,2,3],[1,1,2,1,1],[2,2,1,2,2],[0,0,1,0,0],[3,3,2,3,3],[1,2,2,2,1],[2,1,1,1,2],[0,1,2,3,3],[3,2,1,0,0],[0,2,0,2,0]);return L})(),
    scatterPay:{3:1,4:5,5:18},freeSpins:{need:3,count:10,retrigger:5},
    syms:SYMS_DRAGON}),
  rules:slotRules({id:'dragon',title:'Dragon Fortune',desc:'5 rouleaux, 4 rangées, 15 lignes, dans un temple oriental.',cols:5,rows:4,lines:[[0,0,0,0,0]],freeSpins:{need:3,count:10},
    syms:SYMS_DRAGON})});
