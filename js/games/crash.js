'use strict';
/* ============ Crash ============ */
reg({id:'crash',name:'Crash',cat:'originals',rtp:'96 %',vol:'Haute',badge:'hot',pop:90,
  bg:'radial-gradient(circle at 50% 70%,#3a0a0a,#120303)',glyph:'🚀',
  init(stage){
    stage.innerHTML=`<div class="cr-stage"><canvas id="cv"></canvas><div class="cr-m" id="cm">1.00×<small id="csub">Place ta mise avant le décollage</small></div></div>
    <div class="ctrl wide">
      <div><div class="ctrl-row" id="betrow"></div><label class="chk" style="margin-top:8px"><input type="checkbox" id="auto"><span>Encaissement auto à <b id="autov">2,00×</b> — <input type="range" id="autor" min="1.1" max="20" step="0.1" value="2" style="width:110px;vertical-align:middle"></span></label></div>
      <button class="btn btn-gold btn-big" id="go" style="height:70px"></button>
    </div>
    <div class="msg" id="msg">&nbsp;</div>
    <div class="plist" id="plist"></div>`;
    const bc=betCtl('crash',100);$('#betrow',stage).appendChild(bc.el);
    const cv=$('#cv',stage),ctx=cv.getContext('2d'),cm=$('#cm',stage),csub=$('#csub',stage),go=$('#go',stage),msg=$('#msg',stage),plist=$('#plist',stage);
    const autoCk=$('#auto',stage),autor=$('#autor',stage),autov=$('#autov',stage);
    autor.addEventListener('input',()=>autov.textContent=(+autor.value).toFixed(2).replace('.',',')+'×');
    function size(){const d=devicePixelRatio||1,r=cv.getBoundingClientRect();cv.width=r.width*d;cv.height=r.height*d;ctx.setTransform(d,0,0,d,0,0)}
    size();const ro=new ResizeObserver(size);ro.observe(cv);
    let phase='bet',target=0,bet=0,t0=0,raf=null,cashedAt=0,others=[];
    const W=()=>cv.getBoundingClientRect().width,H=()=>cv.getBoundingClientRect().height;
    function curve(m){return Math.min(1,(m-1)/9)} // 0..1 pour la position visuelle jusqu'à x10
    function drawFrame(m,boom){
      const w=W(),hh=H();ctx.clearRect(0,0,w,hh);
      ctx.strokeStyle='rgba(255,255,255,.06)';ctx.lineWidth=1;
      for(let i=1;i<5;i++){ctx.beginPath();ctx.moveTo(0,hh*i/5);ctx.lineTo(w,hh*i/5);ctx.stroke()}
      const px=x=>20+x*(w-40),py=y=>hh-20-y*(hh-50);
      const N=60;ctx.beginPath();ctx.moveTo(px(0),py(0));
      for(let i=0;i<=N;i++){const x=i/N*curve(m);const y=Math.pow(x,1.35);ctx.lineTo(px(x),py(y))}
      const grad=ctx.createLinearGradient(0,hh,0,0);grad.addColorStop(0,boom?'rgba(239,68,68,.05)':'rgba(16,185,129,.05)');grad.addColorStop(1,boom?'rgba(239,68,68,.35)':'rgba(16,185,129,.35)');
      ctx.lineTo(px(curve(m)),hh);ctx.lineTo(px(0),hh);ctx.closePath();ctx.fillStyle=grad;ctx.fill();
      ctx.beginPath();ctx.moveTo(px(0),py(0));for(let i=0;i<=N;i++){const x=i/N*curve(m);const y=Math.pow(x,1.35);ctx.lineTo(px(x),py(y))}
      ctx.strokeStyle=boom?'#EF4444':'#10B981';ctx.lineWidth=3;ctx.shadowColor=boom?'rgba(239,68,68,.8)':'rgba(16,185,129,.8)';ctx.shadowBlur=10;ctx.stroke();ctx.shadowBlur=0;
      const ex=curve(m);const ey=Math.pow(ex,1.35);
      const ex2=Math.max(0,ex-0.02);const ey2=Math.pow(ex2,1.35);
      const ang=Math.atan2(py(ey)-py(ey2),px(ex)-px(ex2));
      const tx=px(ex),ty=py(ey);
      if(!boom){
        ctx.save();ctx.translate(tx,ty);ctx.rotate(ang+Math.PI/2);
        const flen=16+Math.sin(performance.now()/60)*5;
        const fg=ctx.createLinearGradient(0,10,0,10+flen);fg.addColorStop(0,'rgba(253,224,71,.95)');fg.addColorStop(.5,'rgba(251,146,60,.7)');fg.addColorStop(1,'rgba(251,146,60,0)');
        ctx.fillStyle=fg;ctx.beginPath();ctx.moveTo(-5,9);ctx.quadraticCurveTo(0,10+flen,5,9);ctx.closePath();ctx.fill();
        ctx.restore();
        ctx.save();ctx.shadowColor='rgba(16,185,129,.9)';ctx.shadowBlur=18;ctx.translate(tx,ty-2);ctx.rotate(ang+Math.PI/2);
        ctx.font='26px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('🚀',0,0);
        ctx.restore();
      } else {
        ctx.save();ctx.shadowColor='rgba(239,68,68,.9)';ctx.shadowBlur=22;ctx.font='30px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('💥',tx,ty);ctx.restore();
      }
    }
    function paintList(){plist.innerHTML=others.map(o=>`<div class="${o.cashed?'me':''}"><span>${esc(o.n)}</span><span class="${o.cashed?'ok':'mu2'}">${o.cashed?fmtM(o.mult):'en jeu…'}</span><span class="mu2">◈ ${o.cashed?fmt(r2(o.bet*o.mult)):fmt(o.bet)}</span></div>`).join('')}
    function newRoundVisual(){others=Array.from({length:5+Math.floor(Math.random()*4)},()=>({n:rname(),bet:[50,100,250,500,1000][Math.floor(Math.random()*5)],mult:0,cashed:false,co:1.2+Math.random()*8}));paintList()}
    newRoundVisual();
    go.addEventListener('click',()=>{
      if(phase==='flying'){ // encaisser
        cashOut();return;
      }
      const b=bc.get();if(!canBet(b))return;take(b);bet=b;bc.lock(true);
      rngStart();target=crashDist();
      phase='flying';go.className='btn btn-green btn-big';go.textContent='Encaisser';go.style.height='70px';
      cashedAt=0;msg.textContent='\u00A0';msg.className='msg';csub.style.display='none';
      newRoundVisual();
      t0=performance.now();snd('click');
      const loop=now=>{
        const el=(now-t0)/1000;const m=Math.min(target,1+Math.pow(el,1.55)*0.55);
        cm.textContent=m.toFixed(2).replace('.',',')+'×';cm.className='cr-m';
        drawFrame(m,false);
        others.forEach(o=>{if(!o.cashed&&m>=o.co){o.cashed=true;o.mult=o.co;paintList()}});
        if(autoCk.checked&&m>=+autor.value&&!cashedAt){cashOut(true);return}
        if(m>=target){crashNow(m);return}
        raf=requestAnimationFrame(loop);
      };raf=requestAnimationFrame(loop);
    });
    function cashOut(){
      if(phase!=='flying'||cashedAt)return;
      cancelAnimationFrame(raf);
      const el=(performance.now()-t0)/1000;const m=Math.min(target,1+Math.pow(el,1.55)*0.55);
      cashedAt=m;const win=r2(bet*m);give(win);snd(m>=10?'big':'win');
      msg.textContent=`Encaissé à ${m.toFixed(2).replace('.',',')}× — Gagné ◈ ${fmt(win)}`;msg.className='msg w';
      record('crash',bet,win,`Encaissé à ${m.toFixed(2)}×`);
      finishRound(m,false);
    }
    function crashNow(m){
      cancelAnimationFrame(raf);drawFrame(target,true);cm.textContent=target.toFixed(2).replace('.',',')+'×';cm.className='cr-m boom';
      if(!cashedAt){snd('boom');msg.textContent=`Crash à ${target.toFixed(2).replace('.',',')}× — Perdu`;msg.className='msg l';record('crash',bet,0,`Crash à ${target.toFixed(2)}×`)}
      finishRound(target,true);
    }
    function finishRound(m,boom){phase='done';go.className='btn btn-gold btn-big';go.textContent='Miser pour la prochaine fusée';go.style.height='70px';bc.lock(false);csub.style.display='';
      setTimeout(()=>{if(phase==='done'){phase='bet';drawFrame(1,false);cm.textContent='1.00×';cm.className='cr-m'}},1400)}
    drawFrame(1,false);
    return()=>{cancelAnimationFrame(raf);ro.disconnect()};
  },
  rules:()=>`<h4>Crash</h4><p>Une fusée décolle et son multiplicateur grimpe en continu. Encaisse avant qu’elle n’explose : plus tu attends, plus le gain potentiel est élevé, mais le risque aussi.</p>
  <p>Tu peux activer un <b>encaissement automatique</b> à un multiplicateur choisi à l’avance. Le point de crash est tiré aléatoirement dès le lancement, avant même que la courbe ne commence à monter.</p>
  <p class="mu2" style="font-size:12px">RTP théorique ≈ 96 %.</p>`});

