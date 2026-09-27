'use strict';
/* ============ État persistant ============ */
const KEY='aurum_palace_v1';
const today=()=>{const d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()};
const DEF=()=>({name:'Joueur',avatar:'🦁',balance:10000,wagered:0,won:0,rounds:0,best:{win:0,mult:0,game:''},fav:[],recent:[],hist:[],daily:0,refill:'',ach:{},played:{},mis:{day:'',p:{},c:{}},welcomed:false,sound:true,hideBal:false,lim:{time:0,wager:0},jackpot:487250,bets:{},chip:{},rh:[],bh:[],cb:0,pk:null,pkStats:{},autoSpins:10});
let S=DEF();
try{const raw=localStorage.getItem(KEY);if(raw){const o=JSON.parse(raw);S=Object.assign(DEF(),o);S.best=Object.assign(DEF().best,o.best||{});S.lim=Object.assign(DEF().lim,o.lim||{});S.mis=Object.assign(DEF().mis,o.mis||{})}}catch(e){}
let saveT;
function save(){clearTimeout(saveT);saveT=setTimeout(()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}},200)}
addEventListener('pagehide',()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}});
const sess={start:Date.now(),wag:0,won:0,g:{},lastPause:Date.now()};
