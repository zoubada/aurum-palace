'use strict';
/* ============ Roue de la fortune ============ */
const WHEEL_SEGS=[{l:'0×',m:0,w2:10,c:'#1C2130'},{l:'0,5×',m:0.5,w2:8.333,c:'#262C3F'},{l:'1×',m:1,w2:6.667,c:'#B8860B'},{l:'1,5×',m:1.5,w2:6,c:'#1C2130'},{l:'2×',m:2,w2:4,c:'#10B981'},{l:'0×',m:0,w2:10,c:'#1C2130'},{l:'0,5×',m:0.5,w2:8.333,c:'#262C3F'},{l:'1×',m:1,w2:6.667,c:'#B8860B'},{l:'3×',m:3,w2:3,c:'#7C3AED'},{l:'0×',m:0,w2:10,c:'#1C2130'},{l:'0,5×',m:0.5,w2:8.333,c:'#262C3F'},{l:'1×',m:1,w2:6.667,c:'#B8860B'},{l:'1,5×',m:1.5,w2:6,c:'#1C2130'},{l:'2×',m:2,w2:4,c:'#10B981'},{l:'5×',m:5,w2:1.2,c:'#E11D48'},{l:'10×',m:10,w2:0.3,c:'#3B82F6'},{l:'20×',m:20,w2:0.264,c:'#F5D76E',tc:'#231a02'}];
reg({id:'wheel',name:'Roue de la Fortune',cat:'instant',rtp:'90 %',vol:'Haute',badge:null,pop:56,
  bg:'radial-gradient(circle at 50% 30%,#3a1a08,#120802)',glyph:'🎡',
  init(stage){
    stage.innerHTML=`<div class="wheel-box" style="margin-bottom:16px"><div class="wheel-ptr"></div><svg viewBox="-150 -150 300 300"><circle r="148" fill="#0B0D12" stroke="#8B6508" stroke-width="6"/>${wheelSVG(WHEEL_SEGS,{r:140,inner:18,id:'fw'})}<circle r="16" fill="#0B0D12" stroke="#D4AF37" stroke-width="2"/></svg></div>
    <div class="msg" id="msg">&nbsp;</div>
    <div class="ctrl"><div class="ctrl-row" id="betrow"></div><button class="btn btn-gold btn-big" id="go">Tourner</button></div>`;
    const bc=betCtl('wheel',100);$('#betrow',stage).appendChild(bc.el);
    const go=$('#go',stage),msg=$('#msg',stage),wh=$('#fw',stage);let rot=0,busy=false;
    go.addEventListener('click',async()=>{
      if(busy)return;const bet=bc.get();if(!canBet(bet))return;take(bet);busy=true;go.disabled=true;bc.lock(true);
      rngStart();const i=wheelPick(WHEEL_SEGS);const seg=WHEEL_SEGS[i];const center=wheelCenterAngle(WHEEL_SEGS,i);
      rot+=360*6+(((-center-rot)%360)+360)%360;wh.style.transition='transform 4.2s cubic-bezier(.13,.7,.12,1)';wh.style.transform=`rotate(${rot}deg)`;
      const tk=setInterval(()=>snd('tick'),110);await sleep(4300);clearInterval(tk);
      const win=r2(bet*seg.m);
      if(win>0){give(win);snd(seg.m>=10?'big':'win')}else snd('lose');
      msg.textContent=`La roue s’arrête sur ${seg.l} — ${win>0?'Gagné ◈ '+fmt(win):'Perdu'}`;msg.className='msg '+(win>0?'w':'l');
      record('wheel',bet,win,`Segment ${seg.l}`);
      busy=false;go.disabled=false;bc.lock(false);
    });
    return()=>{};
  },
  rules:()=>`<h4>Roue de la Fortune</h4><p>La roue comporte des tranches de tailles différentes, comme une vraie roue de casino : les petits gains (×0, ×0,5, ×1) occupent une grande partie de la roue, tandis que le ×20 n’occupe qu’une fine tranche rare. Ta mise est multipliée par le segment sur lequel s’arrête le repère.</p>
  <p class="mu2" style="font-size:12px">RTP théorique ≈ 90 %.</p>`});

