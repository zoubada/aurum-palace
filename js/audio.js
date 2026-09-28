'use strict';
/* ============ Sons (Web Audio, synthétisés) ============ */
let AC;
function snd(type){
  if(!S.sound)return;
  try{
    AC=AC||new (window.AudioContext||window.webkitAudioContext)();
    if(AC.state==='suspended')AC.resume();
    const t=AC.currentTime;
    const tone=(f,d,o='sine',v=.07,dl=0,f2)=>{const os=AC.createOscillator(),g=AC.createGain();os.type=o;os.frequency.setValueAtTime(f,t+dl);if(f2)os.frequency.exponentialRampToValueAtTime(f2,t+dl+d);g.gain.setValueAtTime(v,t+dl);g.gain.exponentialRampToValueAtTime(.0001,t+dl+d);os.connect(g).connect(AC.destination);os.start(t+dl);os.stop(t+dl+d+.02)};
    /* Souffle filtré (vagues, tonnerre, dé) */
    const noise=(d,v=.05,f1=800,f2,dl=0,q=1)=>{const n=Math.ceil(AC.sampleRate*d),b=AC.createBuffer(1,n,AC.sampleRate),x=b.getChannelData(0);for(let i=0;i<n;i++)x[i]=Math.random()*2-1;const src=AC.createBufferSource(),f=AC.createBiquadFilter(),g=AC.createGain();src.buffer=b;f.type='bandpass';f.Q.value=q;f.frequency.setValueAtTime(f1,t+dl);if(f2)f.frequency.exponentialRampToValueAtTime(f2,t+dl+d);g.gain.setValueAtTime(.0001,t+dl);g.gain.exponentialRampToValueAtTime(v,t+dl+Math.min(.08,d/4));g.gain.exponentialRampToValueAtTime(.0001,t+dl+d);src.connect(f).connect(g).connect(AC.destination);src.start(t+dl);src.stop(t+dl+d+.02)};
    switch(type){
      case'click':tone(880,.05,'triangle',.04);break;
      case'chip':tone(2200,.03,'square',.025);tone(1500,.05,'triangle',.03,.02);break;
      case'tick':tone(1300,.025,'square',.018);break;
      case'stop':tone(160,.09,'triangle',.08);break;
      case'card':tone(2400,.03,'triangle',.025);tone(700,.05,'sine',.03,.01,300);break;
      case'win':[523,659,784,1047].forEach((f,i)=>tone(f,.28,'triangle',.07,i*.08));break;
      case'big':[523,659,784,1047,1319,1568].forEach((f,i)=>tone(f,.4,'triangle',.08,i*.09));tone(262,.9,'sine',.06,.1);break;
      case'lose':tone(330,.22,'sawtooth',.03,0,200);tone(220,.3,'sawtooth',.03,.14,130);break;
      case'boom':tone(140,.6,'sawtooth',.09,0,40);tone(90,.7,'square',.05,.05,30);break;
      case'gem':tone(1200,.12,'sine',.06,0,1800);break;
      case'coin':tone(1800,.06,'square',.03);tone(2600,.12,'triangle',.04,.05);break;
      case'door':tone(70,.5,'sawtooth',.05,0,45);tone(110,.35,'triangle',.04,.05,60);break;
      case'torch':tone(300,.25,'sine',.05,0,900);tone(600,.3,'triangle',.04,.08,1400);break;
      case'bonus':[392,523,659,784,1047].forEach((f,i)=>tone(f,.5,'triangle',.07,i*.12));tone(196,1.2,'sine',.06,0);tone(98,1.4,'sawtooth',.03,.05,90);break;
      case'suck':tone(260,.32,'sine',.045,0,1100);break;
      /* Atlantide */
      case'atl-drop':tone(150,.1,'sine',.06,0,70);noise(.08,.02,500,250);break;
      case'atl-antic':tone(220,1.1,'sine',.035,0,660);tone(330,1.1,'triangle',.02,.05,990);break;
      case'atl-win':[587,740,880,1175].forEach((f,i)=>tone(f,.3,'triangle',.06,i*.07));tone(1760,.25,'sine',.025,.28,2350);break;
      case'atl-casc':[659,831,988,1319,1661].forEach((f,i)=>tone(f,.26,'triangle',.055,i*.06));break;
      case'atl-pop':noise(.18,.05,1800,600,0,2);tone(900,.12,'sine',.03,0,1600);break;
      case'atl-kraken':tone(62,1.2,'sawtooth',.07,0,38);tone(93,1,'square',.03,.1,50);noise(1,.06,300,120);break;
      case'atl-splash':noise(.22,.05,1200,300,0,1.5);tone(400,.1,'sine',.03,0,180);break;
      case'atl-wave':noise(.9,.07,300,2400,0,.8);tone(180,.7,'sine',.035,0,520);break;
      case'atl-scat':tone(233,.9,'sawtooth',.03,0,349);tone(349,.9,'triangle',.05,.06);tone(466,.8,'triangle',.035,.3);break;
      case'atl-pearl':tone(1568,.2,'sine',.05);tone(2349,.3,'sine',.035,.06);break;
      case'atl-frag':tone(700,.1,'triangle',.035,0,1400);noise(.1,.02,3000,5000);break;
      case'atl-roll':noise(.6,.03,600,1800,0,1);break;
      case'atl-collect':[880,1175,1568,2093].forEach((f,i)=>tone(f,.18,'sine',.04,i*.05));break;
      case'atl-jp':[523,784,1047,1568,2093].forEach((f,i)=>tone(f,.45,'triangle',.06,i*.09));tone(131,1,'sine',.05);break;
      case'atl-thunder':noise(1.4,.06,180,60,0,.7);tone(45,1.2,'sine',.05,.05,30);break;
      case'atl-dice':for(let i=0;i<6;i++)noise(.05,.04,2500,1500,i*.07,2);break;
      case'atl-step':tone(520,.06,'triangle',.035,0,760);break;
      case'atl-chest':tone(300,.25,'triangle',.05,0,600);noise(.3,.03,900,400);break;
    }
  }catch(e){}
}
