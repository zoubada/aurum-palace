'use strict';
/* ============ Plinko ============ */
const PLINKO_M={
 low:{8:[5.63,2.43,1.17,0.78,0.58,0.78,1.17,2.43,5.63],10:[7.74,3.62,1.91,1.11,0.7,0.6,0.7,1.11,1.91,3.62,7.74],12:[9.7,4.85,2.62,1.55,0.97,0.78,0.58,0.78,0.97,1.55,2.62,4.85,9.7],14:[13,6.65,3.71,2.15,1.37,0.98,0.68,0.68,0.68,0.98,1.37,2.15,3.71,6.65,13],16:[17,9.03,5.16,3.08,1.88,1.29,0.89,0.69,0.69,0.69,0.89,1.29,1.88,3.08,5.16,9.03,17]},
 med:{8:[20,4.24,1.13,0.47,0.28,0.47,1.13,4.24,20],10:[36,9.09,2.74,0.98,0.39,0.29,0.39,0.98,2.74,9.09,36],12:[58,17,5.27,1.88,0.85,0.47,0.28,0.47,0.85,1.88,5.27,17,58],14:[101,31,11,3.8,1.66,0.78,0.39,0.29,0.39,0.78,1.66,3.8,11,31,101],16:[169,55,19,7.35,3.08,1.39,0.7,0.4,0.3,0.4,0.7,1.39,3.08,7.35,19,55,169]},
 high:{8:[46,4.94,0.68,0.19,0.19,0.19,0.68,4.94,46],10:[107,15,2.43,0.49,0.19,0.19,0.19,0.49,2.43,15,107],12:[234,39,7.09,1.55,0.39,0.19,0.19,0.19,0.39,1.55,7.09,39,234],14:[509,94,19,4.32,1.15,0.29,0.19,0.19,0.19,0.29,1.15,4.32,19,94,509],16:[960,214,46,12,2.88,0.86,0.29,0.19,0.19,0.19,0.29,0.86,2.88,12,46,214,960]}};
reg({id:'plinko',name:'Plinko',cat:'originals',rtp:'95 %',vol:'Réglable',badge:'new',pop:80,
  bg:'radial-gradient(circle at 50% 20%,#0a2540,#040e1a)',glyph:ic('plinko',64),
  init(stage){
    stage.innerHTML=`<div class="orig-stage" style="--orig-accent:#3B82F6"><div class="orig-glow"></div><div class="pk-box"><canvas id="pk"></canvas><div class="pk-slots" id="slots"></div></div>
    <div class="msg" id="msg">&nbsp;</div>
    <div class="ctrl wide">
      <div class="ctrl-row" id="betrow"></div>
      <div><div class="ctrl-row"><select class="sel" id="risk" style="flex:1"><option value="low">Risque faible</option><option value="med" selected>Risque moyen</option><option value="high">Risque élevé</option></select><select class="sel" id="rows" style="flex:1"><option>8</option><option>10</option><option selected>12</option><option>14</option><option>16</option></select></div>
      <button class="btn btn-gold btn-big" id="go" style="margin-top:10px">Lâcher la bille</button></div>
    </div></div>`;
    const bc=betCtl('plinko',50);$('#betrow',stage).appendChild(bc.el);
    const cv=$('#pk',stage),ctx=cv.getContext('2d'),go=$('#go',stage),msg=$('#msg',stage),riskSel=$('#risk',stage),rowsSel=$('#rows',stage),slotsEl=$('#slots',stage);
    let rows=12,risk='med',balls=[],pegs=[];
    function size(){const d=devicePixelRatio||1;const w=cv.clientWidth||600;const hh=w*0.82;cv.style.height=hh+'px';cv.width=w*d;cv.height=hh*d;ctx.setTransform(d,0,0,d,0,0);cv._w=w;cv._h=hh;layout()}
    function layout(){pegs=[];const w=cv._w,hh=cv._h;const top=26,bottom=hh-26;const dy=(bottom-top)/rows;
      for(let r=0;r<rows;r++){const n=r+3;const dx=w/(n+1);for(let c=0;c<n;c++)pegs.push({x:dx*(c+1),y:top+dy*r,r:Math.max(2.2,4.4-rows*0.08)})}}
    new ResizeObserver(size).observe(cv);size();
    function paintSlots(){const m=PLINKO_M[risk][rows];slotsEl.innerHTML=m.map(v=>`<div class="pk-s" style="background:${slotColor(v,m)}">${v>=10?Math.round(v):v.toFixed(1).replace('.',',')}×</div>`).join('')}
    function slotColor(v,m){const mx=Math.max(...m);const t=Math.min(1,Math.log(v+1)/Math.log(mx+1));const r=Math.round(245-30*t),g=Math.round(215-190*t),b=Math.round(110-90*t);return `rgb(${r},${Math.max(30,g)},${Math.max(20,b)})`}
    riskSel.addEventListener('change',()=>{risk=riskSel.value;paintSlots()});
    rowsSel.addEventListener('change',()=>{rows=+rowsSel.value;layout();paintSlots()});
    paintSlots();
    function draw(){
      const w=cv._w,hh=cv._h;ctx.clearRect(0,0,w,hh);
      ctx.fillStyle='rgba(255,255,255,.35)';for(const p of pegs){ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,6.283);ctx.fill()}
      for(const b of balls){const g=ctx.createRadialGradient(b.x-2,b.y-2,1,b.x,b.y,7);g.addColorStop(0,'#FFF7DA');g.addColorStop(1,'#D4AF37');ctx.fillStyle=g;ctx.beginPath();ctx.arc(b.x,b.y,6,0,6.283);ctx.fill()}
      requestAnimationFrame(draw);
    }
    draw();
    function dropBall(bet){
      const w=cv._w,hh=cv._h;let x=w/2+(Math.random()-.5)*4,y=6,vx=0,vy=0;const slotN=PLINKO_M[risk][rows].length;
      // décide la case finale à l'avance via rand() (équité), puis anime une trajectoire plausible vers elle
      const bino=(()=>{let k=0;for(let i=0;i<rows;i++)if(rand()<0.5)k++;return k})();
      const targetSlot=bino;
      const b={x,y,vx,vy,step:0,path:targetSlot};balls.push(b);
      const top=26,bottom=hh-26,dy=(bottom-top)/rows;
      let leftCount=0;
      const iv=setInterval(()=>{
        b.step++;const r=b.step-1;if(r>=rows){clearInterval(iv);
          const finalX=(w/((rows+3)+1))*(targetSlot+1)+ (w - (w/((rows+3)+1))*((rows+3)+1))/2*0; // fallback simple
          settle(b,targetSlot,bet);return}
        const goRight=r<targetSlot? (leftCount<r+1? true:false):false;
        // direction simplifiée : viser targetSlot progressivement
        const bias=(targetSlot-(rows/2))/(rows/2);
        const dir=rand()<0.5+bias*0.12?1:-1;
        b.x+=dir* (w/(rows+4)) *0.5;
        b.y=top+dy*(r+1);
        if(rand()<0.5)leftCount++;
      },95);
    }
    function settle(b,slot,bet){
      const idx=balls.indexOf(b);if(idx>=0)balls.splice(idx,1);
      const m=PLINKO_M[risk][rows][slot];const win=r2(bet*m);
      $$('.pk-s',slotsEl).forEach((el,i)=>{if(i===slot){el.classList.add('hit');setTimeout(()=>el.classList.remove('hit'),400)}});
      if(win>0){give(win);snd(m>=20?'big':m>=1?'win':'lose')}else snd('lose');
      msg.textContent=`Case ${fmtM(m)} — ${win>bet?'Gagné':win===bet?'Remboursé':win>0?'Petite perte':'Perdu'} ◈ ${fmt(win)}`;msg.className='msg '+(win>bet?'w':win<bet?'l':'');
      record('plinko',bet,win,`${rows} rangées, risque ${risk==='low'?'faible':risk==='med'?'moyen':'élevé'}`);
    }
    go.addEventListener('click',()=>{const bet=bc.get();if(!canBet(bet))return;take(bet);snd('click');rngStart();dropBall(bet)});
    return()=>{};
  },
  rules:()=>`<h4>Plinko</h4><p>Lâche une bille dans une grille de picots (8 à 16 rangées). À chaque picot, elle part au hasard à gauche ou à droite jusqu’à atterrir dans une case multiplicatrice.</p>
  <p>Le niveau de risque change l’écart entre les cases : plus il est élevé, plus les cases centrales paient peu et les cases extrêmes paient beaucoup.</p>
  <p class="mu2" style="font-size:12px">RTP théorique ≈ 95 % sur les trois niveaux de risque.</p>`});

