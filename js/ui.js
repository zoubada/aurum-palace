'use strict';
/* ============ Toasts, modales, effets ============ */
function toast(msg,type=''){const c=$('#toasts');const t=h(`<div class="toast ${type}">${msg}</div>`);c.appendChild(t);while(c.children.length>3)c.firstChild.remove();setTimeout(()=>{t.classList.add('out');setTimeout(()=>t.remove(),300)},3400)}
function modal(html,{dismiss=true}={}){const m=h(`<div class="mb" role="dialog" aria-modal="true"><div class="md">${html}</div></div>`);document.body.appendChild(m);const close=()=>{m.classList.add('out');setTimeout(()=>m.remove(),200)};if(dismiss)m.addEventListener('click',e=>{if(e.target===m)close()});$$('[data-close]',m).forEach(b=>b.addEventListener('click',close));const f=$('button,input',m);if(f)setTimeout(()=>f.focus(),50);return{el:m,close}}
function modalMsg(t,b){modal(`<h3 class="mt">${t}</h3><p class="mp">${b}</p><button class="btn btn-gold btn-big" data-close>Compris</button>`)}

const fx=$('#fx'),fxc=fx.getContext('2d');let parts=[],fxRun=false;
function fxSize(){const d=devicePixelRatio||1;fx.width=innerWidth*d;fx.height=innerHeight*d;fxc.setTransform(d,0,0,d,0,0)}
fxSize();addEventListener('resize',fxSize);
const CC=['#F5D76E','#D4AF37','#10B981','#F43F5E','#60A5FA','#ffffff'];
function confetti(n=120,coins=false){if(REDUCED)return;for(let i=0;i<n;i++)parts.push({x:Math.random()*innerWidth,y:-20-Math.random()*innerHeight*.5,vx:(Math.random()-.5)*3,vy:2+Math.random()*4,r:Math.random()*6.28,vr:(Math.random()-.5)*.3,s:coins?7+Math.random()*6:5+Math.random()*6,c:coins&&i%2?'coin':CC[i%6]});if(!fxRun){fxRun=true;requestAnimationFrame(fxLoop)}}
function fxLoop(){fxc.clearRect(0,0,innerWidth,innerHeight);parts=parts.filter(p=>p.y<innerHeight+30);for(const p of parts){p.vy+=.05;p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;fxc.save();fxc.translate(p.x,p.y);fxc.rotate(p.r);if(p.c==='coin'){fxc.scale(Math.max(.15,Math.abs(Math.cos(p.r*1.4))),1);const g=fxc.createRadialGradient(-2,-2,1,0,0,p.s);g.addColorStop(0,'#FFF4B8');g.addColorStop(.55,'#E2B83E');g.addColorStop(1,'#8B6508');fxc.fillStyle=g;fxc.beginPath();fxc.arc(0,0,p.s,0,6.283);fxc.fill()}else{fxc.fillStyle=p.c;fxc.fillRect(-p.s/2,-p.s/4,p.s,p.s/2)}fxc.restore()}if(parts.length)requestAnimationFrame(fxLoop);else{fxRun=false;fxc.clearRect(0,0,innerWidth,innerHeight)}}
function bigWin(win,mult){const lvl=mult>=100?'Méga gain':mult>=40?'Super gain':'Gros gain';const o=h(`<div class="bigwin"><div><h2 class="gtext">${lvl}</h2><p><span class="gold">◈</span> <span class="n">0</span></p></div></div>`);document.body.appendChild(o);snd('big');confetti(90,true);const n=$('.n',o),t0=performance.now();const st=t=>{const k=Math.min(1,(t-t0)/1400);n.textContent=fmt(win*(1-Math.pow(1-k,3)));if(k<1)requestAnimationFrame(st)};requestAnimationFrame(st);setTimeout(()=>{o.classList.add('out');setTimeout(()=>o.remove(),400)},2600)}
let wfQueue=[],wfBusy=false;
function winFlash(win,mult){
  if(win<=0)return;
  wfQueue.push({win,mult});if(wfBusy)return;playWF();
}
function playWF(){
  const item=wfQueue.shift();if(!item){wfBusy=false;return}wfBusy=true;
  const{win,mult}=item;
  const showMult=mult&&mult>=1.01&&isFinite(mult);
  const o=h(`<div class="winflash"><span class="wf-lbl">GAGNÉ</span><b class="num">+ ◈ ${fmt(win)}</b>${showMult?`<span class="wf-m">${fmtM(mult)}</span>`:''}</div>`);
  document.body.appendChild(o);
  requestAnimationFrame(()=>o.classList.add('show'));
  const dur=Math.min(2600,1400+Math.log2(1+win)*80);
  setTimeout(()=>{o.classList.remove('show');o.classList.add('hide');setTimeout(()=>{o.remove();playWF()},260)},dur);
}
