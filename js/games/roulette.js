'use strict';
/* ============ Roulette européenne ============ */
const RN=[0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const RED=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const isRed=n=>n===0?null:RED.has(n);
reg({id:'roulette',layout:'fill',name:'Roulette Européenne',cat:'table',rtp:'97,3 %',vol:'Moyenne',badge:'hot',pop:92,
  bg:'radial-gradient(circle at 50% 30%,#062a1c,#021109)',
  glyph:`<svg viewBox="-150 -150 300 300"><circle r="148" fill="#0B0D12" stroke="#8B6508" stroke-width="6"/>${wheelSVG(RN.map(n=>({l:'',c:n===0?'#047857':RED.has(n)?'#B4232A':'#1C2130'})),{r:140,inner:56,id:'rmini'})}<circle r="52" fill="#0B0D12" stroke="#D4AF37" stroke-width="3"/></svg>`,
  init(stage){
    stage.innerHTML=`<div class="rl">
      <div><div class="wheel-box"><div class="wheel-ptr"></div><div class="rball" id="rball"></div><svg viewBox="-150 -150 300 300"><circle r="148" fill="#0B0D12" stroke="#8B6508" stroke-width="6"/>${wheelSVG(RN.map(n=>({l:n,c:n===0?'#047857':RED.has(n)?'#B4232A':'#1C2130',fs:12})),{r:140,inner:30,id:'rwheel'})}<circle r="26" fill="#0B0D12" stroke="#D4AF37" stroke-width="3"/></svg><div class="rnum" id="rnum"></div></div>
      <div class="rstat" id="rstat"></div><div class="bead" id="bead" style="margin-top:10px"></div></div>
      <div><div class="chipsel" id="chips" style="margin-bottom:12px"></div>
      <div class="rt" id="grid"></div>
      <div class="rt-out2" id="outside2" style="margin-top:6px"></div>
      <div class="rt-out" id="outside" style="margin-top:4px"></div>
      <div class="ctrl-row" style="margin-top:14px;gap:8px">
        <span class="lbl rtot" style="margin:0;flex:1">Mise : <b class="gold num" id="tot">0</b> ◈</span>
        <button class="btn btn-ghost btn-sm" id="rebet">Rejouer</button>
        <button class="btn btn-ghost btn-sm" id="dbl2">×2</button>
        <button class="btn btn-ghost btn-sm" id="clear">Effacer</button>
      </div>
      <button class="btn btn-gold btn-big" id="spin" style="margin-top:10px">Lancer la bille</button>
      <div class="msg" id="msg">&nbsp;</div></div></div>`;
    const chip=chipSel('roulette');$('#chips',stage).appendChild(chip.el);
    const bets={};// key -> amount
    const totEl=$('#tot',stage),spinBtn=$('#spin',stage),msg=$('#msg',stage);
    const K=(type,val)=>type+':'+val;
    const straightCells=RN.map((n,i)=>({n,i}));
    // Grille "vraie table" simplifiée en 3 colonnes x 12 rangées (ordre 1..36 + 0)
    const grid=$('#grid',stage);
    let html='';for(let row=12;row>=1;row--){for(let c=0;c<3;c++){const n=(row-1)*3+c+1;html+=`<button type="button" class="rc ${n===0?'grn':isRed(n)?'red':'blk'}" data-b="straight:${n}">${n}</button>`}}
    html=`<button type="button" class="rc grn" data-b="straight:0">0</button>`+html;
    grid.innerHTML=html;
    $('#outside2',stage).innerHTML=['1ère douzaine (1-12)','2e douzaine (13-24)','3e douzaine (25-36)'].map((l,i)=>`<button type="button" class="rc out" data-b="doz:${i}" style="grid-column:span 2">${l}</button>`).join('');
    $('#outside',stage).innerHTML=[['col:0','Colonne 1'],['col:1','Colonne 2'],['col:2','Colonne 3']].map(([b,l])=>`<button type="button" class="rc out" data-b="${b}">${l}</button>`).join('')+
      [['low','1–18'],['even','Pair'],['red','Rouge'],['black','Noir'],['odd','Impair'],['high','19–36']].map(([b,l])=>`<button type="button" class="rc out ${b==='red'?'red':b==='black'?'blk':''}" data-b="${b}">${l}</button>`).join('');
    function payoutFor(type,val,n){
      if(type==='straight')return val==n?35:0;
      if(n===0)return 0;
      if(type==='red')return isRed(n)?1:0;
      if(type==='black')return isRed(n)===false?1:0;
      if(type==='even')return n%2===0?1:0;
      if(type==='odd')return n%2===1?1:0;
      if(type==='low')return n<=18?17/17*1:0;
      if(type==='high')return n>=19?1:0;
      if(type==='doz')return Math.floor((n-1)/12)===+val?2:0;
      if(type==='col')return (n-1)%3===+val?2:0;
      return 0;
    }
    function redraw(){
      $$('.rc',stage).forEach(b=>{const k=b.dataset.b;const old=b.querySelector('.chipmark');if(old)old.remove();b.classList.remove('hit');if(bets[k])b.insertAdjacentHTML('beforeend',chipMark(bets[k]))});
      const tot=Object.values(bets).reduce((a,b)=>a+b,0);totEl.textContent=fmt(tot);
    }
    $$('.rc',stage).forEach(b=>b.addEventListener('click',()=>{
      const v=chip.get();if(!canBet(v)){return}
      if(v>S.balance-Object.values(bets).reduce((a,x)=>a+x,0)+((bets[b.dataset.b])||0)){toast('Solde insuffisant pour ce jeton','err');return}
      bets[b.dataset.b]=r2((bets[b.dataset.b]||0)+v);snd('chip');redraw();
    }));
    $('#clear',stage).addEventListener('click',()=>{Object.keys(bets).forEach(k=>delete bets[k]);snd('click');redraw()});
    let lastBets=null;
    $('#rebet',stage).addEventListener('click',()=>{if(!lastBets)return;Object.assign(bets,lastBets);snd('chip');redraw()});
    $('#dbl2',stage).addEventListener('click',()=>{const tot=Object.values(bets).reduce((a,b)=>a+b,0);if(tot<=0)return;if(!canBet(tot))return;for(const k in bets)bets[k]=r2(bets[k]*2);snd('chip');redraw()});
    const rnumEl=$('#rnum',stage);
    function paintHistory(){const bd=$('#bead',stage),st=$('#rstat',stage);
      if(!S.rh.length){bd.style.display='flex';bd.style.alignItems='center';bd.style.justifyContent='center';bd.innerHTML='<span class="mu2" style="font-size:12.5px">L’historique des numéros sortis apparaîtra ici</span>';st.innerHTML='';return}
      bd.style.display='grid';bd.innerHTML=S.rh.slice(0,42).map(n=>`<i class="${n===0?'grn':isRed(n)?'red':'blk'}">${n}</i>`).join('');
      const last12=S.rh.slice(0,12);const rc=last12.filter(n=>isRed(n)).length,bc=last12.filter(n=>isRed(n)===false).length;
      const counts={};S.rh.slice(0,80).forEach(n=>counts[n]=(counts[n]||0)+1);const hot=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,3);
      st.innerHTML=`<span>12 derniers : <b class="pos">${rc}</b> rouges / <b>${bc}</b> noirs</span>`+(hot.length?`<span>Numéros chauds :${hot.map(([n,c])=>` <span class="n ${n==0?'grn':isRed(+n)?'red':'blk'}">${n}</span>`).join('')}</span>`:'');
    }
    paintHistory();
    const ballEl=$('#rball',stage);
    function spinBall(durationMs){
      ballEl.style.opacity='1';
      const R0=134,R1=104,turns=8;
      return new Promise(resolve=>{
        const t0=performance.now();
        function frame(t){
          const k=Math.min(1,(t-t0)/durationMs);
          const ease=1-Math.pow(1-k,3);
          const ang=-(turns*360)*ease;
          const r=R0-(R0-R1)*ease;
          const rad=ang*Math.PI/180;
          ballEl.style.transform=`translate(${(r*Math.sin(rad)).toFixed(1)}px,${(-r*Math.cos(rad)).toFixed(1)}px)`;
          if(k<1)requestAnimationFrame(frame);else resolve();
        }
        requestAnimationFrame(frame);
      });
    }
    let busy=false;
    spinBtn.addEventListener('click',async()=>{
      if(busy)return;const tot=r2(Object.values(bets).reduce((a,b)=>a+b,0));
      if(tot<=0){toast('Place au moins un jeton sur le tapis.','err');return}
      if(!canBet(tot))return;
      busy=true;spinBtn.disabled=true;msg.textContent='La bille tourne…';msg.className='msg';$('.rl',stage).classList.add('spinning');
      lastBets={...bets};
      take(tot);
      rngStart();const idx=randInt(37);const n=RN[idx];
      const wheel=$('#rwheel',stage);const seg=360/37;const cur=(wheel._rot||0);
      const target=360*7-idx*seg-seg/2;const rot=cur - (cur%360) + target;wheel._rot=rot;
      wheel.style.transition='transform 4.2s cubic-bezier(.12,.7,.15,1)';wheel.style.transform=`rotate(${rot}deg)`;
      const tk=setInterval(()=>snd('tick'),110);
      await Promise.all([sleep(4300),spinBall(4200)]);clearInterval(tk);
      rnumEl.innerHTML=`<span class="show" style="background:${n===0?'#047857':isRed(n)?'#B4232A':'#232838'}">${n}</span>`;
      let win=0;const hitKeys=[];
      for(const[k,amt] of Object.entries(bets)){const[type,val]=k.split(':');const m=payoutFor(type,val,n);if(m>0){win+=amt*(m+1);hitKeys.push(k)}}
      win=r2(win);
      S.rh.unshift(n);if(S.rh.length>200)S.rh.length=200;
      $$('.rc',stage).forEach(b=>b.classList.toggle('hit',hitKeys.includes(b.dataset.b)));
      if(win>0){give(win);snd(win/tot>=10?'big':'win')}else snd('lose');
      if(n===0&&hitKeys.some(k=>k.startsWith('straight')))unlock('zero');
      msg.textContent=win>0?`Le ${n} sort — Gagné ◈ ${fmt(win)}`:`Le ${n} sort — Perdu`;msg.className='msg '+(win>0?'w':'l');
      record('roulette',tot,win,`Sortie : ${n}`);
      paintHistory();
      Object.keys(bets).forEach(k=>delete bets[k]);redraw();
      setTimeout(()=>{const s=$('#rnum span',stage);if(s)s.classList.remove('show');const rl=$('.rl',stage);if(rl)rl.classList.remove('spinning')},2600);
      busy=false;spinBtn.disabled=false;
    });
    redraw();
    return()=>{};
  },
  rules:()=>`<h4>Roulette européenne</h4><p>Une seule case zéro (37 numéros). Choisis une valeur de jeton, clique sur le tapis pour miser, puis lance la bille.</p>
  <table class="ptab"><thead><tr><th>Mise</th><th>Gain</th></tr></thead><tbody>
  <tr><td>Plein (un numéro)</td><td>35 pour 1</td></tr><tr><td>Douzaine / Colonne</td><td>2 pour 1</td></tr>
  <tr><td>Rouge / Noir / Pair / Impair / Manque / Passe</td><td>1 pour 1</td></tr></tbody></table>
  <p class="mu2" style="font-size:12px">RTP théorique 97,3 % (avantage de la maison 2,7 %, lié à la case zéro).</p>`});

