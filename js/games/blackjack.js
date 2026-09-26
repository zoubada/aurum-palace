'use strict';
/* ============ Blackjack ============ */
function bjVal(hand){let v=0,aces=0;for(const c of hand){if(c.r==='A'){v+=11;aces++}else if(['K','Q','J'].includes(c.r))v+=10;else v+=+c.r}
  while(v>21&&aces>0){v-=10;aces--}return v}
const isBJ=h=>h.length===2&&bjVal(h)===21;
reg({id:'blackjack',name:'Blackjack',cat:'table',rtp:'99,5 %',vol:'Faible',badge:'hot',pop:95,
  bg:'radial-gradient(circle at 50% 30%,#0d3a26,#04140d)',glyph:cardEl({r:'A',s:'♠'},{cls:'gc-hero'}),
  init(stage){
    stage.innerHTML=`<div class="bj-banner" id="banner"><span class="bj-ic">${ic('cards',18)}</span><span class="bj-tx">Place ta mise pour commencer</span></div>
    <div class="felt"><div class="zone"><div class="zl">Croupier <span class="val" id="dv"></span></div><div class="hand" id="dh"></div></div>
    <div class="felt-mid">Blackjack payé 3:2 · le croupier reste sur 17</div>
    <div class="hands" id="phands"></div></div>
    <div class="msg" id="msg">&nbsp;</div>
    <div class="ctrl">
      <div class="ctrl-row" id="betrow"></div>
      <div class="ctrl-row" id="actions"></div>
      <p class="bj-hint" id="hint">&nbsp;</p>
    </div>`;
    const bc=betCtl('blackjack',100);$('#betrow',stage).appendChild(bc.el);
    const dhEl=$('#dh',stage),dvEl=$('#dv',stage),phEl=$('#phands',stage),msg=$('#msg',stage),actions=$('#actions',stage);
    const banner=$('#banner',stage),hint=$('#hint',stage);
    const setBanner=(icon,text,tone='')=>{banner.className='bj-banner '+tone;banner.innerHTML=`<span class="bj-ic">${ic(icon,18)}</span><span class="bj-tx">${text}</span>`};
    const HINTS={hit:'Tirer : prendre une carte de plus.',stand:'Rester : garder ta main telle quelle, c’est au croupier de jouer.',double:'Doubler : une seule carte de plus, mais ta mise est doublée.',split:'Séparer : jouer tes deux cartes comme deux mains distinctes.',insure:'Assurance : te protège si le croupier a un blackjack (payée 2:1).',skip:'Ignorer : continuer la main normalement, sans assurance.'};
    let shoe=[],dealer=[],hands=[],cur=0,phase='bet',insurance=0,bet0=0;
    const needShuffle=()=>shoe.length<52;
    function draw(){if(needShuffle())shoe=deck(6);return shoe.pop()}
    let dealerWasHidden=true;
    function renderDealer(hide){const justRevealed=dealerWasHidden&&!hide;dealerWasHidden=hide;
      dhEl.innerHTML=dealer.map((c,i)=>cardEl(c,{hidden:hide&&i===1,delay:i*90,cls:justRevealed&&i===1?'flip-reveal':''})).join('');dvEl.textContent=hide?bjVal([dealer[0]]):bjVal(dealer)}
    function renderHands(){phEl.innerHTML=hands.map((hd,i)=>{const v=bjVal(hd.cards);const bust=v>21;
      return `<div class="hw ${i===cur&&phase==='play'?'act':''}"><div class="hand">${hd.cards.map((c,k)=>cardEl(c,{delay:k*90})).join('')}</div><div class="val">${v}${bust?' · BUST':''}</div>${hd.result?`<span class="tag ${hd.result}">${{win:'GAGNÉ',lose:'PERDU',push:'ÉGALITÉ',bj:'BLACKJACK',bust:'BUST'}[hd.result]}</span>`:''}${hands.length>1?`<span class="mu2" style="font-size:11px">Main ${i+1} · ◈ ${fmt(hd.bet)}</span>`:''}</div>`}).join('')}
    const ICONS={hit:'plus',stand:'hand',double:'double',split:'split',insure:'shield',skip:'arrow',new:'cards'};
    const PRIMARY=new Set(['hit','stand','new']);
    function setActions(list){actions.innerHTML=list.map(([id,l,cls])=>`<button class="btn ${cls||(PRIMARY.has(id)?(id==='stand'?'btn-green':'btn-gold'):'btn-ghost')}" data-a="${id}" style="flex:1">${ICONS[id]?ic(ICONS[id],16):''} ${l}</button>`).join('');
      $$('button',actions).forEach(b=>{b.addEventListener('click',()=>act(b.dataset.a));b.addEventListener('pointerenter',()=>hint.textContent=HINTS[b.dataset.a]||'\u00A0')});
      hint.textContent=HINTS[list[0]?.[0]]||'\u00A0';
    }
    function newRound(){
      const bet=bc.get();if(!canBet(bet))return;
      bet0=bet;take(bet);bc.lock(true);
      if(needShuffle())shoe=deck(6);
      dealer=[draw(),draw()];hands=[{cards:[draw(),draw()],bet,result:null,done:false}];cur=0;phase='play';insurance=0;
      renderDealer(true);renderHands();msg.textContent='\u00A0';msg.className='msg';snd('card');
      setBanner('cards','Cartes distribuées…');
      const ph=hands[0];
      if(dealer[0].r==='A'){
        setBanner('shield','Le croupier montre un As — veux-tu une assurance ?','warn');
        setActions([['insure','Assurance (½ mise)'],['skip','Ignorer l’assurance']]);
      } else evaluatePlayerStart();
    }
    function evaluatePlayerStart(){
      const ph=hands[0];
      if(isBJ(dealer)){ // croupier a blackjack
        renderDealer(false);
        if(isBJ(ph.cards)){ph.result='push';give(ph.bet)}else{ph.result='lose'}
        finishRound();return;
      }
      if(isBJ(ph.cards)){ph.result='bj';give(r2(ph.bet*2.5));unlock('bj');renderHands();setBanner('star','Blackjack naturel ! Payé 3:2.','win');finishRound();return}
      setBanner('arrow','À toi de jouer : Tirer une carte ou Rester ?');
      setActions(actionsFor(ph));
    }
    function actionsFor(hd){
      const a=[['hit','Tirer'],['stand','Rester']];
      if(hd.cards.length===2&&S.balance>=hd.bet)a.push(['double','Doubler']);
      if(hd.cards.length===2&&hd.cards[0].r===hd.cards[1].r&&S.balance>=hd.bet&&hands.length<4)a.push(['split','Séparer']);
      return a;
    }
    async function act(a){
      if(a==='insure'){
        const cost=r2(bet0/2);if(cost>S.balance){toast('Solde insuffisant pour l’assurance','err')}else{take(cost);insurance=cost}
        if(isBJ(dealer)){renderDealer(false);if(insurance)give(insurance*3);const ph=hands[0];ph.result=isBJ(ph.cards)?'push':'lose';if(ph.result==='push')give(ph.bet);setBanner(ph.result==='push'?'scale':'close',ph.result==='push'?'Le croupier a un blackjack — égalité':'Le croupier a un blackjack','');finishRound();return}
        evaluatePlayerStart();return;
      }
      if(a==='skip'){if(isBJ(dealer)){renderDealer(false);const ph=hands[0];ph.result=isBJ(ph.cards)?'push':'lose';if(ph.result==='push')give(ph.bet);finishRound();return}evaluatePlayerStart();return}
      const hd=hands[cur];
      if(a==='hit'){hd.cards.push(draw());snd('card');renderHands();if(bjVal(hd.cards)>21){hd.result='bust';setBanner('zap','Dépassé 21 — main perdue','lose');nextHand()}else{setBanner('arrow','Continuer : Tirer encore ou Rester ?');setActions(actionsFor(hd))}return}
      if(a==='stand'){setBanner('clock','Tu restes — au tour du croupier…');nextHand();return}
      if(a==='double'){take(hd.bet);hd.bet=r2(hd.bet*2);hd.cards.push(draw());snd('card');renderHands();if(bjVal(hd.cards)>21){hd.result='bust';setBanner('zap','Dépassé 21 après avoir doublé','lose')}nextHand();return}
      if(a==='split'){
        take(hd.bet);
        const c2=hd.cards.pop();hands.splice(cur+1,0,{cards:[c2,draw()],bet:hd.bet,result:null});
        hd.cards.push(draw());renderHands();setBanner('arrow','Mains séparées — joue la première.');setActions(actionsFor(hd));return;
      }
    }
    function nextHand(){cur++;if(cur<hands.length&&!hands[cur].result){setBanner('arrow',`Main ${cur+1} : Tirer ou Rester ?`);setActions(actionsFor(hands[cur]));renderHands()}else dealerPlay()}
    async function dealerPlay(){
      phase='dealer';actions.innerHTML='';hint.textContent='\u00A0';renderDealer(false);
      setBanner('user','Le croupier retourne sa carte et joue…');
      await sleep(500);
      const anyAlive=hands.some(h=>h.result!=='bust');
      while(anyAlive&&bjVal(dealer)<17){await sleep(550);dealer.push(draw());snd('card');renderDealer(false)}
      const dv=bjVal(dealer),dbust=dv>21;
      for(const hd of hands){if(hd.result)continue;const pv=bjVal(hd.cards);
        if(dbust||pv>dv)hd.result='win';else if(pv<dv)hd.result='lose';else hd.result='push';
      }
      renderHands();
      let total=0;for(const hd of hands){if(hd.result==='win')total+=hd.bet*2;else if(hd.result==='push')total+=hd.bet;else if(hd.result==='bj')total+=hd.bet*2.5}
      total=r2(total);
      if(total>0)give(total);
      if(dbust)setBanner('star','Le croupier dépasse 21 — tu gagnes !','win');
      finishRound(total);
    }
    function finishRound(totalWin){
      renderHands();
      let win=totalWin;
      if(win==null){win=0;for(const hd of hands){if(hd.result==='bj')win+=hd.bet*2.5;else if(hd.result==='win')win+=hd.bet*2;else if(hd.result==='push')win+=hd.bet}}
      win=r2(win);
      const totalBet=r2(hands.reduce((a,h)=>a+h.bet,0)+insurance);
      if(win>totalBet)snd(win/totalBet>=5?'big':'win');else if(win<totalBet)snd('lose');
      msg.textContent=win>totalBet?`Gagné ◈ ${fmt(win)}`:win===totalBet?'Égalité (push)':'Perdu';msg.className='msg '+(win>=totalBet?(win>totalBet?'w':''):'l');
      if(win>totalBet)setBanner('star','Tu remportes cette main !','win');
      else if(win===totalBet)setBanner('scale','Égalité — ta mise est remboursée','');
      else if(hands.every(h=>h.result!=='bust'))setBanner('close','Le croupier gagne cette main','lose');
      record('blackjack',totalBet,win,hands.length>1?`${hands.length} mains séparées`:hands[0].result==='bj'?'Blackjack':'');
      bc.lock(false);hint.textContent='\u00A0';setActions([['new','Nouvelle main']]);
      setTimeout(()=>{if(phase!=='play')setBanner('cards','Prêt pour une nouvelle main')},1400);
    }
    setActions([['new','Distribuer']]);
    $('#actions',stage).addEventListener('click',e=>{const b=e.target.closest('[data-a="new"]');if(b)newRound()});
    return()=>{};
  },
  rules:()=>`<h4>Blackjack</h4><p>Sabot de 6 jeux, mélangé automatiquement. Le croupier tire jusqu’à 17 et reste ensuite, y compris sur un 17 dit « soft » (avec un As compté 11).</p>
  <table class="ptab"><tbody><tr><td>Blackjack naturel (As + 10)</td><td>Payé 3 pour 2</td></tr><tr><td>Main gagnante normale</td><td>Payée 1 pour 1</td></tr><tr><td>Assurance (si le croupier montre un As)</td><td>Payée 2 pour 1</td></tr></tbody></table>
  <p>Tu peux <b>Tirer</b>, <b>Rester</b>, <b>Doubler</b> ta mise sur tes deux premières cartes, ou <b>Séparer</b> une paire pour jouer deux mains. Le bandeau en haut de la table t’indique à chaque instant ce qu’il y a à faire.</p>`});

