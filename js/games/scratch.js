'use strict';
/* ============ Cartes à gratter ============ */
const SCRATCH_THEMES=[
 {id:'gold',name:'Trésor Doré',syms:['💰','💎','7️⃣','👑','⭐','🔔','🍇','🟡','🎖️','🍒','🔶','🥉']},
 {id:'fruit',name:'Verger Chanceux',syms:['🍉','🍓','🍍','🍑','🍇','🍊','🍋','🍏','🍒','🫐','🍈','🥝']},
 {id:'egypt',name:'Pyramide d’Or',syms:['👑','𓁹','⚱️','🐫','🏺','🦂','🐍','🌙','☀️','⭐','🪨','🧿']}];
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
    function reset(){grid=[];sg.innerHTML='';for(let i=0;i<9;i++){const idx=pickIdx();grid.push(idx);sg.appendChild(h(`<div class="sc-cell">${theme.syms[idx]}</div>`))}scratched=new Set();sizeCv();active=false;scfoot.textContent='Achète une carte pour commencer';}
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
      if(win>0){give(win);snd(win/bet>=15?'big':'win');scfoot.textContent=`3× ${theme.syms[winIdx]} — Gagné ◈ ${fmt(win)} !`}else{snd('lose');scfoot.textContent='Pas de combinaison — Perdu'}
      msg.textContent=win>0?`Gagné ◈ ${fmt(win)}`:'Perdu, retente ta chance';msg.className='msg '+(win>0?'w':'l');
      record('scratch',bet,win,winIdx!=null?`3× ${theme.syms[winIdx]}`:'');
      go.disabled=false;bc.lock(false);
    }
    go.addEventListener('click',()=>{
      const b=bc.get();if(!canBet(b))return;bet=b;take(bet);go.disabled=true;bc.lock(true);rngStart();
      reset();active=true;msg.textContent='\u00A0';msg.className='msg';scfoot.textContent='Gratte les 9 cases avec la souris ou le doigt';snd('click');
    });
    return()=>{ro.disconnect()};
  },
  rules:()=>`<h4>Cartes à Gratter</h4><p>Achète une carte à 3 thèmes, gratte les 9 cases pour révéler les symboles. Trois symboles identiques ou plus rapportent un gain : les symboles rares (en haut de la table) sont bien plus difficiles à obtenir et paient donc bien plus que les symboles communs.</p>
  <p class="mu2" style="font-size:12px">RTP théorique ≈ 90 %. Environ 6 cartes sur 10 rapportent un gain, la plupart du temps modeste.</p>`});

