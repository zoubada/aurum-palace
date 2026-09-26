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

function slotMachine(cfg){
  return function init(stage){
    const cols=cfg.cols,rows=cfg.rows;
    const totalW=cfg.syms.reduce((a,s)=>a+s.w,0);
    const payMap=Object.fromEntries(cfg.syms.filter(s=>s.p).map(s=>[s.k,s.p]));
    stage.innerHTML=`
      <div class="slot-marquee gtext">${cfg.title}</div>
      <div class="slot-wrap"><div class="fsb" id="fsb" style="display:none"></div>
      <div class="slot ${cfg.skin||''}" style="--cols:${cols};--rows:${rows}" id="reels"></div></div>
      <div class="msg" id="msg" aria-live="polite">&nbsp;</div>
      <div class="ctrl">
        <div class="ctrl-row" id="betrow"></div>
        <div class="ctrl-row"><button class="btn btn-ghost" id="auto" style="flex:1">Auto ×10</button><button class="btn btn-gold btn-big" id="spin" style="flex:2">Lancer</button></div>
      </div>`;
    const reelsEl=$('#reels',stage);
    for(let c=0;c<cols;c++){const r=h(`<div class="reel"></div>`);for(let k=0;k<rows;k++)r.appendChild(h(`<div class="cell"></div>`));reelsEl.appendChild(r)}
    const bc=betCtl(cfg.id,cfg.def,{});$('#betrow',stage).appendChild(bc.el);
    const spinBtn=$('#spin',stage),autoBtn=$('#auto',stage),msg=$('#msg',stage),fsb=$('#fsb',stage);
    const cellHTML=s=>/^[0-9A-Z]{1,2}$/.test(s.g)?`<span class="ltb" data-r="${s.k}"><i>${s.g}</i></span>`:`<span class="sy">${s.g}</span>`;
    // grille de repos affichée avant le premier lancement
    const restGrid=()=>Array.from({length:cols},()=>Array.from({length:rows},()=>pickW(cfg.syms)));
    const paint=(grid,winCells=[])=>{for(let c=0;c<cols;c++){const cells=reelsEl.children[c].children;for(let r=0;r<rows;r++){const s=grid[c][r];cells[r].innerHTML=cellHTML(s);cells[r].classList.remove('dim');cells[r].classList.toggle('w',winCells.some(w=>w[0]===c&&w[1]===r))}}
      if(winCells.length)for(let c=0;c<cols;c++)for(let r=0;r<rows;r++)if(!winCells.some(w=>w[0]===c&&w[1]===r))reelsEl.children[c].children[r].classList.add('dim')};
    paint(restGrid());
    let freeSpins=0,fsTotal=0,fsWin=0,busy=false,auto=0;
    const setFS=()=>{fsb.style.display=freeSpins>0?'':'none';fsb.textContent=freeSpins>0?`TOURS GRATUITS — ${fsTotal-freeSpins+1} / ${fsTotal}`:''};

    async function spinOnce(){
      const bet=freeSpins>0?0:bc.get();
      if(freeSpins===0&&!canBet(bet))return false;
      busy=true;spinBtn.disabled=true;autoBtn.disabled=true;bc.lock(true);msg.textContent='\u00A0';msg.className='msg';
      if(freeSpins===0){take(bet);freeSpins===0&&0}
      $$('.reel',reelsEl).forEach(r=>{r.classList.add('spin');r.classList.remove('stop');$$('.cell',r).forEach(c=>c.classList.remove('w','dim'))});
      rngStart();
      const grid=[];for(let c=0;c<cols;c++){const col=[];for(let r=0;r<rows;r++)col.push(pickW(cfg.syms));grid.push(col)}
      snd('click');
      for(let c=0;c<cols;c++){
        await sleep(220+c*160);
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
      busy=false;spinBtn.disabled=false;autoBtn.disabled=false;bc.lock(false);
      return true;
    }
    let fsBetRef=0;
    spinBtn.addEventListener('click',async()=>{if(busy)return;await spinOnce()});
    autoBtn.addEventListener('click',async()=>{if(busy)return;if(auto>0){auto=0;autoBtn.textContent='Auto ×10';return}auto=10;autoBtn.textContent='Arrêter';while(auto>0&&!busy){auto--;const ok=await spinOnce();if(!ok){auto=0;break}await sleep(280)}autoBtn.textContent='Auto ×10'});
    return()=>{auto=0};
  };
}

function slotRules(cfg){
  return()=>`<h4>${cfg.title}</h4><p>${cfg.desc}</p>
  <p>${cfg.cols} rouleaux × ${cfg.rows} lignes, ${cfg.lines.length} ligne${cfg.lines.length>1?'s':''} de paiement. Les combinaisons se comptent depuis le rouleau le plus à gauche.</p>
  ${cfg.freeSpins?`<p><b>Symbole Wild</b> : remplace tous les symboles sauf le Scatter. <b>Symbole Scatter</b> : ${cfg.freeSpins.need} symboles ou plus, n’importe où sur la grille, déclenchent ${cfg.freeSpins.count} tours gratuits.</p>`:''}
  ${cfg.jackpot?`<p><b>Jackpot progressif</b> : 5 symboles Couronne sur une ligne remportent le Jackpot Aurum affiché dans le lobby.</p>`:''}
  <table class="ptab"><thead><tr><th>Symbole</th><th>3</th><th>4</th><th>5</th></tr></thead><tbody>
  ${cfg.syms.filter(s=>s.p).map(s=>`<tr><td>${s.wild?'<b class="gold">'+s.k+'</b>':s.g} ${s.name}</td><td>${s.p[3]||'—'}×</td><td>${s.p[4]||'—'}×</td><td>${s.p[5]||'—'}×</td></tr>`).join('')}
  </tbody></table><p class="mu2" style="font-size:12px">Multiplicateurs appliqués à la mise totale, divisés sur le nombre de lignes actives (comme dans une vraie machine à sous). RTP théorique ${cfg.id==='pharaon'?'≈ 94 %':cfg.id==='fruit'?'≈ 92 %':'≈ 94 %'} sur un grand nombre de tours.</p>`;
}

reg({id:'pharaon',name:'Pharaon d’Or',cat:'slots',rtp:'94 %',vol:'Haute',badge:'jp',pop:98,
  bg:'radial-gradient(circle at 50% 30%,#4a3208,#1c1305)',glyph:'👑',
  init:slotMachine({id:'pharaon',title:'Pharaon d’Or',def:100,cols:5,rows:3,lines:LINES20,
    scatterPay:{3:2,4:10,5:49},freeSpins:{need:3,count:10,retrigger:5},jackpot:{sym:'W',reset:50000},
    syms:[
      {k:'W',g:'👑',w:2,wild:true,name:'Wild (Couronne)',p:{3:195,4:782,5:3910}},
      {k:'S',g:'☀️',w:2,name:'Scatter (Soleil)'},
      {k:'E',g:'𓁹',w:3,name:'Œil d’Horus',p:{3:117,4:489,5:2444}},
      {k:'N',g:'🐫',w:4,name:'Chameau',p:{3:78,4:323,5:1173}},
      {k:'B',g:'🏺',w:5,name:'Vase',p:{3:64,4:195,5:782}},
      {k:'V',g:'🐍',w:6,name:'Cobra',p:{3:39,4:117,5:489}},
      {k:'A',g:'A',w:8,name:'A',p:{3:24,4:78,5:323}},
      {k:'K',g:'K',w:9,name:'K',p:{3:24,4:64,5:244}},
      {k:'Q',g:'Q',w:10,name:'Q',p:{3:16,4:49,5:195}},
      {k:'J',g:'J',w:11,name:'J',p:{3:16,4:39,5:156}},
      {k:'T',g:'10',w:12,name:'10',p:{3:8,4:32,5:117}},
    ]}),
  rules:slotRules({id:'pharaon',title:'Pharaon d’Or',desc:'5 rouleaux, 20 lignes, dans les sables de l’Égypte ancienne.',cols:5,rows:3,lines:LINES20,freeSpins:{need:3,count:10},jackpot:{sym:'W'},
    syms:[{k:'W',g:'👑',wild:true,name:'Wild',p:{3:195,4:782,5:3910}},{k:'S',g:'☀️',name:'Scatter'},{k:'E',g:'𓁹',name:'Œil d’Horus',p:{3:117,4:489,5:2444}},{k:'N',g:'🐫',name:'Chameau',p:{3:78,4:323,5:1173}},{k:'B',g:'🏺',name:'Vase',p:{3:64,4:195,5:782}},{k:'V',g:'🐍',name:'Cobra',p:{3:39,4:117,5:489}},{k:'A',g:'A',name:'A',p:{3:24,4:78,5:323}},{k:'K',g:'K',name:'K',p:{3:24,4:64,5:244}},{k:'Q',g:'Q',name:'Q',p:{3:16,4:49,5:195}},{k:'J',g:'J',name:'J',p:{3:16,4:39,5:156}},{k:'T',g:'10',name:'10',p:{3:8,4:32,5:117}}]})});

reg({id:'fruit',name:'Fruit Classic',cat:'slots',rtp:'92 %',vol:'Moyenne',badge:null,pop:70,
  bg:'radial-gradient(circle at 50% 30%,#3a0a30,#12030f)',glyph:'🍒',
  init:slotMachine({id:'fruit',title:'Fruit Classic',def:50,cols:3,rows:3,lines:LINES5,skin:'fruit',
    syms:[
      {k:'7',g:'7️⃣',w:2,name:'7 chanceux',p:{3:636}},
      {k:'R',g:'🔔',w:3,name:'Cloche',p:{3:255}},
      {k:'X',g:'⭐',w:4,name:'Étoile',p:{3:128}},
      {k:'L',g:'🍋',w:5,name:'Citron',p:{3:80}},
      {k:'G',g:'🍇',w:6,name:'Raisin',p:{3:48}},
      {k:'O',g:'🍊',w:7,name:'Orange',p:{3:32}},
      {k:'M',g:'🍉',w:8,name:'Pastèque',p:{3:25}},
      {k:'C',g:'🍒',w:9,name:'Cerise',p:{3:19}},
    ]}),
  rules:slotRules({id:'fruit',title:'Fruit Classic',desc:'Le grand classique rétro à néons, 3 rouleaux et 5 lignes.',cols:3,rows:3,lines:LINES5,
    syms:[{k:'7',g:'7️⃣',name:'7',p:{3:636}},{k:'R',g:'🔔',name:'Cloche',p:{3:255}},{k:'X',g:'⭐',name:'Étoile',p:{3:128}},{k:'L',g:'🍋',name:'Citron',p:{3:80}},{k:'G',g:'🍇',name:'Raisin',p:{3:48}},{k:'O',g:'🍊',name:'Orange',p:{3:32}},{k:'M',g:'🍉',name:'Pastèque',p:{3:25}},{k:'C',g:'🍒',name:'Cerise',p:{3:19}}]})});

reg({id:'dragon',name:'Dragon Fortune',cat:'slots',rtp:'94 %',vol:'Haute',badge:'new',pop:64,
  bg:'radial-gradient(circle at 50% 30%,#3a0808,#150202)',glyph:'🐉',
  init:slotMachine({id:'dragon',title:'Dragon Fortune',def:80,cols:5,rows:4,
    lines:(()=>{const L=[];for(let r=0;r<4;r++)L.push([r,r,r,r,r]);
      L.push([0,1,2,1,0],[3,2,1,2,3],[1,2,3,2,1],[2,1,0,1,2],[0,1,1,1,0],[3,2,2,2,3],[1,1,2,1,1],[2,2,1,2,2],[0,0,1,0,0],[3,3,2,3,3],[1,2,2,2,1],[2,1,1,1,2],[0,1,2,3,3],[3,2,1,0,0],[0,2,0,2,0]);return L})(),
    scatterPay:{3:1,4:5,5:18},freeSpins:{need:3,count:10,retrigger:5},
    syms:[
      {k:'W',g:'🐉',w:2,wild:true,name:'Wild (Dragon)',p:{3:76,4:304,5:1518}},
      {k:'S',g:'💠',w:3,name:'Scatter (Perle)'},
      {k:'E',g:'⛩️',w:4,name:'Temple',p:{3:30,4:121,5:607}},
      {k:'N',g:'🏮',w:5,name:'Lanterne',p:{3:18,4:67,5:273}},
      {k:'B',g:'🥢',w:6,name:'Baguettes',p:{3:12,4:42,5:167}},
      {k:'V',g:'🀄',w:6,name:'Mahjong',p:{3:11,4:33,5:137}},
      {k:'A',g:'A',w:9,name:'A',p:{3:6,4:21,5:85}},
      {k:'K',g:'K',w:10,name:'K',p:{3:5,4:17,5:67}},
      {k:'Q',g:'Q',w:11,name:'Q',p:{3:4,4:14,5:55}},
      {k:'J',g:'J',w:12,name:'J',p:{3:4,4:11,5:42}},
    ]}),
  rules:slotRules({id:'dragon',title:'Dragon Fortune',desc:'5 rouleaux, 4 rangées, 15 lignes, dans un temple oriental.',cols:5,rows:4,lines:[[0,0,0,0,0]],freeSpins:{need:3,count:10},
    syms:[{k:'W',g:'🐉',wild:true,name:'Wild',p:{3:76,4:304,5:1518}},{k:'S',g:'💠',name:'Scatter'},{k:'E',g:'⛩️',name:'Temple',p:{3:30,4:121,5:607}},{k:'N',g:'🏮',name:'Lanterne',p:{3:18,4:67,5:273}},{k:'B',g:'🥢',name:'Baguettes',p:{3:12,4:42,5:167}},{k:'V',g:'🀄',name:'Mahjong',p:{3:11,4:33,5:137}},{k:'A',g:'A',name:'A',p:{3:6,4:21,5:85}},{k:'K',g:'K',name:'K',p:{3:5,4:17,5:67}},{k:'Q',g:'Q',name:'Q',p:{3:4,4:14,5:55}},{k:'J',g:'J',name:'J',p:{3:4,4:11,5:42}}]})});

