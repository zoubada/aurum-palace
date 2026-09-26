'use strict';
/* ============ Roue générique (SVG) ============ */
function wheelSVG(segs,{r=140,inner=0,font=11,id='w'}={}){const totW=segs.reduce((a,s)=>a+(s.w2||1),0);const pt=(rad,deg)=>[rad*Math.sin(deg*Math.PI/180),-rad*Math.cos(deg*Math.PI/180)];
  let acc=0,s=`<g id="${id}" style="transform-origin:0 0">`;
  segs.forEach(g=>{const w=g.w2||1;const width=w/totW*360;const center=acc/totW*360;acc+=w;const t1=center-width/2,t2=center+width/2;const large=width>180?1:0;
    const[x1,y1]=pt(r,t1),[x2,y2]=pt(r,t2),[x3,y3]=pt(inner,t2),[x4,y4]=pt(inner,t1);
    s+=`<path d="M${x1.toFixed(2)} ${y1.toFixed(2)}A${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}L${x3.toFixed(2)} ${y3.toFixed(2)}${inner?`A${inner} ${inner} 0 ${large} 0 ${x4.toFixed(2)} ${y4.toFixed(2)}`:''}Z" fill="${g.c}" stroke="rgba(0,0,0,.35)" stroke-width="1"/><text transform="rotate(${center}) translate(0 ${-(r-(r-inner)*.42)})" text-anchor="middle" dominant-baseline="middle" font-size="${g.fs||font}" font-weight="800" fill="${g.tc||'#fff'}" font-family="Inter,sans-serif">${g.l}</text>`});
  return s+'</g>'}
function wheelCenterAngle(segs,idx){const totW=segs.reduce((a,s)=>a+(s.w2||1),0);let acc=0;for(let i=0;i<idx;i++)acc+=(segs[i].w2||1);return acc/totW*360}
function wheelPick(segs){let t=0;for(const s of segs)t+=(s.w2||1);let r=rand()*t;for(let i=0;i<segs.length;i++){r-=(segs[i].w2||1);if(r<0)return i}return segs.length-1}
