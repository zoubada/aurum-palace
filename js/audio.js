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
    }
  }catch(e){}
}
