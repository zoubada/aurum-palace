'use strict';
/* ============ Vidéo Poker — Jacks or Better (9/6) ============ */
const VP_PAY={'Quinte flush royale':[250,500,750,1000,4000],'Quinte flush':[50,100,150,200,250],'Carré':[25,50,75,100,125],'Full':[9,18,27,36,45],'Couleur':[6,12,18,24,30],'Suite':[4,8,12,16,20],'Brelan':[3,6,9,12,15],'Double paire':[2,4,6,8,10],'Paire de Valets ou mieux':[1,2,3,4,5]};
function vpRank(cards){
  const rv={A:14,K:13,Q:12,J:11,'10':10,9:9,8:8,7:7,6:6,5:5,4:4,3:3,2:2};
  const vals=cards.map(c=>rv[c.r]).sort((a,b)=>a-b);const suits=cards.map(c=>c.s);
  const flush=suits.every(s=>s===suits[0]);
  const uniq=[...new Set(vals)];let straight=uniq.length===5&&vals[4]-vals[0]===4;
  const wheel=JSON.stringify(vals)===JSON.stringify([2,3,4,5,14]);if(wheel)straight=true;
  const counts={};vals.forEach(v=>counts[v]=(counts[v]||0)+1);const cs=Object.values(counts).sort((a,b)=>b-a);
  const highVals=wheel?[5,4,3,2,1]:vals;
  if(flush&&straight&&Math.min(...highVals)===10&&!wheel)return'Quinte flush royale';
  if(flush&&straight)return'Quinte flush';
  if(cs[0]===4)return'Carré';
  if(cs[0]===3&&cs[1]===2)return'Full';
  if(flush)return'Couleur';
  if(straight)return'Suite';
  if(cs[0]===3)return'Brelan';
  if(cs[0]===2&&cs[1]===2)return'Double paire';
  if(cs[0]===2){const pairVal=+Object.keys(counts).find(k=>counts[k]===2);if(pairVal>=11)return'Paire de Valets ou mieux'}
  return null;
}
reg({id:'videopoker',name:'Vidéo Poker',cat:'table',rtp:'99,5 %',vol:'Moyenne',badge:null,pop:52,
  bg:'radial-gradient(circle at 50% 30%,#1c1c3a,#08081a)',glyph:'🂡',
  init(stage){
    stage.innerHTML=`<div style="max-width:640px;margin:0 auto"><div class="vp-hand" id="vh"></div></div>
    <div class="msg" id="msg">&nbsp;</div>
    <table class="ptab" id="paytab" style="max-width:640px;margin:0 auto 14px"></table>
    <div class="ctrl"><div class="ctrl-row" id="betrow"></div><button class="btn btn-gold btn-big" id="go"></button></div>`;
    const bc=betCtl('videopoker',25,{label:'Mise par ligne (×5)'});$('#betrow',stage).appendChild(bc.el);
    const vh=$('#vh',stage),msg=$('#msg',stage),go=$('#go',stage);
    const order=Object.keys(VP_PAY);
    function paintPay(highlight){$('#paytab',stage).innerHTML=`<thead><tr><th>Main</th><th>Gain (× mise/ligne)</th></tr></thead><tbody>${order.map(k=>`<tr class="${k===highlight?'hit':''}"><td>${k}</td><td>${VP_PAY[k][0]}×</td></tr>`).join('')}</tbody></table>`}
    paintPay();
    let cards=[],held=[false,false,false,false,false],phase='deal';
    function render(){vh.innerHTML=cards.map((c,i)=>`<div class="card ${c.s==='♥'||c.s==='♦'?'red':''} pick ${held[i]?'held':''}" data-i="${i}"><span class="cr">${(RFR[c.r]||c.r)}<i>${c.s}</i></span><span class="cc">${c.s}</span></div>`).join('');
      $$('.card',vh).forEach(el=>el.addEventListener('click',()=>{if(phase!=='hold')return;const i=+el.dataset.i;held[i]=!held[i];snd('click');render()}))}
    go.addEventListener('click',async()=>{
      if(phase==='deal'){
        const bet=bc.get();if(!canBet(bet))return;take(bet);bc.lock(true);
        cards=deck(1).slice(0,5);held=[false,false,false,false,false];render();snd('card');
        const rk=vpRank(cards);paintPay(rk);
        msg.textContent='Choisis les cartes à garder, puis distribue.';msg.className='msg';
        phase='hold';go.textContent='Tirer les cartes écartées';return;
      }
      const bet=S.bets['videopoker']||25;
      const newCards=cards.map((c,i)=>held[i]?c:null);
      const used=new Set(newCards.filter(Boolean).map(c=>c.r+c.s));
      const fresh=deck(1).filter(c=>!used.has(c.r+c.s));let fi=0;
      for(let i=0;i<5;i++)if(!newCards[i])newCards[i]=fresh[fi++];
      cards=newCards;render();snd('card');
      const rk=vpRank(cards);paintPay(rk);
      const win=rk?r2(VP_PAY[rk][0]*bet):0;
      if(win>0){give(win);snd(win/bet>=15?'big':'win');if(rk==='Quinte flush royale')unlock('royal')}else snd('lose');
      msg.textContent=rk?`${rk} — Gagné ◈ ${fmt(win)}`:'Aucune combinaison — Perdu';msg.className='msg '+(win>0?'w':'l');
      record('videopoker',bet,win,rk||'');
      bc.lock(false);phase='deal';go.textContent='Distribuer';
    });
    go.textContent='Distribuer';
    return()=>{};
  },
  rules:()=>`<h4>Vidéo Poker — Jacks or Better</h4><p>Distribution de 5 cartes. Choisis celles à garder (clique dessus), les autres sont remplacées. Une paire de Valets ou mieux est nécessaire pour gagner.</p><p>Table de paiement 9/6, RTP théorique 99,5 % avec une stratégie optimale.</p>`});


'use strict';
