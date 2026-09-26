'use strict';
/* ============ Hi-Lo ============ */
reg({id:'hilo',name:'Hi-Lo',cat:'originals',rtp:'94 %',vol:'Moyenne',badge:null,pop:44,
  bg:'radial-gradient(circle at 50% 30%,#1c2a3a,#080e15)',glyph:`<div class="gc-hero2">${cardEl({r:'7',s:'♦'})}${cardEl({r:'Q',s:'♠'})}</div>`,
  init(stage){
    stage.innerHTML=`<div class="orig-stage" style="--orig-accent:#F5D76E"><div class="orig-glow"></div>
    <div class="hl-row" id="row"></div>
    <div class="chain" id="chain"></div>
    <div class="msg" id="msg">Mise, puis choisis Plus haut ou Plus bas.</div>
    <div class="ctrl wide">
      <div class="ctrl-row" id="betrow"></div>
      <div class="ctrl-row" id="acts"></div>
    </div>
    <div class="stats" style="margin-top:12px"><div class="st"><b id="mult">1,00×</b><span>Multiplicateur cumulé</span></div><div class="st"><b id="pot">◈ 0</b><span>Gain potentiel</span></div></div></div>`;
    const bc=betCtl('hilo',50);$('#betrow',stage).appendChild(bc.el);
    const row=$('#row',stage),chain=$('#chain',stage),msg=$('#msg',stage),acts=$('#acts',stage),multE=$('#mult',stage),potE=$('#pot',stage);
    const RV={A:14,K:13,Q:12,J:11,'10':10,9:9,8:8,7:7,6:6,5:5,4:4,3:3,2:2};
    let shoe=[],cur=null,mult=1,bet=0,phase='idle',history=[];
    function chanceHi(c){const v=RV[c.r];const higher=shoe.filter(x=>RV[x.r]>v).length;return higher/shoe.length}
    function paintRow(){row.innerHTML=cardEl(cur)+`<div style="font-size:28px" class="mu">→</div>`+`<div class="card back"></div>`}
    function paintChain(){chain.innerHTML=history.map(c=>cardEl(c,{cls:''})).join('')}
    function setActs(list){acts.innerHTML=list.map(([id,l,cls])=>`<button class="btn ${cls||'btn-ghost'}" data-a="${id}" style="flex:1">${l}</button>`).join('');$$('button',acts).forEach(b=>b.addEventListener('click',()=>go(b.dataset.a)))}
    function start(){
      const b=bc.get();if(!canBet(b))return;bet=b;take(bet);bc.lock(true);
      shoe=deck(4);cur=shoe.pop();mult=1;history=[cur];phase='play';
      paintRow();paintChain();multE.textContent='1,00×';potE.textContent='◈ '+fmt(bet);
      msg.textContent='Plus haut ou plus bas que le '+(RFR[cur.r]||cur.r)+' '+cur.s+' ?';msg.className='msg';
      setActs([['hi','Plus haut ▲'],['lo','Plus bas ▼'],['cash','Encaisser','btn-green']]);
      $$('[data-a="cash"]',acts)[0].disabled=true;
    }
    function go(a){
      if(a==='new'){start();return}
      if(a==='cash'){const win=r2(bet*mult);give(win);snd('win');msg.textContent=`Encaissé — Gagné ◈ ${fmt(win)}`;msg.className='msg w';record('hilo',bet,win,`Encaissé après ${history.length-1} cartes, ${fmtM(mult)}`);end();return}
      rngStart();const next=shoe[shoe.length-1-randInt(Math.min(shoe.length,1))];// tire vraiment via pop aléatoire
      const idx=randInt(shoe.length);const nx=shoe.splice(idx,1)[0];
      const vOld=RV[cur.r],vNew=RV[nx.r];
      const win_=a==='hi'?vNew>vOld:vNew<vOld;const tie=vNew===vOld;
      history.push(nx);cur=nx;paintChain();
      if(tie){msg.textContent=`Égalité (${RFR[nx.r]||nx.r}) — la partie continue sans changement`;msg.className='msg';paintRow();snd('click');return}
      if(win_){
        const p=a==='hi'?1-(shoe.length? (shoe.filter(x=>RV[x.r]>vOld).length)/(shoe.length+1):.5):(shoe.filter(x=>RV[x.r]<vOld).length)/(shoe.length+1);
        mult=r2(mult*Math.max(1.05,0.94/Math.max(0.08,chanceHiPrev)));
        multE.textContent=fmtM(mult);potE.textContent='◈ '+fmt(r2(bet*mult));
        paintRow();snd('gem');msg.textContent='Bien joué ! Continue ou encaisse.';msg.className='msg w';
        $$('[data-a="cash"]',acts)[0].disabled=false;
        chanceHiPrev=chanceHi(cur);
      } else {
        paintRow();snd('lose');msg.textContent=`Perdu — le ${RFR[nx.r]||nx.r} ${nx.s} sort`;msg.className='msg l';
        record('hilo',bet,0,`Perdu après ${history.length-1} cartes`);end();
      }
    }
    let chanceHiPrev=.5;
    function end(){bc.lock(false);setActs([['new','Nouvelle manche','btn-gold']]);phase='idle';}
    setActs([['new','Miser','btn-gold']]);
    return()=>{};
  },
  rules:()=>`<h4>Hi-Lo</h4><p>Une carte est retournée. Devine si la suivante sera plus haute ou plus basse (l’As compte le plus fort). Chaque bonne réponse augmente ton multiplicateur ; une égalité ne change rien. Encaisse à tout moment.</p>
  <p class="mu2" style="font-size:12px">Le multiplicateur s’ajuste selon les cartes déjà sorties, pour rester proche d’un RTP de 94 %.</p>`});


'use strict';
