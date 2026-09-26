'use strict';
/* ============ Hasard : crypto.getRandomValues ============
   Tous les tirages de jeu passent par rand(). Math.random n'est utilisé que pour
   le décor (rouleaux qui défilent, joueurs fictifs, confettis). */
let rlog=null;
const U32=new Uint32Array(2);
function rand(){crypto.getRandomValues(U32);const v=(U32[0]*2097152+(U32[1]>>>11))/9007199254740992;if(rlog)rlog.push(v);return v}
const randInt=n=>Math.floor(rand()*n);
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=randInt(i+1);[a[i],a[j]]=[a[j],a[i]]}return a}
function pickW(list){let t=0;for(const x of list)t+=x.w;let r=rand()*t;for(const x of list){r-=x.w;if(r<0)return x}return list[list.length-1]}
function rid(){const b=new Uint8Array(5);crypto.getRandomValues(b);return [...b].map(x=>x.toString(16).padStart(2,'0')).join('').toUpperCase()}
const rngStart=()=>{rlog=[]};
const crashDist=()=>{const r=rand();return Math.min(1e6,Math.max(1,Math.floor(96/(1-r))/100))};
function C(n,k){if(k<0||k>n)return 0;let r=1;for(let i=1;i<=k;i++)r=r*(n-k+i)/i;return r}
