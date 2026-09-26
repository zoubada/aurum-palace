'use strict';
/* ============ En-tête : icônes et interactions ============ */
$('#logo-mark').innerHTML=LOGO(30);
$('#hs-ic').innerHTML=ic('search',16);
$('#bal-add').innerHTML=ic('plus',16);
$('#btn-gift').innerHTML=ic('gift');
renderAvatar();
function paintSound(){$('#btn-snd').innerHTML=ic(S.sound?'vol':'mute')}
paintSound();
$('#btn-snd').addEventListener('click',()=>{S.sound=!S.sound;save();paintSound();if(S.sound)snd('click');toast(S.sound?'Son activé':'Son coupé')});
$('#btn-gift').addEventListener('click',()=>{location.hash='#/promo'});
$('#bal-v').textContent=fmt(S.balance);
function paintEye(){$('#bal-eye').innerHTML=ic(S.hideBal?'eyeoff':'eye',15);$('#bal-eye').setAttribute('aria-label',S.hideBal?'Afficher le solde':'Masquer le solde')}
paintEye();
$('#bal-eye').addEventListener('click',()=>{S.hideBal=!S.hideBal;save();paintEye();renderBal();snd('click')});
function doSearch(v){v=v.trim();if(!v)return;location.hash='#/games/'+encodeURIComponent(v)}
$('#hsearch').addEventListener('keydown',e=>{if(e.key==='Enter'){doSearch(e.target.value);e.target.blur()}});

/* ============ Jackpot progressif (décor global, croît en continu) ============ */
setInterval(()=>{S.jackpot=r2(S.jackpot+ (5+Math.random()*35));save();$$('[data-jp]').forEach(el=>el.textContent='◈ '+fmt(S.jackpot))},2600);

/* ============ Raccourci clavier : Espace = action principale ============ */
addEventListener('keydown',e=>{
  if(e.code!=='Space')return;
  const t=e.target;if(t&&(t.tagName==='INPUT'||t.tagName==='SELECT'||t.tagName==='TEXTAREA'))return;
  const btn=$('#stage #spin:not(:disabled)')||$('#stage #go:not(:disabled)');
  if(btn){e.preventDefault();btn.click()}
});

/* ============ Rappel de pause toutes les 60 minutes ============ */
setInterval(()=>{
  if(Date.now()-sess.lastPause>=3600000){sess.lastPause=Date.now();modal(`<div style="font-size:40px">⏱️</div><h3 class="mt">Une pause ?</h3><p class="mp">Tu joues depuis plus d’une heure. Le Palace t’encourage à souffler un peu — il sera toujours là.</p><button class="btn btn-gold btn-big" data-close>Continuer à jouer</button>`)}
},60000);

/* ============ Modale d'accueil ============ */
function welcome(){
  const m=modal(`<div style="font-size:52px">${LOGO(64)}</div><h3 class="mt">Bienvenue au Palace</h3><p class="mp">10 000 jetons ◈ t’attendent pour découvrir nos machines à sous, nos tables et nos Originals — sans jamais dépenser un centime.</p>
  <div class="big gtext">+ 10 000 ◈</div>
  <label class="chk"><input type="checkbox" id="ok18" required><span>J’ai 18 ans ou plus et je comprends qu’il s’agit d’un jeu gratuit à but de divertissement, sans mise ni gain en argent réel.</span></label>
  <button class="btn btn-gold btn-big" id="wgo" disabled>Entrer au Palace</button>`,{dismiss:false});
  const ck=$('#ok18',m.el),go=$('#wgo',m.el);
  ck.addEventListener('change',()=>go.disabled=!ck.checked);
  go.addEventListener('click',()=>{S.welcomed=true;save();confetti(80,true);snd('big');m.close()});
}

/* ============ Démarrage ============ */
renderBal();
go();
if(!S.welcomed)setTimeout(welcome,500);
setTimeout(()=>{$('#loader').classList.add('out');setTimeout(()=>$('#loader').remove(),550)},650);
