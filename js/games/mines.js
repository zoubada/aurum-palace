'use strict';
/* ============ Mines ============ */
reg({id:'mines',name:'Mines',cat:'originals',rtp:'95 %',vol:'Haute',badge:null,pop:82,
  bg:'radial-gradient(circle at 50% 30%,#3a2a08,#120d02)',glyph:ic('bomb',64),
  init(stage){
    stage.innerHTML=`<div class="orig-stage" style="--orig-accent:#EF4444"><div class="orig-glow"></div>
    <div class="infos"><div><b id="mmult">1,00×</b><span>Multiplicateur</span></div><div><b id="mpot">◈ 0</b><span>Gain potentiel</span></div><div><b id="mopen">0</b><span>Cases sûres</span></div></div>
    <div class="mgrid" id="grid"></div>
    <div class="msg" id="msg">&nbsp;</div>
    <div class="ctrl wide">
      <div><div class="ctrl-row" id="betrow"></div>
      <label class="field" style="margin-top:10px">Nombre de mines<select class="sel" id="nmines" style="width:100%">${Array.from({length:24},(_,i)=>i+1).map(n=>`<option value="${n}" ${n===3?'selected':''}>${n} mine${n>1?'s':''}</option>`).join('')}</select></label></div>
      <button class="btn btn-gold btn-big" id="go" style="height:64px">Miser</button>
    </div></div>`;
    const bc=betCtl('mines',100);$('#betrow',stage).appendChild(bc.el);
    const grid=$('#grid',stage),go=$('#go',stage),msg=$('#msg',stage),nsel=$('#nmines',stage);
    const mmult=$('#mmult',stage),mpot=$('#mpot',stage),mopen=$('#mopen',stage);
    let cells=[],mines=new Set(),opened=new Set(),phase='idle',bet=0,nMines=3,revealed=0;
    function multFor(k,m){ // multiplicateur après k cases sûres révélées, avec m mines
      if(k===0)return 1;
      let p=1;for(let i=0;i<k;i++)p*= (25-i)/(25-m-i);return p*0.95;
    }
    function build(){grid.innerHTML='';for(let i=0;i<25;i++){const b=h(`<button class="mc" data-i="${i}" aria-label="Case ${i+1}"></button>`);grid.appendChild(b)}}
    build();
    function updateHud(){mmult.textContent=fmtM(r2(multFor(revealed,nMines)));mpot.textContent='◈ '+fmt(r2(bet*multFor(revealed,nMines)));mopen.textContent=revealed}
    grid.addEventListener('click',e=>{const b=e.target.closest('.mc');if(b)reveal(+b.dataset.i)});
    go.addEventListener('click',()=>{
      if(phase==='play'){cashout();return}
      const b=bc.get();if(!canBet(b))return;
      bet=b;take(bet);bc.lock(true);nMines=+nsel.value;nsel.disabled=true;
      rngStart();mines=new Set();while(mines.size<nMines)mines.add(randInt(25));
      opened=new Set();revealed=0;phase='play';build();updateHud();
      go.textContent='Encaisser';go.className='btn btn-green btn-big';go.style.height='64px';
      msg.textContent='Choisis une case sûre.';msg.className='msg';
    });
    function reveal(i){
      if(phase!=='play'||opened.has(i))return;
      opened.add(i);const cell=$(`.mc[data-i="${i}"]`,grid);
      if(mines.has(i)){
        cell.classList.add('bomb');cell.innerHTML=ic('bomb',22);snd('boom');
        for(let k=0;k<25;k++)if(mines.has(k)&&k!==i){const c=$(`.mc[data-i="${k}"]`,grid);c.innerHTML=ic('bomb',22);c.classList.add('ghost')}
        phase='done';msg.textContent='Boum — Perdu';msg.className='msg l';
        record('mines',bet,0,`${nMines} mines, ${revealed} cases sûres`);
        endRound();return;
      }
      cell.classList.add('gem');cell.innerHTML=ic('gem',22);snd('gem');revealed++;updateHud();
      if(revealed===20)unlock('m20');
      if(revealed===25-nMines){cashout();return}
    }
    function cashout(){
      if(phase!=='play')return;const win=r2(bet*multFor(revealed,nMines));give(win);snd(win/bet>=10?'big':'win');
      phase='done';msg.textContent=`Encaissé — Gagné ◈ ${fmt(win)}`;msg.className='msg w';
      for(let k=0;k<25;k++)if(mines.has(k)){const c=$(`.mc[data-i="${k}"]`,grid);c.innerHTML=ic('bomb',22);c.classList.add('ghost')}
      record('mines',bet,win,`${nMines} mines, ${revealed} cases sûres`);endRound();
    }
    function endRound(){bc.lock(false);nsel.disabled=false;go.textContent='Miser';go.className='btn btn-gold btn-big';go.style.height='64px';}
    return()=>{};
  },
  rules:()=>`<h4>Mines</h4><p>Une grille de 5 × 5 cases cache un nombre de mines que tu choisis (1 à 24). Révèle des cases sûres pour faire grimper le multiplicateur, et encaisse à tout moment avant de tomber sur une mine.</p>
  <p>Plus il y a de mines, plus chaque case sûre rapporte gros — mais plus le risque est élevé.</p>
  <p class="mu2" style="font-size:12px">RTP théorique ≈ 95 %, quel que soit le nombre de mines choisi.</p>`});

