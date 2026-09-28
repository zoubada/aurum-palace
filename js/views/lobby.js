'use strict';
/* ============ Lobby ============ */
const HERO_SLIDES=[
 {k:'Nouveau · Poker Éclair',t:'Tournoi à 3,',em:'jusqu’à ×1 000',p:'Choisis ta mise, la roue fixe la dotation, puis affronte deux adversaires en Texas Hold’em. 500 jetons chacun, blindes toutes les 2 minutes.',c:'Jouer au Poker Éclair',h:'#/game/eclair',c2:'Voir les règles',h2:'#/game/eclair',ac:'#FF3A2A',fan:['blackjack','eclair','holdem'],fl:['seven','diamond','bell','clover']},
 {k:'Offre de bienvenue',t:'Le Palace t’offre',em:'10 000 jetons',p:'Machines à sous, roulette, blackjack et nos Originals. 100 % gratuit, sans argent réel, sans inscription.',c:'Jouer à Pharaon d’Or',h:'#/game/pharaon',c2:'Explorer les jeux',h2:'#/games',ac:'#F2B340',fan:['fruit','pharaon','roulette'],fl:['seven','diamond','cherry','bell']},
 {k:'Jackpot progressif',t:'Le Jackpot Aurum',em:'grimpe sans cesse',p:'Aligne cinq couronnes sur une ligne de Pharaon d’Or pour remporter le grand jackpot du Palace.',c:'Tenter le jackpot',h:'#/game/pharaon',c2:'Voir les règles',h2:'#/game/pharaon',ac:'#FF7A2A',fan:['dragon','pharaon','fruit'],fl:['diamond','bell','seven','clover']},
 {k:'Originals Aurum',t:'Crash, Mines, Plinko',em:'nos jeux maison',p:'Des parties rapides, des multiplicateurs jusqu’à ×1 000 et un hasard vérifiable tirage par tirage.',c:'Lancer Crash',h:'#/game/crash',c2:'Tous les Originals',h2:'#/cat/originals',ac:'#8B5CF6',fan:['mines','crash','plinko'],fl:['diamond','die','seven','clover']}];

V.lobby=m=>{
  const recents=S.recent.map(id=>GAMES[id]).filter(Boolean);
  const top=['eclair','pharaon','roulette','blackjack','crash','fruit','mines','plinko','dragon','videopoker'].map(id=>GAMES[id]).filter(Boolean);
  const byCat=k=>GL.filter(g=>g.cat===k);
  const secH=(icon,t,sub,href,id)=>`<div class="sec"><div class="sec-t"><span class="sec-ic">${ic(icon,18)}</span><div><h2>${t}</h2>${sub?`<p>${sub}</p>`:''}</div></div><div class="sec-r">${href?`<a class="sec-all" href="${href}">Tout voir</a>`:''}${id?`<button class="arr" data-sc="${id}" data-d="-1" aria-label="Précédent">${ic('chevl',18)}</button><button class="arr" data-sc="${id}" data-d="1" aria-label="Suivant">${ic('chev',18)}</button>`:''}</div></div>`;
  const row=(icon,t,sub,list,href,id)=>`<section class="lrow">${secH(icon,t,sub,href,id)}<div class="hs" id="${id}">${list.map(gcard).join('')}</div></section>`;
  const tick=Array.from({length:16},fakeWin);
  const L=LEVELS[lvl()],N=LEVELS[lvl()+1],pr=N?Math.max(0,Math.min(1,(S.wagered-L.x)/(N.x-L.x))):1;
  const ms=todaysMissions();const mDone=ms.filter(x=>(S.mis.p[x.id]||0)>=x.n).length;
  const dailyLeft=Math.max(0,S.daily+864e5-Date.now());
  const pod=boardPlayers().sort((a,b)=>b.win-a.win).slice(0,3);
  const catArt={slots:['fruit','pharaon','dragon'],table:['blackjack','eclair','roulette'],originals:['mines','crash','plinko'],instant:['keno','wheel','plinko']};
  const catAc={slots:'#F2B340',table:'#22C58B',originals:'#8B5CF6',instant:'#34D399'};

  m.innerHTML=`
  <section class="hx" aria-roledescription="carrousel" aria-label="À la une">
    ${HERO_SLIDES.map((s,i)=>`<div class="hx-s ${i?'':'on'}" style="--ac:${s.ac}" aria-hidden="${i?'true':'false'}">
      <div class="hx-bg"><i class="hx-rays"></i><i class="hx-orb"></i></div>
      <div class="hx-copy"><span class="kick">${ic('sparkle',14)} ${s.k}</span><h1>${s.t}<em>${s.em}</em></h1><p>${s.p}</p>
        <div class="hx-cta"><a class="btn btn-gold btn-lg" href="${s.h}" tabindex="${i?-1:0}">${ic('play',16)} ${s.c}</a><a class="btn btn-glass btn-lg" href="${s.h2}" tabindex="${i?-1:0}">${s.c2}</a></div>
        <ul class="hx-trust"><li>${ic('check',14)} ${GL.length} jeux</li><li>${ic('check',14)} Aucun argent réel</li><li>${ic('check',14)} Hasard vérifiable</li></ul></div>
      <div class="hx-art">${fan(s.fan,'fan-hero')}${s.fl.map((n,k)=>`<img class="fl fl-${k}" src="${SYM(n)}" alt="" decoding="async">`).join('')}</div>
    </div>`).join('')}
    <div class="hx-nav" role="tablist">${HERO_SLIDES.map((s,i)=>`<button class="${i?'':'on'}" role="tab" aria-label="${s.k}"><span>${s.k}</span><i><b></b></i></button>`).join('')}</div>
  </section>

  <section class="jpm" aria-label="Jackpot progressif">
    <div class="jpm-bg"></div>
    <div class="jpm-l"><span class="jpm-k"><i></i>Grand Jackpot Aurum<i></i></span>
      <div class="odo-w"><span class="od-cur">◈</span><div class="odo" data-jp-odo aria-live="off">${odoHTML(S.jackpot)}</div></div>
      <span class="jpm-s">Remporté en alignant 5 couronnes sur Pharaon d’Or</span></div>
    <div class="jpm-r"><a class="jpm-g" href="#/game/pharaon"><img src="${COVER('pharaon')}" alt="" width="300" height="400"></a><div><a class="btn btn-gold" href="#/game/pharaon">${ic('play',15)} Tenter ma chance</a><span class="live"><b class="num" id="online">2 184</b>&nbsp;joueurs en ligne</span></div></div>
  </section>

  <div class="wins" aria-label="Derniers gains"><span class="wins-l"><i class="dotlive"></i>Gains en direct</span><div class="wins-in"><div class="wins-tr">${[...tick,...tick].map(w=>`<a class="wn" href="#/game/${w.id}" tabindex="-1"><img src="${COVER(w.id)}" alt="" width="30" height="40" loading="lazy"><span class="wn-t"><b>${esc(w.n)}</b><small>${w.g}</small></span><span class="wn-v"><b>+${fmt(w.w)}</b><small>${fmtM(w.m)}</small></span></a>`).join('')}</div></div></div>

  <div class="catx">${Object.entries(CATS).map(([k,c])=>`<a class="ctx" href="#/cat/${k}" style="--ac:${catAc[k]}"><div class="ctx-t"><span class="ctx-ic">${ic(c.i,20)}</span><b>${c.n}</b><span class="ctx-n">${byCat(k).length} jeux<span class="ctx-d"> · ${c.d}</span></span><span class="ctx-go">Explorer ${ic('chev',14)}</span></div>${fan(catArt[k],'fan-cat')}</a>`).join('')}</div>

  ${recents.length?row('clock','Reprendre où tu t’es arrêté','',recents,'#/recent','r-rec'):''}

  <section class="lrow">${secH('fire','Top 10 du Palace','Les jeux les plus lancés cette semaine','#/games','r-top')}
    <div class="hs t10" id="r-top">${top.map((g,i)=>`<div class="t10-i"><span class="t10-n" aria-hidden="true">${i+1}</span>${gcard(g)}</div>`).join('')}</div></section>

  ${row('zap','Originals Aurum','Nos jeux maison, rapides et transparents',byCat('originals'),'#/cat/originals','r-orig')}

  <section class="promo3">
    <a class="pc pc-wheel" href="#/promo"><div class="pc-art"><svg viewBox="-50 -50 100 100" class="pc-wh">${Array.from({length:8},(_,i)=>{const a1=i/8*Math.PI*2,a2=(i+1)/8*Math.PI*2;return `<path d="M0 0L${(Math.cos(a1)*44).toFixed(1)} ${(Math.sin(a1)*44).toFixed(1)}A44 44 0 0 1 ${(Math.cos(a2)*44).toFixed(1)} ${(Math.sin(a2)*44).toFixed(1)}Z" fill="${['#E11D48','#F2B340','#7C3AED','#10B981'][i%4]}" stroke="#FFE9A3" stroke-width="1"/>`}).join('')}<circle r="47" fill="none" stroke="#F2B340" stroke-width="4"/><circle r="9" fill="#F2B340" stroke="#7A4E08" stroke-width="2"/></svg></div>
      <div class="pc-c"><span class="kick">Roue du jour</span><b>${dailyLeft?'Prochain tour dans '+Math.floor(dailyLeft/36e5)+' h '+String(Math.floor(dailyLeft%36e5/6e4)).padStart(2,'0'):'Ton tour gratuit est prêt !'}</b><span class="mu">Jusqu’à ${fmt(5000*L.b)} ◈ offerts</span></div><span class="pc-go">${ic('chev',18)}</span></a>
    <a class="pc pc-mis" href="#/promo"><div class="pc-art pc-ring" style="--p:${mDone/3}"><span>${mDone}/3</span></div>
      <div class="pc-c"><span class="kick">Missions du jour</span><b>${mDone===3?'Toutes accomplies !':'Encore '+(3-mDone)+' mission'+(3-mDone>1?'s':'')}</b><span class="mu">Jusqu’à ${fmt(ms.reduce((a,x)=>a+x.r,0))} ◈ à gagner</span></div><span class="pc-go">${ic('chev',18)}</span></a>
    <a class="pc pc-vip" href="#/vip" style="--lc:${L.c}"><div class="pc-art">${medal(lvl(),64)}</div>
      <div class="pc-c"><span class="kick">Club VIP · ${L.n}</span><b>${N?'Prochain palier : '+N.n:'Sommet atteint'}</b><div class="bar"><i style="width:${pr*100}%"></i></div></div><span class="pc-go">${ic('chev',18)}</span></a>
  </section>

  ${row('slots','Machines à sous','Rouleaux, lignes gagnantes et tours gratuits',byCat('slots'),'#/cat/slots','r-slots')}
  ${row('cards','Jeux de table','Roulette, blackjack, baccarat et poker',byCat('table'),'#/cat/table','r-table')}
  ${row('ticket','Jeux instantanés','Keno, roue et cartes à gratter',byCat('instant'),'#/cat/instant','r-inst')}

  <section class="podx"><div class="podx-c"><span class="kick">${ic('trophy',14)} Classement de la semaine</span><h2>Les rois du Palace</h2><p class="mu">Plus gros gains de la semaine. Remis à zéro chaque lundi.</p><a class="btn btn-glass" href="#/board">Voir le classement</a></div>
    <div class="pod">${[1,0,2].map(k=>{const p=pod[k];return `<div class="pod-i p${k+1}"><span class="pod-av">${p.a}</span><b>${esc(p.n)}</b><span class="num">◈ ${fmt(p.win)}</span><div class="pod-b"><span>${k+1}</span></div></div>`}).join('')}</div></section>`;

  bindFavs(m);
  $$('.arr',m).forEach(b=>b.addEventListener('click',()=>{const el=$('#'+b.dataset.sc,m);el.scrollBy({left:+b.dataset.d*el.clientWidth*.8,behavior:'smooth'})}));
  const hs=$('.hx',m),sl=$$('.hx-s',m),nb=$$('.hx-nav button',m);let si=0,t0=performance.now(),paused=false,raf;const DUR=7000;
  const show=i=>{si=i;t0=performance.now();sl.forEach((s,k)=>{s.classList.toggle('on',k===i);s.setAttribute('aria-hidden',k===i?'false':'true');$$('a',s).forEach(a=>a.tabIndex=k===i?0:-1)});nb.forEach((d,k)=>{d.classList.toggle('on',k===i);$('b',d).style.width='0%'})};
  nb.forEach((d,i)=>d.addEventListener('click',()=>show(i)));
  hs.addEventListener('mouseenter',()=>{paused=true});hs.addEventListener('mouseleave',()=>{paused=false;t0=performance.now()-(parseFloat($('b',nb[si]).style.width)||0)/100*DUR});
  const loop=now=>{if(!paused){const p=Math.min(1,(now-t0)/DUR);$('b',nb[si]).style.width=(p*100)+'%';if(p>=1)show((si+1)%sl.length)}raf=requestAnimationFrame(loop)};raf=requestAnimationFrame(loop);
  hs.addEventListener('pointermove',e=>{const r=hs.getBoundingClientRect();hs.style.setProperty('--mx',((e.clientX-r.left)/r.width-.5).toFixed(3));hs.style.setProperty('--my',((e.clientY-r.top)/r.height-.5).toFixed(3))});
  let on=2184;const iv2=setInterval(()=>{on=Math.max(1700,Math.min(2900,on+Math.round((Math.random()-.48)*40)));const o=$('#online');if(o)o.textContent=on.toLocaleString('fr-FR')},2500);
  const iv3=setInterval(()=>{const w=fakeWin();if(w.m>=8)toast(`<b>${esc(w.n)}</b> vient de gagner <span class="gold">◈ ${fmt(w.w)}</span> sur ${w.g} (${fmtM(w.m)})`)},38000);
  destroy=()=>{cancelAnimationFrame(raf);clearInterval(iv2);clearInterval(iv3)};
};
