'use strict';
/* ============ Composants de mise ============ */
const fmtIn=x=>String(r2(x)).replace('.',',');
function betCtl(gid,def=100,{label='Mise'}={}){
  let v=S.bets[gid]!=null?S.bets[gid]:def;
  const el=h(`<div class="betctl"><div class="lbl"><span>${label}</span><span class="mu2">Solde : <span class="bb num"></span> ◈</span></div><div class="row"><button type="button" data-a="half" aria-label="Diviser la mise par deux">½</button><div class="inp"><span class="gold">◈</span><input type="text" inputmode="decimal" aria-label="${label}"></div><button type="button" data-a="dbl" aria-label="Doubler la mise">×2</button><button type="button" data-a="min">Min</button><button type="button" data-a="max">Max</button></div></div>`);
  const inp=$('input',el),bb=$('.bb',el);
  const upd=()=>{bb.textContent=fmt(S.balance)};upd();document.addEventListener('bal',upd);
  const set=x=>{if(!isFinite(x))x=v;x=r2(Math.max(1,Math.min(x,Math.max(1,S.balance))));v=x;inp.value=fmtIn(x);S.bets[gid]=x;save()};
  inp.value=fmtIn(v);
  inp.addEventListener('change',()=>set(parseNum(inp.value)));
  $$('button',el).forEach(b=>b.addEventListener('click',()=>{snd('click');const a=b.dataset.a;set(a==='half'?v/2:a==='dbl'?v*2:a==='min'?1:S.balance)}));
  return{el,get(){const x=parseNum(inp.value);if(isFinite(x)&&x>0&&x!==v){v=r2(x);S.bets[gid]=v}return v},set,lock(b){inp.disabled=b;$$('button',el).forEach(x=>x.disabled=b)},off(){document.removeEventListener('bal',upd)}};
}
const CHIPS=[{v:5,c:'#64748B'},{v:25,c:'#16A34A'},{v:100,c:'#1F2937'},{v:500,c:'#7C3AED'},{v:1000,c:'#B45309'},{v:5000,c:'#BE123C'}];
const chipLbl=v=>v>=1000?(v/1000)+'K':String(v);
function chipSel(gid){let cur=S.chip[gid]||100;const el=h(`<div class="chipsel" role="radiogroup" aria-label="Valeur du jeton">${CHIPS.map(c=>`<button type="button" class="cp ${c.v===cur?'on':''}" data-v="${c.v}" style="background:${c.c}" role="radio" aria-checked="${c.v===cur}" aria-label="Jeton ${c.v}">${chipLbl(c.v)}</button>`).join('')}</div>`);$$('.cp',el).forEach(b=>b.addEventListener('click',()=>{cur=+b.dataset.v;S.chip[gid]=cur;save();snd('chip');$$('.cp',el).forEach(x=>{x.classList.toggle('on',x===b);x.setAttribute('aria-checked',x===b)})}));return{el,get:()=>cur}}
const chipMark=v=>v>0?`<span class="chipmark">${v>=1000?(Math.round(v/100)/10+'K').replace('.',','):fmt(v)}</span>`:'';
