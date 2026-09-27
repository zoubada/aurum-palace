'use strict';
/* ============ Poker Éclair : Sit & Go à 3 joueurs, dotation tirée à la roue ============
   Le tirage du multiplicateur a lieu AVANT l'animation de la roue ; les cartes sont
   mélangées par rand() (crypto). Le moteur de règles est dans js/poker-engine.js. */
const PK_BUYINS=[0.5,1,2,5,10,20,50,100,200,500,1000];
const PK_MULTS=[{m:2,w:61749},{m:3,w:30000},{m:5,w:6000},{m:10,w:2000},{m:25,w:200},{m:100,w:50},{m:1000,w:1}];
const PK_WHEEL=[1000,2,100,3,25,5,10,2];
const PK_LEVEL_MS=120000,PK_TURN_MS=20000;
const pkSplit=m=>m>=25?[.75,.15,.10]:[1,0,0];
function pkPayouts(buyin,m){const prize=r2(buyin*m),sp=pkSplit(m),p2=r2(prize*sp[1]),p3=r2(prize*sp[2]);return [r2(prize-p2-p3),p2,p3]}
const pkStatsDef=()=>({t:0,p1:0,p2:0,p3:0,buy:0,prize:0,best:0,bestM:0,hands:0,vpip:0,pfr:0,sd:0,sdw:0,hw:0,big:0});
const pkS=()=>(S.pkStats=Object.assign(pkStatsDef(),S.pkStats||{}));
const pct=(a,b)=>b?Math.round(a/b*100)+' %':'—';
const mmss=ms=>{ms=Math.max(0,ms);const s=Math.ceil(ms/1000);return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')};

function pkCard(c,{small=false,back=false,cls=''}={}){
  if(back)return `<span class="pkc back ${small?'sm':''} ${cls}"></span>`;
  const r=PKE.RCH[c>>2],s=PKE.SCH[c&3],red=(c&3)===1||(c&3)===2;
  return `<span class="pkc ${red?'red':''} ${small?'sm':''} ${cls}" aria-label="${r}${s}"><b>${r}</b><i>${s}</i><em>${s}</em></span>`;
}
const pkChip=v=>`<span class="pkchip"><i></i>${fmt(v)}</span>`;

function pkWheelSVG(buyin){
  const n=PK_WHEEL.length,R=140;let s='';
  for(let i=0;i<n;i++){
    const a1=(i/n)*Math.PI*2-Math.PI/2,a2=((i+1)/n)*Math.PI*2-Math.PI/2,am=(a1+a2)/2;
    const big=PK_WHEEL[i]>=100;
    s+=`<path class="pkw-seg" data-i="${i}" d="M0 0L${(Math.cos(a1)*R).toFixed(2)} ${(Math.sin(a1)*R).toFixed(2)}A${R} ${R} 0 0 1 ${(Math.cos(a2)*R).toFixed(2)} ${(Math.sin(a2)*R).toFixed(2)}Z" fill="${big?'url(#pkwBig)':i%2?'url(#pkwDark)':'url(#pkwRed)'}" stroke="#3a0508" stroke-width="2"/>`;
    const deg=am*180/Math.PI;
    s+=`<text transform="rotate(${deg.toFixed(2)}) translate(84 0)" text-anchor="middle" dominant-baseline="central" class="pkw-txt">${fmt(buyin*PK_WHEEL[i])}</text>`;
  }
  const bulbs=Array.from({length:16},(_,i)=>{const a=i/16*Math.PI*2;return `<circle class="pkw-bulb" cx="${(Math.cos(a)*150).toFixed(1)}" cy="${(Math.sin(a)*150).toFixed(1)}" r="5"/>`}).join('');
  const chev=Array.from({length:24},(_,i)=>`<path transform="rotate(${i*15})" d="M166,-6 L176,0 L166,6" fill="none" stroke="#E0243A" stroke-width="5" stroke-linecap="round" opacity=".85"/>`).join('');
  return `<svg viewBox="-190 -190 380 380" class="pkw-svg"><defs>
  <radialGradient id="pkwRed" cx="0" cy="0" r="140" gradientUnits="userSpaceOnUse"><stop offset=".2" stop-color="#7A0A12"/><stop offset="1" stop-color="#E0243A"/></radialGradient>
  <radialGradient id="pkwDark" cx="0" cy="0" r="140" gradientUnits="userSpaceOnUse"><stop offset=".2" stop-color="#14161C"/><stop offset="1" stop-color="#3A3E4A"/></radialGradient>
  <radialGradient id="pkwBig" cx="0" cy="0" r="140" gradientUnits="userSpaceOnUse"><stop offset=".2" stop-color="#3B0B55"/><stop offset="1" stop-color="#8E2BC2"/></radialGradient>
  <radialGradient id="pkwGold" cx="0" cy="0" r="140" gradientUnits="userSpaceOnUse"><stop offset=".2" stop-color="#E89A10"/><stop offset="1" stop-color="#FFE27A"/></radialGradient>
  <linearGradient id="pkwRim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".5" stop-color="#C9CED8"/><stop offset="1" stop-color="#8A909E"/></linearGradient>
  <linearGradient id="pkwGoldL" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF3BF"/><stop offset=".5" stop-color="#E2B13F"/><stop offset="1" stop-color="#8A5A0B"/></linearGradient></defs>
  <circle r="186" fill="url(#pkwRim)"/>${chev}<circle r="160" fill="#5A0A10"/><circle r="156" fill="none" stroke="url(#pkwGoldL)" stroke-width="3"/>${bulbs}
  <g class="pkw-rot">${s}<circle r="140" fill="none" stroke="url(#pkwGoldL)" stroke-width="3"/></g>
  <circle r="30" fill="#fff"/><circle r="26" fill="#E0243A"/>${Array.from({length:8},(_,i)=>`<rect transform="rotate(${i*45})" x="-3" y="-30" width="6" height="7" fill="#fff"/>`).join('')}
  <path d="M4,-16 L-9,3 L-1,3 L-5,17 L9,-3 L1,-3 Z" fill="#FFD23F" stroke="#8A4A05" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
}

reg({id:'eclair',name:'Poker Éclair',cat:'table',rtp:'91,5 %',vol:'Haute',badge:'new',pop:99,
  bg:'radial-gradient(circle at 50% 30%,#7a0a12,#1a0204)',glyph:'⚡',
  init(stage){
    let alive=true,T=S.pk,timers=[],pending=false,turnEnd=0,turnSeat=-1,pre=null,shown=new Set(),tab='log',buyin=S.bets.eclair&&PK_BUYINS.includes(S.bets.eclair)?S.bets.eclair:5;
    const later=(fn,ms)=>{const id=setTimeout(()=>{timers=timers.filter(x=>x!==id);if(alive)fn()},ms);timers.push(id);return id};
    const persist=()=>{S.pk=T;save()};
    const me=0;
    const nm=i=>T.seats[i].name;

    /* ---------------- Écran de mise ---------------- */
    function lobby(){
      T=null;S.pk=null;save();
      const st=pkS();
      const tot=PK_MULTS.reduce((a,x)=>a+x.w,0);
      stage.innerHTML=`<div class="pk-root"><div class="pkl">
        <div class="pkl-hero"><span class="pkl-bolt">${ic('zap',30)}</span><div><h2>Poker Éclair</h2><p>Sit & Go à 3 joueurs · 500 jetons chacun · blindes toutes les 2 minutes. Avant chaque partie, la roue fixe la dotation : jusqu’à <b>×1 000</b> ta mise.</p></div></div>
        <div class="pkl-lbl">Choisis ta mise</div>
        <div class="pkl-buy" role="radiogroup" aria-label="Mise">${PK_BUYINS.map(b=>`<button type="button" role="radio" class="pkb ${b===buyin?'on':''}" data-b="${b}" aria-checked="${b===buyin}"><span>${fmt(b)}</span><i>◈</i></button>`).join('')}</div>
        <div class="pkl-lbl">Dotations possibles</div>
        <div class="pkl-mults">${PK_MULTS.slice().reverse().map(x=>`<div class="pkm ${x.m>=100?'hot':''}"><b>×${fmt(x.m)}</b><span class="num">${fmt(r2(buyin*x.m))} ◈</span><small>${(x.w/tot*100).toLocaleString('fr-FR',{maximumFractionDigits:3})} %</small></div>`).join('')}</div>
        <p class="pkl-note">${ic('trophy',14)} Le vainqueur remporte toute la dotation. À partir de ×25, elle est partagée : 75 % au 1er, 15 % au 2e, 10 % au 3e.</p>
        <button class="btn btn-gold btn-big" id="pkgo">${ic('play',16)} Jouer · ${fmt(buyin)} ◈</button>
        <div class="pkl-stats"><div><b>${st.t}</b><span>Tournois</span></div><div><b>${pct(st.p1,st.t)}</b><span>Victoires</span></div><div><b class="${st.prize-st.buy>=0?'pos':'neg'}">${st.prize-st.buy>=0?'+':''}${fmt(r2(st.prize-st.buy))}</b><span>Résultat</span></div><div><b>${st.bestM?'×'+fmt(st.bestM):'—'}</b><span>Meilleure roue</span></div></div>
      </div></div>`;
      $$('.pkb',stage).forEach(b=>b.addEventListener('click',()=>{buyin=+b.dataset.b;S.bets.eclair=buyin;save();snd('chip');lobby()}));
      $('#pkgo',stage).addEventListener('click',start);
    }
    function start(){
      if(!canBet(buyin))return;
      take(buyin);rngStart();
      const m=pickW(PK_MULTS).m;
      const names=shuffle(NAMES.slice()).slice(0,2),avs=shuffle(AVS.filter(a=>a!==S.avatar)).slice(0,2),styles=shuffle(['tag','lag','rock']).slice(0,2);
      T=PKE.newTournament({players:[{name:S.name,av:S.avatar,human:true},{name:names[0],av:avs[0],style:styles[0]},{name:names[1],av:avs[1],style:styles[1]}],stack:500,levelMs:PK_LEVEL_MS,button:randInt(3)});
      Object.assign(T,{v:1,phase:'wheel',buyin,mult:m,payouts:pkPayouts(buyin,m),seg:pickSeg(m),elapsed:0,logs:[],st:{hands:0,won:0,big:0},t0:Date.now()});
      const s=pkS();s.t++;s.buy=r2(s.buy+buyin);
      persist();snd('click');wheel(false);
    }
    function pickSeg(m){const idx=PK_WHEEL.map((x,i)=>x===m?i:-1).filter(i=>i>=0);return idx[randInt(idx.length)]}

    /* ---------------- Roue de dotation ---------------- */
    function wheel(resume){
      stage.innerHTML=`<div class="pk-root"><div class="pkw"><div class="pkw-k">${ic('zap',16)} La roue fixe la dotation</div>
      <div class="pkw-box"><div class="pkw-ptr"></div>${pkWheelSVG(T.buyin)}</div>
      <div class="pkw-res" id="pkres"><span>Dotation</span><b class="num">${fmt(T.payouts.reduce((a,b)=>a+b,0))}<i>◈</i></b><em>×${fmt(T.mult)}</em>${T.payouts[1]?`<div class="pk-split"><span>1er <b>${fmt(T.payouts[0])}</b></span><span>2e <b>${fmt(T.payouts[1])}</b></span><span>3e <b>${fmt(T.payouts[2])}</b></span></div>`:'<div class="pk-split"><span>Le vainqueur remporte tout</span></div>'}</div>
      <button class="btn btn-gold btn-big" id="pkseat" disabled>Prendre place</button></div></div>`;
      const rot=$('.pkw-rot',stage),res=$('#pkres',stage),btn=$('#pkseat',stage),n=PK_WHEEL.length,seg=360/n;
      const target=360*7-(T.seg*seg+seg/2)+(Math.random()*.6-.3)*seg;
      const land=()=>{rot.style.transform=`rotate(${target}deg)`;const p=$(`.pkw-seg[data-i="${T.seg}"]`,stage);p.setAttribute('fill','url(#pkwGold)');p.classList.add('win');res.classList.add('show');btn.disabled=false;
        if(!resume){snd(T.mult>=10?'big':'win');if(T.mult>=25)confetti(120,true)}
        const go=()=>{if(!alive||T.phase!=='wheel')return;T.phase='play';persist();table();nextHand()};
        btn.addEventListener('click',go);later(go,resume?1200:3200)};
      if(resume){land();return}
      const t0=performance.now(),D=5600;let lastTick=0;
      const f=t=>{if(!alive)return;const k=Math.min(1,(t-t0)/D),e=1-Math.pow(1-k,4),a=target*e;rot.style.transform=`rotate(${a}deg)`;const tk=Math.floor((a+seg/2)/seg);if(tk!==lastTick){lastTick=tk;snd('tick')}if(k<1)requestAnimationFrame(f);else land()};
      requestAnimationFrame(f);
    }

    /* ---------------- Table ---------------- */
    function table(){
      stage.innerHTML=`<div class="pk-root"><div class="pk">
        <div class="pk-top"><span class="pk-clock">${ic('clock',15)} <b id="pkel">00:00</b></span><span class="pk-lv" id="pklv"></span></div>
        <div class="pk-tab" id="pktab"></div>
        <div class="pk-act" id="pkact"></div>
        <div class="pk-panel"><div class="tabs" role="tablist"><button class="tab ${tab==='log'?'on':''}" data-t="log">Historique des mains</button><button class="tab ${tab==='st'?'on':''}" data-t="st">Statistiques</button></div><div id="pkpan"></div></div>
      </div></div>`;
      $$('.pk-panel .tab',stage).forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.t;$$('.pk-panel .tab',stage).forEach(x=>x.classList.toggle('on',x===b));panel()}));
      draw();panel();
    }
    function seatHTML(i){
      const s=T.seats[i],H=T.hand,p=H&&H.p[i],isMe=i===me;
      const pos=['me','l','r'][i];
      if(s.out)return `<div class="pks pks-${pos} out"><div class="pks-av">${s.av}</div><div class="pks-pl"><span>${esc(isMe?s.name:s.name)}</span><b>${s.place}e</b></div></div>`;
      const acting=H&&!H.done&&H.toAct===i;
      const reveal=p&&!p.folded&&H&&(H.done&&H.result&&H.result.type==='sd'||H.runout);
      const won=H&&H.done&&H.result&&H.result.won[i];
      let cards='';
      if(p&&!isMe){cards=`<div class="pks-cards ${p.folded?'fold':''}">${reveal?p.cards.map((c,k)=>pkCard(c,{small:true,cls:dealt(`h${H.no}-${i}-${k}-r`)})).join(''):p.folded?'':p.cards.map((c,k)=>pkCard(0,{back:true,small:true,cls:dealt(`h${H.no}-${i}-${k}`)})).join('')}</div>`}
      const last=H&&!H.done?lastAct(i):'';
      const tag=p&&p.allIn?'<span class="pks-tag ai">Tapis</span>':p&&p.folded?'<span class="pks-tag">Couché</span>':last?`<span class="pks-tag">${last}</span>`:'';
      return `<div class="pks pks-${pos} ${acting?'act':''} ${p&&p.folded?'fold':''} ${won?'won':''}" style="--tl:${acting?turnFrac():0}">
        <div class="pks-av"><i class="pks-ring"></i>${s.av}${H&&H.btn===i?'<span class="pk-d">D</span>':''}</div>${cards}
        <div class="pks-pl"><span>${esc(s.name)}</span><b class="num">${fmt(s.stack)}</b>${tag}</div>
        ${p&&p.bet>0&&!H.done?`<div class="pks-bet">${pkChip(p.bet)}</div>`:''}${won?`<div class="pks-won">+${fmt(won)}</div>`:''}</div>`;
    }
    function lastAct(i){const H=T.hand;for(let k=H.log.length-1;k>=0;k--){const e=H.log[k];if(e.t==='street')return '';if(e.seat===i){return {check:'Parole',call:'Suit',raise:e.bet?'Mise':'Relance',sb:'PB',bb:'GB'}[e.t]||''}}return ''}
    const dealt=key=>{if(shown.has(key))return '';shown.add(key);return 'in'};
    function draw(){
      if(!alive||!T)return;
      const H=T.hand,tb=$('#pktab',stage);if(!tb)return;
      const pot=H?PKE.potTotal(H):0;
      const my=H&&H.p[me];
      let label='';
      if(my&&!my.folded){const v=PKE.evalHand(my.cards.concat(H.board));label=PKE.handName(v)}
      let msg='';
      if(H&&H.done&&H.result){const r=H.result;msg=Object.entries(r.won).map(([w,a])=>`${+w===me?'<b>Tu</b> remportes':`<b>${esc(nm(+w))}</b> remporte`} ${fmt(a)}${r.type==='sd'?` · ${PKE.handName(r.val[w])}`:''}`).join('<br>')}
      else if(H&&H.runout)msg='Tapis ! Les cartes sont retournées';
      tb.innerHTML=`<div class="pk-prize"><b class="num">${fmt(T.payouts.reduce((a,b)=>a+b,0))}<i>◈</i></b>${T.payouts[1]?`<div class="pk-split"><span>1er <b>${fmt(T.payouts[0])}</b></span><span>2e <b>${fmt(T.payouts[1])}</b></span><span>3e <b>${fmt(T.payouts[2])}</b></span></div>`:''}</div>
        <div class="pk-felt"><div class="pk-rim"></div></div>
        <div class="pk-mid"><div class="pk-pot">Pot total<b class="num">${fmt(pot)}</b></div>
        <div class="pk-board">${[0,1,2,3,4].map(k=>H&&H.board[k]!==undefined?pkCard(H.board[k],{cls:dealt(`b${H.no}-${k}`)+(H.done&&H.result&&H.result.type==='sd'&&isWinCard(H.board[k])?' hi':'')}):'<span class="pkc slot"></span>').join('')}</div>
        <div class="pk-msg ${msg?'show':''}">${msg}</div></div>
        ${[1,2,0].map(seatHTML).join('')}
        ${my?`<div class="pk-hand ${my.folded?'fold':''}">${my.cards.map((c,k)=>pkCard(c,{cls:dealt(`h${H.no}-0-${k}`)+(H.done&&H.result&&H.result.type==='sd'&&isWinCard(c)?' hi':'')})).join('')}${label?`<span class="pk-label">${label}</span>`:''}</div>`:''}`;
      actions();tick();
    }
    function isWinCard(c){const H=T.hand;if(!H||!H.result||H.result.type!=='sd')return false;const ws=Object.keys(H.result.won).map(Number);return ws.some(w=>bestFive(H.p[w].cards.concat(H.board)).includes(c))}
    function bestFive(cs){let best=-1,bc=[];for(let a=0;a<cs.length;a++)for(let b=a+1;b<cs.length;b++){const f=cs.filter((_,i)=>i!==a&&i!==b);if(f.length!==5)continue;const v=PKE.evalHand(f);if(v>best){best=v;bc=f}}return bc}
    function turnFrac(){return turnSeat>=0&&turnEnd?Math.max(0,Math.min(1,(turnEnd-Date.now())/PK_TURN_MS)):0}

    /* ---------------- Barre d'actions ---------------- */
    let raiseTo=0;
    function actions(){
      const el=$('#pkact',stage);if(!el)return;const H=T.hand;
      if(!H||T.over){el.innerHTML='';return}
      const p=H.p[me];
      if(!p||p.folded||p.allIn||H.done){el.innerHTML=`<div class="pk-wait">${!p?'':p.folded?'Tu t’es couché · prochaine main bientôt':p.allIn&&!H.done?'Tu es à tapis':H.done?'Prochaine main…':''}</div>`;return}
      if(H.toAct!==me){
        el.innerHTML=`<div class="pk-pre"><button class="pkbtn ghost ${pre==='cf'?'on':''}" data-pre="cf">${pre==='cf'?ic('check',14):''} Parole / Couché</button><button class="pkbtn ghost ${pre==='ck'?'on':''}" data-pre="ck">${pre==='ck'?ic('check',14):''} Parole</button></div>`;
        $$('[data-pre]',el).forEach(b=>b.addEventListener('click',()=>{pre=pre===b.dataset.pre?null:b.dataset.pre;snd('click');actions()}));return;
      }
      const L=PKE.legal(T,me);
      if(!raiseTo||raiseTo<L.minTo||raiseTo>L.maxTo)raiseTo=L.minTo;
      const potTo=f=>Math.round(L.isBet?f*L.pot:H.curBet+f*(L.pot+L.toCall));
      const presets=L.isBet?[['½',.5],['¾',.75],['Pot',1]]:[['½ Pot',.5],['¾',.75],['Pot',1]];
      el.innerHTML=`${L.raise?`<div class="pk-rz"><div class="pk-pres">${H.street===0&&H.curBet===H.bb?`<button data-to="${Math.min(L.maxTo,Math.max(L.minTo,H.bb*2))}">2 BB</button><button data-to="${Math.min(L.maxTo,Math.max(L.minTo,Math.round(H.bb*2.5)))}">2,5 BB</button>`:''}${presets.map(([t,f])=>`<button data-to="${Math.min(L.maxTo,Math.max(L.minTo,potTo(f)))}">${t}</button>`).join('')}<button data-to="${L.maxTo}" class="allin">Tapis</button></div>
        <div class="pk-sl"><input type="range" id="pkr" min="${L.minTo}" max="${L.maxTo}" step="1" value="${raiseTo}" aria-label="Montant de la relance"><span class="num" id="pkrv">${fmt(raiseTo)}</span></div></div>`:''}
        <div class="pk-btns">${L.fold?`<button class="pkbtn fold" data-a="fold">Se coucher</button>`:''}
        <button class="pkbtn call" data-a="${L.check?'check':'call'}">${L.check?'Parole':`Suivre <b class="num">${fmt(L.toCall)}</b>`}</button>
        ${L.raise?`<button class="pkbtn raise" data-a="raise"><span id="pkrl">${raiseTo>=L.maxTo?'Tapis':L.isBet?'Miser':'Relancer à'}</span> <b class="num" id="pkrb">${fmt(raiseTo)}</b></button>`:''}</div>`;
      const sl=$('#pkr',el);
      const setR=v=>{raiseTo=Math.max(L.minTo,Math.min(L.maxTo,Math.round(v)));if(sl)sl.value=raiseTo;const a=$('#pkrv',el),b=$('#pkrb',el),l=$('#pkrl',el);if(a)a.textContent=fmt(raiseTo);if(b)b.textContent=fmt(raiseTo);if(l)l.textContent=raiseTo>=L.maxTo?'Tapis':L.isBet?'Miser':'Relancer à'};
      if(sl)sl.addEventListener('input',()=>setR(+sl.value));
      $$('[data-to]',el).forEach(b=>b.addEventListener('click',()=>{setR(+b.dataset.to);snd('chip')}));
      $$('[data-a]',el).forEach(b=>b.addEventListener('click',()=>{const t=b.dataset.a;human(t==='raise'?{type:'raise',to:raiseTo}:{type:t})}));
    }
    function human(a){
      if(!T||!T.hand||T.hand.toAct!==me||pending)return;
      turnSeat=-1;turnEnd=0;raiseTo=0;
      apply(me,a);
    }
    function apply(seat,a){
      const H=T.hand;
      try{PKE.act(T,seat,a)}catch(e){console.error(e);const L=PKE.legal(T,seat);PKE.act(T,seat,L.check?{type:'check'}:{type:'fold'})}
      const e=H.log[H.log.length-1];
      snd(e.t==='fold'?'click':e.t==='check'?'tick':'chip');
      afterChange();
    }

    /* ---------------- Déroulement ---------------- */
    function nextHand(){
      if(!alive||T.over)return;
      const deckArr=shuffle([...Array(52).keys()]);
      PKE.startHand(T,deckArr);pre=null;raiseTo=0;
      T.st.hands++;pkS().hands++;
      snd('card');afterChange();
    }
    function afterChange(){persist();draw();step()}
    function step(){
      if(!alive||pending||!T||T.phase!=='play')return;
      const H=T.hand;
      if(!H)return nextHand();
      if(H.done){pending=true;handEnd();later(()=>{pending=false;if(T.over||T.seats[me].out)return finishT();nextHand()},H.result.type==='sd'?3400:1800);return}
      if(H.toAct<0){pending=true;later(()=>{pending=false;PKE.runoutStep(T);snd('card');afterChange()},1100);return}
      if(H.toAct===me){
        const L=PKE.legal(T,me);
        if(pre==='cf'){pre=null;return apply(me,L.check?{type:'check'}:{type:'fold'})}
        if(pre==='ck'){pre=null;if(L.check)return apply(me,{type:'check'})}
        if(!L.fold&&!L.raise&&L.check)return apply(me,{type:'check'});
        if(turnSeat!==me){turnSeat=me;turnEnd=Date.now()+PK_TURN_MS;draw()}
        return;
      }
      const seat=H.toAct;turnSeat=seat;turnEnd=Date.now()+PK_TURN_MS;
      pending=true;later(()=>{pending=false;if(!T.hand||T.hand.toAct!==seat)return;const a=PKE.botDecide(T,seat,Math.random);turnSeat=-1;apply(seat,a)},650+Math.random()*1100);
      draw();
    }
    function handEnd(){
      const H=T.hand;if(H.counted)return;H.counted=true;
      const p=H.p[me],st=pkS(),won=H.result.won[me]||0,pot=Object.values(H.p).reduce((a,x)=>a+x.contrib,0);
      if(p){if(p.vol)st.vpip++;if(p.raised)st.pfr++;if(H.result.type==='sd'&&!p.folded){st.sd++;if(won)st.sdw++}if(won){st.hw++;T.st.won++}}
      st.big=Math.max(st.big,won?pot:0);T.st.big=Math.max(T.st.big,won?pot:0);
      snd(won?'win':H.result.type==='sd'?'lose':'click');
      T.logs.unshift(fmtLog(H));if(T.logs.length>12)T.logs.length=12;
      for(const b of H.busted||[])if(b!==me)toast(`${esc(T.seats[b].name)} est éliminé · ${T.seats[b].place}e place`);
      persist();draw();panel();
    }
    function fmtLog(H){
      const L=[`<b>Main n° ${H.no}</b> · Blindes ${fmt(H.sb)}/${fmt(H.bb)} · Bouton : ${esc(nm(H.btn))}`];
      if(H.p[me])L.push(`Tes cartes : ${H.p[me].cards.map(PKE.cardStr).join(' ')}`);
      for(const e of H.log){const n2=e.seat!==undefined?esc(nm(e.seat)):'';
        if(e.t==='sb')L.push(`${n2} : petite blinde ${fmt(e.a)}`);else if(e.t==='bb')L.push(`${n2} : grosse blinde ${fmt(e.a)}`);
        else if(e.t==='fold')L.push(`${n2} se couche`);else if(e.t==='check')L.push(`${n2} parle`);
        else if(e.t==='call')L.push(`${n2} suit ${fmt(e.to)}${e.allIn?' (tapis)':''}`);
        else if(e.t==='raise')L.push(`${n2} ${e.bet?'mise':'relance à'} ${fmt(e.to)}${e.allIn?' (tapis)':''}`);
        else if(e.t==='street')L.push(`<b>${['','Flop','Turn','River'][e.street]}</b> : ${e.board.map(PKE.cardStr).join(' ')}`);
        else if(e.t==='refund')L.push(`${fmt(e.a)} non suivis rendus à ${n2}`);
        else if(e.t==='win')L.push(`<span class="pos">${n2} remporte ${fmt(e.a)}${e.hand?' avec '+e.hand:''}</span>`);}
      if(H.result&&H.result.type==='sd')for(const [w,v] of Object.entries(H.result.val))if(+w!==me)L.push(`${esc(nm(+w))} montre ${H.p[w].cards.map(PKE.cardStr).join(' ')} (${PKE.handName(v)})`);
      return L.join('<br>');
    }
    function finishT(){
      if(T.phase==='done')return;
      const place=T.seats[me].place,prize=T.payouts[place-1]||0,st=pkS();
      st['p'+place]++;st.prize=r2(st.prize+prize);st.best=Math.max(st.best,prize);st.bestM=Math.max(st.bestM,T.mult);
      T.phase='done';const R={place,prize,mult:T.mult,buyin:T.buyin,hands:T.handNo,time:T.elapsed,won:T.st.won,big:T.st.big};
      S.pk=null;save();
      if(prize>0)give(prize);
      if(place===1)unlock('pkwin');
      record('eclair',T.buyin,prize,`${place}e · roue ×${fmt(T.mult)} · ${T.handNo} mains`);
      end(R);
    }
    function end(R){
      T=null;
      stage.innerHTML=`<div class="pk-root"><div class="pke ${R.place===1?'first':''}"><div class="pke-medal">${R.place===1?ic('trophy',44):R.place}</div>
        <h2>${R.place===1?'Victoire !':R.place===2?'2e place':'3e place'}</h2>
        <p class="pke-p">${R.prize>0?`Tu remportes <b class="gold num">${fmt(R.prize)} ◈</b>`:'Éliminé sans gain cette fois'}</p>
        <div class="pke-st"><div><b>×${fmt(R.mult)}</b><span>Roue</span></div><div><b>${R.hands}</b><span>Mains</span></div><div><b>${mmss(R.time)}</b><span>Durée</span></div><div><b>${R.won}</b><span>Mains gagnées</span></div><div><b>${fmt(R.big)}</b><span>Plus gros pot</span></div></div>
        <button class="btn btn-gold btn-big" id="pkagain">${ic('refresh',16)} Rejouer · ${fmt(R.buyin)} ◈</button><button class="btn btn-ghost btn-big" id="pkchg" style="margin-top:8px">Changer de mise</button></div></div>`;
      $('#pkagain',stage).addEventListener('click',()=>{buyin=R.buyin;start()});
      $('#pkchg',stage).addEventListener('click',lobby);
    }

    /* ---------------- Panneau : historique / statistiques ---------------- */
    function panel(){
      const el=$('#pkpan',stage);if(!el)return;
      if(tab==='log'){el.innerHTML=T&&T.logs.length?T.logs.map(l=>`<div class="pk-log">${l}</div>`).join(''):'<div class="empty"><b>Aucune main terminée</b>L’historique détaillé de chaque main apparaîtra ici.</div>';return}
      const s=pkS();
      el.innerHTML=`<div class="stats pk-stats"><div class="st"><b>${s.t}</b><span>Tournois joués</span></div><div class="st"><b>${s.p1} · ${pct(s.p1,s.t)}</b><span>Victoires</span></div><div class="st"><b>${s.p2} / ${s.p3}</b><span>2es / 3es places</span></div><div class="st"><b class="${s.prize-s.buy>=0?'pos':'neg'}">${s.prize-s.buy>=0?'+':''}${fmt(r2(s.prize-s.buy))} ◈</b><span>Résultat net</span></div>
      <div class="st"><b>${fmt(s.best)} ◈</b><span>Plus gros gain</span></div><div class="st"><b>${s.bestM?'×'+fmt(s.bestM):'—'}</b><span>Meilleure roue</span></div><div class="st"><b>${s.hands}</b><span>Mains jouées</span></div><div class="st"><b>${pct(s.hw,s.hands)}</b><span>Mains gagnées</span></div>
      <div class="st"><b>${pct(s.vpip,s.hands)}</b><span>VPIP (mise volontaire)</span></div><div class="st"><b>${pct(s.pfr,s.hands)}</b><span>PFR (relance préflop)</span></div><div class="st"><b>${pct(s.sd,s.hands)}</b><span>Abattages atteints</span></div><div class="st"><b>${pct(s.sdw,s.sd)}</b><span>Abattages gagnés</span></div></div>`;
    }

    /* ---------------- Minuteries ---------------- */
    let lastT=Date.now();
    function tick(){
      if(!T||T.phase!=='play')return;
      const [sb,bb]=PKE.blindsAt(T.level),[nsb,nbb]=PKE.blindsAt(T.level+1),H=T.hand;
      const cur=H&&!H.done?[H.sb,H.bb]:[sb,bb];
      const el=$('#pkel',stage),lv=$('#pklv',stage);
      if(el)el.textContent=mmss(T.elapsed);
      if(lv)lv.innerHTML=`<span>Niveau ${T.level+1} · <b>${fmt(cur[0])}/${fmt(cur[1])}</b></span><span class="mu">${H&&!H.done&&H.level<T.level?`Prochaine main : <b>${fmt(sb)}/${fmt(bb)}</b>`:`${fmt(nsb)}/${fmt(nbb)} dans <b>${mmss(T.levelLeft)}</b>`}</span>`;
      const ring=$('.pks.act',stage);if(ring)ring.style.setProperty('--tl',turnFrac());
    }
    const iv=setInterval(()=>{
      const now=Date.now(),dt=Math.min(2000,now-lastT);lastT=now;
      if(!alive||!T||T.phase!=='play'||T.over)return;
      T.elapsed+=dt;T.levelLeft-=dt;
      if(T.levelLeft<=0){T.level++;T.levelLeft+=T.levelMs;const [a,b]=PKE.blindsAt(T.level);toast(`${ic('zap',14)} Les blindes passent à <b>${fmt(a)}/${fmt(b)}</b> à la prochaine main`);}
      if(turnSeat===me&&turnEnd&&now>=turnEnd&&T.hand&&T.hand.toAct===me&&!pending){const L=PKE.legal(T,me);toast('Temps écoulé : action automatique','err');human(L.check?{type:'check'}:{type:'fold'});return}
      if(turnSeat===me&&turnEnd&&turnEnd-now<5000&&turnEnd-now>4750)snd('tick');
      tick();
      if(now%5000<260)persist();
    },250);

    /* ---------------- Démarrage / reprise ---------------- */
    if(T&&T.v===1&&T.phase==='wheel')wheel(true);
    else if(T&&T.v===1&&T.phase==='play'){table();if(T.over||T.seats[me].out)finishT();else step()}
    else lobby();

    return()=>{alive=false;clearInterval(iv);timers.forEach(clearTimeout);timers=[];if(T&&T.phase!=='done'){S.pk=T;try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}};
  },
  rules:()=>`<h4>Poker Éclair</h4><p>Un tournoi Sit & Go de Texas Hold’em No Limit à 3 joueurs. Chacun commence avec 500 jetons de tournoi ; le dernier joueur en lice gagne. Les jetons de tournoi n’ont aucune valeur : seule la dotation en ◈ est versée à la fin.</p>
  <h4>La roue</h4><p>Après ta mise, la roue tire le multiplicateur de la dotation. Le tirage est fait avant l’animation, avec le générateur cryptographique du navigateur.</p>
  <table class="ptab"><thead><tr><th>Dotation</th><th>Probabilité</th></tr></thead><tbody>${PK_MULTS.slice().reverse().map(x=>`<tr><td>×${fmt(x.m)} la mise</td><td>${(x.w/1000).toLocaleString('fr-FR',{maximumFractionDigits:3})} %</td></tr>`).join('')}</tbody></table>
  <p>Jusqu’à ×10, le vainqueur remporte toute la dotation. À partir de ×25, elle est partagée : 75 % au 1er, 15 % au 2e, 10 % au 3e.</p>
  <h4>Blindes</h4><p>Elles augmentent toutes les 2 minutes (le nouveau niveau s’applique à la main suivante) : ${PKE.BLINDS.slice(0,10).map(b=>b.join('/')).join(' · ')}…</p>
  <h4>Déroulement</h4><p>À 3 joueurs, le bouton parle en premier avant le flop ; en tête-à-tête, le bouton poste la petite blinde. Relance minimale : le montant de la dernière relance complète ; un tapis inférieur à une relance complète ne rouvre pas les enchères. Les pots secondaires sont calculés automatiquement. Tu as 20 secondes pour agir, sinon tu passes (ou te couches si tu dois payer).</p>
  <p class="mu2" style="font-size:12px">RTP théorique ≈ 91,5 % à niveau de jeu égal : la dotation moyenne vaut 2,745 fois la mise pour 3 joueurs. Si tu quittes la page, la partie est mise en pause et reprend à ton retour.</p>`});
