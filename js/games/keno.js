'use strict';
/* ============ Keno ============ */
const KENO_M={1:[0,3.6],2:[0,1.6,5],3:[0,0,4.7,21],4:[0,0,2.5,7,40],5:[0,0,1.7,3.5,13,96],6:[0,0,0,3.9,11,53,488],7:[0,0,0,2.5,6,22,125,1454],8:[0,0,0,0,6.7,20,87,650,9380],9:[0,0,0,0,4.3,10,38,217,2098,9326],10:[0,0,0,0,2.9,6.4,20,91,666,8885,9353]};
reg({id:'keno',name:'Keno',cat:'instant',rtp:'90 %',vol:'Réglable',badge:null,pop:66,
  bg:'radial-gradient(circle at 50% 30%,#1c0a3a,#080212)',glyph:ic('grid',64),
  init(stage){
    stage.innerHTML=`<div class="kgrid" id="grid"></div>
    <div class="ctrl-row" style="margin-top:12px"><button class="btn btn-ghost btn-sm" id="clear">Effacer</button><button class="btn btn-ghost btn-sm" id="quick">10 au hasard</button><span class="mu" style="align-self:center;margin-left:auto;font-size:13px">Choisis 1 à 10 numéros</span></div>
    <div class="kpay" id="kpay"></div>
    <div class="msg" id="msg">&nbsp;</div>
    <div class="ctrl"><div class="ctrl-row" id="betrow"></div><button class="btn btn-gold btn-big" id="go">Tirer</button></div>`;
    const bc=betCtl('keno',50);$('#betrow',stage).appendChild(bc.el);
    const grid=$('#grid',stage),msg=$('#msg',stage),go=$('#go',stage),kpay=$('#kpay',stage);
    let picked=new Set();
    grid.innerHTML=Array.from({length:40},(_,i)=>`<button class="kc" data-n="${i+1}">${i+1}</button>`).join('');
    function paintPay(hits=-1){const k=picked.size||1;const m=KENO_M[Math.max(1,k)];kpay.innerHTML=m.map((v,i)=>`<div class="${i===hits?'hit':''}">${i}<b>${v?v+'×':'—'}</b></div>`).join('')}
    function togglePick(n,btn){if(picked.has(n)){picked.delete(n);btn.classList.remove('pick')}else{if(picked.size>=10){toast('10 numéros maximum','err');return}picked.add(n);btn.classList.add('pick')}snd('click');paintPay()}
    $$('.kc',grid).forEach(b=>b.addEventListener('click',()=>togglePick(+b.dataset.n,b)));
    $('#clear',stage).addEventListener('click',()=>{picked.clear();$$('.kc',grid).forEach(b=>b.classList.remove('pick','draw','hit'));paintPay()});
    $('#quick',stage).addEventListener('click',()=>{picked.clear();$$('.kc',grid).forEach(b=>b.classList.remove('pick'));while(picked.size<10)picked.add(randInt(40)+1);$$('.kc',grid).forEach(b=>{if(picked.has(+b.dataset.n))b.classList.add('pick')});snd('click');paintPay()});
    paintPay();
    go.addEventListener('click',async()=>{
      if(picked.size===0){toast('Choisis au moins un numéro.','err');return}
      const bet=bc.get();if(!canBet(bet))return;take(bet);go.disabled=true;bc.lock(true);
      $$('.kc',grid).forEach(b=>b.classList.remove('draw','hit'));
      rngStart();const pool=Array.from({length:40},(_,i)=>i+1);shuffle(pool);const drawn=pool.slice(0,10);
      let hits=0;
      for(const n of drawn){await sleep(140);const btn=grid.children[n-1];const isHit=picked.has(n);btn.classList.add(isHit?'hit':'draw');snd(isHit?'coin':'tick');if(isHit)hits++}
      const m=(KENO_M[picked.size]||[])[hits]||0;const win=r2(bet*m);
      paintPay(hits);
      if(win>0){give(win);snd(m>=20?'big':'win')}else snd('lose');
      msg.textContent=`${hits} bon${hits>1?'s':''} numéro${hits>1?'s':''} sur ${picked.size} — ${win>0?'Gagné ◈ '+fmt(win):'Perdu'}`;msg.className='msg '+(win>0?'w':'l');
      record('keno',bet,win,`${hits}/${picked.size} numéros`);
      go.disabled=false;bc.lock(false);
    });
    return()=>{};
  },
  rules:()=>`<h4>Keno</h4><p>Choisis de 1 à 10 numéros parmi 40. Dix numéros sont tirés au sort : plus tu en as en commun, plus le gain est élevé. Le barème de paiement dépend du nombre de numéros choisis, affiché sous la grille.</p>
  <p class="mu2" style="font-size:12px">RTP théorique ≈ 90 % quel que soit le nombre de numéros joués.</p>`});

