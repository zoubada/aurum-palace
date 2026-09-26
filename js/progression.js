'use strict';
/* ============ VIP, missions, succès ============ */
const LEVELS=[
 {n:'Bronze',x:0,c:'#CD7F32',b:1,cb:0,p:['Bonus quotidien standard','Missions quotidiennes']},
 {n:'Argent',x:25000,c:'#C0C7D1',b:1.5,cb:.005,p:['Bonus quotidien ×1,5','Cashback 0,5 % des pertes']},
 {n:'Or',x:100000,c:'#D4AF37',b:2,cb:.01,p:['Bonus quotidien ×2','Cashback 1 %','Badge Or sur le profil']},
 {n:'Platine',x:500000,c:'#A5E4E0',b:3,cb:.02,p:['Bonus quotidien ×3','Cashback 2 %']},
 {n:'Diamant',x:2000000,c:'#7DD3FC',b:5,cb:.03,p:['Bonus quotidien ×5','Cashback 3 %']},
 {n:'Aurum',x:10000000,c:'#F5D76E',b:10,cb:.05,p:['Bonus quotidien ×10','Cashback 5 %','Statut légendaire']}];
const lvl=()=>{let i=0;LEVELS.forEach((l,k)=>{if(S.wagered>=l.x)i=k});return i};
let lastLvl=lvl();
function vipCheck(){const l=lvl();if(l>lastLvl){lastLvl=l;toast(`Nouveau niveau VIP : <b style="color:${LEVELS[l].c}">${LEVELS[l].n}</b>`,'win');snd('big');confetti();if(l>=2)unlock('vip');renderAvatar()}}

const MPOOL=[
 {id:'bj20',t:'Joue 20 mains de blackjack',n:20,r:1500,f:e=>e.g==='blackjack'?1:0},
 {id:'slot50',t:'Fais 50 spins aux machines à sous',n:50,r:2000,f:e=>GAMES[e.g]&&GAMES[e.g].cat==='slots'?1:0},
 {id:'x5',t:'Gagne ×5 ou plus sur un Original',n:1,r:2500,f:e=>GAMES[e.g]&&GAMES[e.g].cat==='originals'&&e.mult>=5?1:0},
 {id:'wag5k',t:'Mise 5 000 ◈ au total',n:5000,r:1000,f:e=>e.bet},
 {id:'rou10',t:'Joue 10 tours de roulette',n:10,r:1200,f:e=>e.g==='roulette'?1:0},
 {id:'win10',t:'Remporte 10 parties gagnantes',n:10,r:1500,f:e=>e.win>e.bet?1:0},
 {id:'crash3',t:'Encaisse à ×3 ou plus au Crash',n:1,r:1500,f:e=>e.g==='crash'&&e.mult>=3?1:0},
 {id:'keno15',t:'Joue 15 tirages de Keno',n:15,r:1200,f:e=>e.g==='keno'?1:0},
 {id:'plinko30',t:'Lâche 30 billes au Plinko',n:30,r:1200,f:e=>e.g==='plinko'?1:0},
 {id:'games4',t:'Essaie 4 jeux différents aujourd’hui',n:4,r:1500,f:e=>0}
];
function todaysMissions(){if(S.mis.day!==today())S.mis={day:today(),p:{},c:{},g:[]};S.mis.g=S.mis.g||[];let x=0;for(const c of today())x=(x*31+c.charCodeAt(0))>>>0;const pool=[...MPOOL],out=[];for(let i=0;i<3;i++){x=(Math.imul(x,1103515245)+12345)>>>0;out.push(pool.splice(x%pool.length,1)[0])}return out}
function missionTick(e){const ms=todaysMissions();if(!S.mis.g.includes(e.g))S.mis.g.push(e.g);for(const m of ms){if(S.mis.c[m.id])continue;const before=S.mis.p[m.id]||0;const now=m.id==='games4'?S.mis.g.length:Math.min(m.n,before+m.f(e));S.mis.p[m.id]=Math.min(m.n,now);if(before<m.n&&S.mis.p[m.id]>=m.n)toast(`Mission accomplie : ${m.t}. <a href="#/promo" class="gold">Récupère ${fmt(m.r)} ◈</a>`,'win')}}

const ACH={
 first:{n:'Premier gain',d:'Gagne ta première partie',i:'🥇'},
 bj:{n:'Blackjack !',d:'Obtiens un blackjack naturel',i:'🃏'},
 c100:{n:'Vers la Lune',d:'Encaisse ×100 au Crash',i:'🚀'},
 r100:{n:'Habitué',d:'Joue 100 parties',i:'🎰'},
 r1000:{n:'Légende du Palace',d:'Joue 1 000 parties',i:'🏛️'},
 x50:{n:'Coup de maître',d:'Gagne ×50 ou plus en une partie',i:'💥'},
 zero:{n:'Le Zéro',d:'Gagne un plein sur le 0',i:'🟢'},
 royal:{n:'Quinte royale',d:'Quinte flush royale au vidéo poker',i:'👑'},
 m20:{n:'Démineur',d:'Révèle 20 cases sûres au Mines',i:'💎'},
 vip:{n:'Membre Or',d:'Atteins le niveau VIP Or',i:'⭐'},
 ten:{n:'Explorateur',d:'Joue à 10 jeux différents',i:'🧭'},
 fs:{n:'Faveur du Pharaon',d:'Déclenche les tours gratuits',i:'☀️'},
 jp:{n:'Jackpot !',d:'Remporte le Jackpot Aurum',i:'🏆'}};
function unlock(id){if(S.ach[id]||!ACH[id])return;S.ach[id]=Date.now();save();const a=ACH[id];setTimeout(()=>{toast(`${a.i} Succès débloqué : <b>${a.n}</b>`,'win');snd('coin')},900)}

/* ============ Historique des parties ============ */
function record(g,bet,win,info=''){
  bet=r2(bet);win=r2(win);const mult=bet>0?win/bet:0;
  const e={id:rid(),t:Date.now(),g,bet,win,mult:r2(mult),info,rng:(rlog||[]).slice(0,10).map(v=>v.toFixed(6))};rlog=null;
  S.hist.unshift(e);if(S.hist.length>150)S.hist.length=150;
  S.rounds++;S.played[g]=(S.played[g]||0)+1;
  const sg=sess.g[g]||(sess.g[g]={bet:0,win:0,n:0});sg.bet+=bet;sg.win+=win;sg.n++;
  if(win>S.best.win)S.best={...S.best,win,game:g};
  if(bet>0&&mult>S.best.mult)S.best.mult=r2(mult);
  const rate=LEVELS[lvl()].cb;if(rate&&win<bet)S.cb=r2((S.cb||0)+(bet-win)*rate);
  missionTick(e);
  if(win>bet&&bet>0)unlock('first');
  if(S.rounds>=100)unlock('r100');if(S.rounds>=1000)unlock('r1000');
  if(bet>0&&mult>=50)unlock('x50');
  if(Object.keys(S.played).length>=10)unlock('ten');
  if(bet>0&&mult>=15)bigWin(win,mult);
  else if(win>0)winFlash(win,bet>0?mult:0);
  save();vipCheck();
  document.dispatchEvent(new CustomEvent('round',{detail:e}));
  return e;
}

