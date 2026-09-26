'use strict';
/* ============ Casino Hold'em ============ */
const HRANK=['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const HV=Object.fromEntries(HRANK.map((r,i)=>[r,i+2]));
function best5of7(cards){
  const combos=[];const idx=[...Array(7).keys()];
  const pick=(start,chosen)=>{if(chosen.length===5){combos.push(chosen.slice());return}for(let i=start;i<7;i++){chosen.push(cards[i]);pick(i+1,chosen);chosen.pop()}};
  pick(0,[]);
  let best=null;
  for(const c of combos){const sc=score5(c);if(!best||cmpScore(sc,best.sc)>0)best={sc,cards:c}}
  return best.sc;
}
function score5(cards){
  const vals=cards.map(c=>HV[c.r]).sort((a,b)=>b-a);
  const suits=cards.map(c=>c.s);
  const flush=suits.every(s=>s===suits[0]);
  const uniq=[...new Set(vals)].sort((a,b)=>b-a);
  let straightHigh=0;
  if(uniq.length===5&&uniq[0]-uniq[4]===4)straightHigh=uniq[0];
  if(JSON.stringify(uniq)===JSON.stringify([14,5,4,3,2]))straightHigh=5;
  const counts={};vals.forEach(v=>counts[v]=(counts[v]||0)+1);
  const groups=Object.entries(counts).map(([v,c])=>({v:+v,c})).sort((a,b)=>b.c-a.c||b.v-a.v);
  if(flush&&straightHigh)return[8,straightHigh];
  if(groups[0].c===4)return[7,groups[0].v,groups[1].v];
  if(groups[0].c===3&&groups[1]&&groups[1].c>=2)return[6,groups[0].v,groups[1].v];
  if(flush)return[5,...vals];
  if(straightHigh)return[4,straightHigh];
  if(groups[0].c===3)return[3,groups[0].v,...groups.slice(1).map(g=>g.v)];
  if(groups[0].c===2&&groups[1]&&groups[1].c===2)return[2,groups[0].v,groups[1].v,groups[2].v];
  if(groups[0].c===2)return[1,groups[0].v,...groups.slice(1).map(g=>g.v)];
  return[0,...vals];
}
function cmpScore(a,b){for(let i=0;i<Math.max(a.length,b.length);i++){const x=a[i]||0,y=b[i]||0;if(x!==y)return x-y}return 0}
const HAND_NAMES=['Carte haute','Paire','Double paire','Brelan','Suite','Couleur','Full','Carré','Quinte flush'];
reg({id:'holdem',name:'Casino Hold’em',cat:'table',rtp:'97,8 %',vol:'Moyenne',badge:'new',pop:40,
  bg:'radial-gradient(circle at 50% 30%,#0a2a3a,#020e12)',glyph:'♣️',
  init(stage){
    stage.innerHTML=`<div class="felt"><div class="zone"><div class="zl">Croupier</div><div class="hand" id="dh3"></div></div>
    <div class="felt-mid" id="board3-l">Cartes communes</div><div class="hand" id="board3"></div>
    <div class="zone"><div class="zl">Ta main</div><div class="hand" id="ph3"></div></div></div>
    <div class="msg" id="msg">&nbsp;</div>
    <div class="ctrl"><div class="ctrl-row" id="betrow"></div><div class="ctrl-row" id="acts"></div></div>`;
    const bc=betCtl('holdem',100,{label:'Mise (Ante)'});$('#betrow',stage).appendChild(bc.el);
    const dh=$('#dh3',stage),ph=$('#ph3',stage),board=$('#board3',stage),msg=$('#msg',stage),acts=$('#acts',stage);
    let shoe=[],pcards=[],dcards=[],comm=[],ante=0,phase='bet';
    function setActs(list){acts.innerHTML=list.map(([id,l,cls])=>`<button class="btn ${cls||'btn-ghost'}" data-a="${id}" style="flex:1">${l}</button>`).join('');$$('button',acts).forEach(b=>b.addEventListener('click',()=>act(b.dataset.a)))}
    function reset(){dh.innerHTML='';ph.innerHTML='';board.innerHTML=Array.from({length:5},()=>cardEl(null,{hidden:true})).join('')}
    reset();
    function act(a){
      if(a==='deal'){
        const bet=bc.get();if(!canBet(bet))return;ante=bet;take(ante);bc.lock(true);
        if(shoe.length<20)shoe=deck(1);
        pcards=[shoe.pop(),shoe.pop()];dcards=[shoe.pop(),shoe.pop()];comm=[shoe.pop(),shoe.pop(),shoe.pop(),shoe.pop(),shoe.pop()];
        ph.innerHTML=pcards.map((c,i)=>cardEl(c,{delay:i*100})).join('');
        dh.innerHTML=dcards.map(()=>cardEl(null,{hidden:true})).join('');
        board.innerHTML=comm.slice(0,3).map((c,i)=>cardEl(c,{delay:i*100})).join('')+cardEl(null,{hidden:true})+cardEl(null,{hidden:true});
        snd('card');phase='flop';msg.textContent='Flop révélé — Suivre (mise ×2) ou se coucher ?';msg.className='msg';
        setActs([['call','Suivre (× 2)','btn-gold'],['fold','Se coucher','btn-ghost']]);
        return;
      }
      if(a==='fold'){
        dh.innerHTML=dcards.map((c,i)=>cardEl(c,{delay:i*80})).join('');board.innerHTML=comm.map((c,i)=>cardEl(c,{delay:i*70})).join('');
        msg.textContent='Couché — mise perdue';msg.className='msg l';record('holdem',ante,0,'Couché');finish();return;
      }
      if(a==='call'){
        const callBet=r2(ante*2);if(!canBet(callBet)){bc.lock(false);setActs([['deal','Distribuer','btn-gold']]);return}
        take(callBet);
        board.innerHTML=comm.map((c,i)=>cardEl(c,{delay:i*90})).join('');
        dh.innerHTML=dcards.map((c,i)=>cardEl(c,{delay:i*100})).join('');
        snd('card');
        const dScore=best5of7([...dcards,...comm]),pScore=best5of7([...pcards,...comm]);
        const dQualifies=dScore[0]>1||(dScore[0]===1&&dScore[1]>=4); // paire de 4 ou mieux
        const cmp=cmpScore(pScore,dScore);
        const totalBet=r2(ante+callBet);
        let win=0,label='';
        if(!dQualifies){
          win=r2(ante*2+callBet); // ante payée 1:1, call remboursé
          label=`Le croupier ne se qualifie pas (${HAND_NAMES[dScore[0]]}) — Ante payée, mise remboursée`;
        } else if(cmp>0){
          win=r2(ante*2+callBet*2);
          label=`${HAND_NAMES[pScore[0]]} bat ${HAND_NAMES[dScore[0]]} — Gagné`;
        } else if(cmp===0){
          win=totalBet;label='Égalité parfaite — mises remboursées';
        } else {
          win=0;label=`${HAND_NAMES[dScore[0]]} bat ${HAND_NAMES[pScore[0]]} — Perdu`;
        }
        win=r2(win);
        if(win>totalBet)snd(win/totalBet>=4?'big':'win');else if(win<totalBet)snd('lose');
        msg.textContent=label+(win>0?` — Reçu ◈ ${fmt(win)}`:'');msg.className='msg '+(win>totalBet?'w':win===totalBet?'':'l');
        if(win>0)give(win);
        record('holdem',totalBet,win,label);
        finish();
      }
    }
    function finish(){bc.lock(false);phase='bet';setActs([['deal','Distribuer','btn-gold']])}
    setActs([['deal','Distribuer','btn-gold']]);
    return()=>{};
  },
  rules:()=>`<h4>Casino Hold’em</h4><p>Mise l’Ante. Le flop (3 cartes communes) est révélé : suis en misant le double de l’Ante pour voir la suite, ou couche-toi et perds ta mise.</p>
  <p>Si tu suis, le tournant et la rivière sont révélés ainsi que les cartes du croupier. Le croupier doit avoir au moins une paire de 4 pour se qualifier.</p>
  <table class="ptab"><tbody><tr><td>Croupier non qualifié</td><td>Ante payée 1:1, mise de suivi remboursée</td></tr><tr><td>Tu gagnes, croupier qualifié</td><td>Ante et suivi payés 1:1</td></tr><tr><td>Égalité</td><td>Mises remboursées</td></tr></tbody></table>`});
