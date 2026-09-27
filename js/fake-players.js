'use strict';
/* ============ Joueurs fictifs (décor) ============ */
const NAMES=['LuckyMarco','Sofia_V','ZenPlayer','Kaori88','TheBaron','Nina.R','AceHunter','Leo_Monaco','Mila777','Viktor','GoldRush','Ines_K','BlueFalcon','Hugo.D','Yuki','CasinoQueen','Tom_B','Aria','MaxRoyale','Lina_S','Rafa21','Chloé_M','Noah.P','Emma_Lux','NightOwl','Sasha','Oscar_V','Jade','Diego','Lou_G','Kenji','Clara.B'];
const rname=()=>NAMES[Math.floor(Math.random()*NAMES.length)];
function fakeWin(){const g=GL[Math.floor(Math.random()*GL.length)];const m=[1.5,2,2.4,3,5,8,12,20,35,50,100,250][Math.floor(Math.random()**2.2*12)];const bet=[10,25,50,100,200,500,1000,2500][Math.floor(Math.random()*8)];return{n:rname(),g:g.name,id:g.id,m,w:bet*m}}
