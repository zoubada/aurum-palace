'use strict';
/* ============ Dice ============ */
reg({id:'dice',name:'Dice',cat:'originals',rtp:'96 %',vol:'Réglable',badge:null,pop:60,
  bg:'radial-gradient(circle at 50% 30%,#0a3a2a,#02120d)',glyph:ic('dice',64),
  init(stage){
    stage.innerHTML=`<div class="orig-stage" style="--orig-accent:#22C58B"><div class="orig-glow"></div>
    <div class="dice-big num" id="res">00,00</div>
    <div class="dice-track"><div class="dmark" id="mark"><span id="markv"></span></div><div class="dice-bar" id="bar"></div><input type="range" id="tgt" min="0" max="100" step="0.01" value="47"></div>
    <div class="dscale"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div>
    <div class="ctrl wide" style="margin-top:18px">
      <div><div class="seg" style="max-width:260px"><button class="on" id="under">Au-dessous</button><button id="over">Au-dessus</button></div>
      <div class="stats" style="margin-top:10px"><div class="st"><b id="chance">47,00 %</b><span>Chance de gagner</span></div><div class="st"><b id="mult">2,04×</b><span>Multiplicateur</span></div></div></div>
      <div><div class="ctrl-row" id="betrow"></div><button class="btn btn-gold btn-big" id="go" style="margin-top:10px">Lancer</button></div>
    </div></div>`;
    const bc=betCtl('dice',50);$('#betrow',stage).appendChild(bc.el);
    const tgt=$('#tgt',stage),bar=$('#bar',stage),res=$('#res',stage),mark=$('#mark',stage),markv=$('#markv',stage);
    const chance=$('#chance',stage),mult=$('#mult',stage),go=$('#go',stage),underB=$('#under',stage),overB=$('#over',stage);
    let mode='under';
    function clamp(){let v=+tgt.value;if(mode==='under')v=Math.min(47,Math.max(2,v));else v=Math.max(53,Math.min(98,v));tgt.value=v;return v}
    function paintBar(){const v=clamp();const pct=mode==='under'?v:100-v;bar.style.background=mode==='under'?`linear-gradient(90deg,var(--win) ${v}%,var(--lose) ${v}%)`:`linear-gradient(90deg,var(--lose) ${v}%,var(--win) ${v}%)`;
      const c=pct/100;chance.textContent=pct.toFixed(2).replace('.',',')+' %';mult.textContent=r2(0.96/c).toFixed(2).replace('.',',')+'×'}
    tgt.addEventListener('input',paintBar);
    underB.addEventListener('click',()=>{mode='under';if(+tgt.value>47)tgt.value=47;underB.classList.add('on');overB.classList.remove('on');paintBar()});
    overB.addEventListener('click',()=>{mode='over';if(+tgt.value<53)tgt.value=53;overB.classList.add('on');underB.classList.remove('on');paintBar()});
    paintBar();
    go.addEventListener('click',async()=>{
      const bet=bc.get();if(!canBet(bet))return;take(bet);go.disabled=true;bc.lock(true);
      rngStart();const roll=r2(rand()*100);
      let n=0;const iv=setInterval(()=>{res.textContent=(Math.random()*100).toFixed(2).replace('.',',');snd('tick')},55);
      await sleep(750);clearInterval(iv);
      res.textContent=roll.toFixed(2).replace('.',',');
      mark.style.left=roll+'%';mark.classList.add('show');markv.textContent=roll.toFixed(2).replace('.',',');
      const v=clamp();const win_=mode==='under'?roll<v:roll>v;
      const pct=(mode==='under'?v:100-v)/100;const m=r2(0.96/pct);
      const win=win_?r2(bet*m):0;
      if(win>0){give(win);snd(m>=10?'big':'win')}else snd('lose');
      res.className='num '+(win_?'pos':'neg');
      record('dice',bet,win,`Cible ${mode==='under'?'< ':'> '}${v} · résultat ${roll.toFixed(2)}`);
      go.disabled=false;bc.lock(false);
    });
    return()=>{};
  },
  rules:()=>`<h4>Dice</h4><p>Un nombre entre 0 et 100 est tiré. Choisis s’il doit sortir <b>au-dessous</b> ou <b>au-dessus</b> de ta cible en déplaçant le curseur : plus la zone gagnante est petite, plus le multiplicateur est élevé. La chance de gain est toujours inférieure à 50 %, comme sur les tables d’un vrai casino.</p>
  <p class="mu2" style="font-size:12px">Multiplicateur = 0,96 ÷ probabilité de gain. RTP théorique 96 %, marge de la maison 4 %.</p>`});

