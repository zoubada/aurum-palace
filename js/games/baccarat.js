'use strict';
/* ============ Baccarat ============ */
function bacVal(hand){let v=0;for(const c of hand){v+=c.r==='A'?1:['K','Q','J'].includes(c.r)?0:+c.r}return v%10}
reg({id:'baccarat',name:'Baccarat',cat:'table',rtp:'98,9 %',vol:'Faible',badge:null,pop:58,
  bg:'radial-gradient(circle at 50% 30%,#3a1c08,#150a02)',glyph:cardEl({r:'K',s:'♦'},{cls:'gc-hero'}),
  init(stage){
    stage.innerHTML=`<div class="bj-banner" id="banner"><span class="bj-ic">${ic('cards',18)}</span><span class="bj-tx">Choisis ta zone puis distribue</span></div>
    <div class="felt"><div class="zone"><div class="zl">Banquier <span class="val" id="bv"></span></div><div class="hand" id="bh2"></div></div>
    <div class="felt-mid">Commission de 5 % sur le Banquier · Égalité payée 8:1</div>
    <div class="zone"><div class="zl">Joueur <span class="val" id="pv2"></span></div><div class="hand" id="ph2"></div></div></div>
    <div class="msg" id="msg">&nbsp;</div>
    <div class="bzones" id="bz"></div>
    <div class="ctrl"><div class="ctrl-row" id="betrow"></div><button class="btn btn-gold btn-big" id="deal">Distribuer</button></div>
    <div class="bead" id="bead" style="margin-top:12px"></div>`;
    const bc=betCtl('baccarat',100);$('#betrow',stage).appendChild(bc.el);
    const banner=$('#banner',stage);const setBanner=(icon,text,tone='')=>{banner.className='bj-banner '+tone;banner.innerHTML=`<span class="bj-ic">${ic(icon,18)}</span><span class="bj-tx">${text}</span>`};
    $('#bz',stage).innerHTML=`<button class="bz" data-z="player"><b>Joueur</b><span>Paie 1:1</span></button><button class="bz" data-z="tie"><b>Égalité</b><span>Paie 8:1</span></button><button class="bz" data-z="banker"><b>Banquier</b><span>Paie 0,95:1</span></button>`;
    const zoneLbl={player:'Joueur',banker:'Banquier',tie:'Égalité'};
    let zone='player';$$('.bz',stage).forEach(b=>b.addEventListener('click',()=>{zone=b.dataset.z;snd('click');$$('.bz',stage).forEach(x=>x.classList.toggle('hit',x===b));setBanner('cards',`Mise sur ${zoneLbl[zone]} — distribue`)}));$$('.bz',stage)[0].classList.add('hit');
    const bhEl=$('#bh2',stage),phEl=$('#ph2',stage),bvEl=$('#bv',stage),pvEl=$('#pv2',stage),msg=$('#msg',stage),dealBtn=$('#deal',stage);
    function paintBead(){$('#bead',stage).innerHTML=S.bh.slice(0,42).map(r=>`<i class="${r}">${r}</i>`).join('')}
    paintBead();
    let shoe=[];
    dealBtn.addEventListener('click',async()=>{
      const bet=bc.get();if(!canBet(bet))return;take(bet);bc.lock(true);dealBtn.disabled=true;msg.textContent='\u00A0';msg.className='msg';
      if(shoe.length<12)shoe=deck(8);
      let p=[shoe.pop(),shoe.pop()],b=[shoe.pop(),shoe.pop()];
      bhEl.innerHTML='';phEl.innerHTML='';
      for(let i=0;i<2;i++){phEl.innerHTML+=cardEl(p[i],{delay:i*120});await sleep(140);snd('card');bhEl.innerHTML+=cardEl(b[i],{delay:0});await sleep(140);snd('card')}
      pvEl.textContent=bacVal(p);bvEl.textContent=bacVal(b);
      let pv=bacVal(p),bv=bacVal(b);
      if(pv<8&&bv<8){
        let pc=null;
        if(pv<=5){pc=shoe.pop();p.push(pc);phEl.innerHTML+=cardEl(pc,{delay:0});await sleep(200);snd('card');pv=bacVal(p);pvEl.textContent=pv}
        const pcv=pc?(pc.r==='A'?1:['K','Q','J'].includes(pc.r)?0:+pc.r):null;
        let bankerDraws=false;
        if(pc===null)bankerDraws=bv<=5;
        else{
          if(bv<=2)bankerDraws=true;
          else if(bv===3)bankerDraws=pcv!==8;
          else if(bv===4)bankerDraws=[2,3,4,5,6,7].includes(pcv);
          else if(bv===5)bankerDraws=[4,5,6,7].includes(pcv);
          else if(bv===6)bankerDraws=[6,7].includes(pcv);
        }
        if(bankerDraws){const bc2=shoe.pop();b.push(bc2);bhEl.innerHTML+=cardEl(bc2,{delay:0});await sleep(200);snd('card');bv=bacVal(b);bvEl.textContent=bv}
      }
      const res=pv>bv?'player':bv>pv?'banker':'tie';S.bh.unshift(res[0].toUpperCase());if(S.bh.length>200)S.bh.length=200;paintBead();
      let win=0;
      if(zone===res){if(res==='player')win=bet*2;else if(res==='banker')win=r2(bet*1.95);else win=bet*9}
      else if(res==='tie'&&zone!=='tie')win=bet; // égalité rembourse les mises Joueur/Banquier
      win=r2(win);
      if(win>0){give(win);snd(win/bet>=5?'big':'win')}else snd('lose');
      msg.textContent=`${res==='tie'?'Égalité':res==='player'?'Le Joueur gagne':'Le Banquier gagne'} (${pv} - ${bv})${win>0?` — Gagné ◈ ${fmt(win)}`:res!=='tie'||zone==='tie'?' — Perdu':' — Mise remboursée'}`;
      msg.className='msg '+(win>0?'w':res==='tie'&&zone!=='tie'?'':'l');
      setBanner(win>0?'star':'cards',msg.textContent,win>0?'win':res==='tie'&&zone!=='tie'?'':'lose');
      record('baccarat',bet,win,`${res==='player'?'Joueur':res==='banker'?'Banquier':'Égalité'} ${pv}-${bv}`);
      bc.lock(false);dealBtn.disabled=false;
    });
    return()=>{};
  },
  rules:()=>`<h4>Baccarat</h4><p>Parie sur la main qui obtiendra un total le plus proche de 9 : Joueur, Banquier ou Égalité. Les figures et 10 valent 0, l’As vaut 1.</p>
  <p>Une troisième carte est tirée automatiquement selon les règles officielles du baccarat, sans aucune décision à prendre.</p>
  <table class="ptab"><tbody><tr><td>Pari Joueur gagnant</td><td>1 pour 1</td></tr><tr><td>Pari Banquier gagnant</td><td>0,95 pour 1 (commission de 5 %)</td></tr><tr><td>Égalité</td><td>8 pour 1</td></tr></tbody></table>`});

