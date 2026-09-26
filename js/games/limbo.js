'use strict';
/* ============ Limbo ============ */
reg({id:'limbo',name:'Limbo',cat:'originals',rtp:'96 %',vol:'Haute',badge:null,pop:48,
  bg:'radial-gradient(circle at 50% 30%,#2a0a3a,#0d0212)',glyph:'📉',
  init(stage){
    stage.innerHTML=`<div class="cr-stage" style="height:220px"><div class="cr-m" id="cm">1.00×</div></div>
    <div class="ctrl wide">
      <div class="field">Multiplicateur cible<div class="inp" style="margin-top:6px"><input id="target" type="text" inputmode="decimal" value="2,10"></div>
      <div class="stats" style="margin-top:10px"><div class="st"><b id="chance">45,71 %</b><span>Chance de gagner</span></div></div></div>
      <div><div class="ctrl-row" id="betrow"></div><button class="btn btn-gold btn-big" id="go" style="margin-top:10px">Lancer</button></div>
    </div><div class="msg" id="msg">&nbsp;</div>`;
    const bc=betCtl('limbo',50);$('#betrow',stage).appendChild(bc.el);
    const cm=$('#cm',stage),tin=$('#target',stage),chance=$('#chance',stage),go=$('#go',stage),msg=$('#msg',stage);
    function tv(){return Math.max(2,parseNum(tin.value)||2.1)}
    function paint(){const t=tv();chance.textContent=(96/t).toFixed(2).replace('.',',')+' %'}
    tin.addEventListener('change',()=>{tin.value=tv().toFixed(2).replace('.',',');paint()});paint();
    go.addEventListener('click',async()=>{
      const bet=bc.get();if(!canBet(bet))return;const t=tv();take(bet);go.disabled=true;bc.lock(true);
      rngStart();const result=crashDist();
      let n=0;const iv=setInterval(()=>{cm.textContent=(1+Math.random()*(t+2)).toFixed(2)+'×';snd('tick')},60);
      await sleep(700);clearInterval(iv);
      cm.textContent=result.toFixed(2).replace('.',',')+'×';
      const win_=result>=t;const win=win_?r2(bet*t):0;
      cm.className='cr-m '+(win_?'ok':'boom');
      if(win>0){give(win);snd(t>=10?'big':'win')}else snd('lose');
      msg.textContent=win_?`Sorti à ${result.toFixed(2)}× — Gagné ◈ ${fmt(win)}`:`Sorti à ${result.toFixed(2)}× — Perdu`;msg.className='msg '+(win_?'w':'l');
      record('limbo',bet,win,`Cible ${t.toFixed(2)}× · sorti ${result.toFixed(2)}×`);
      go.disabled=false;bc.lock(false);
    });
    return()=>{};
  },
  rules:()=>`<h4>Limbo</h4><p>Fixe un multiplicateur cible (2,00× minimum, pour une chance de gain toujours inférieure à 50 %, comme sur les tables d’un vrai casino). Un multiplicateur aléatoire est tiré : s’il est égal ou supérieur à ta cible, tu remportes ta mise multipliée par la cible.</p>
  <p class="mu2" style="font-size:12px">RTP théorique 96 %. Plus la cible est haute, plus la chance de gain est faible.</p>`});

