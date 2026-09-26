'use strict';
/* ============ Utilitaires ============ */
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const h=html=>{const t=document.createElement('template');t.innerHTML=html.trim();return t.content.firstElementChild};
const r2=n=>Math.round(n*100)/100;
const fmt=n=>{n=r2(n);return Number.isInteger(n)?n.toLocaleString('fr-FR'):n.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})};
const fmtM=m=>m.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+'×';
const fmtP=p=>(p*100).toLocaleString('fr-FR',{maximumFractionDigits:2})+' %';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const parseNum=s=>parseFloat(String(s).replace(/\s|\u202f|\u00a0/g,'').replace(',','.'));
const REDUCED=matchMedia('(prefers-reduced-motion: reduce)').matches;
