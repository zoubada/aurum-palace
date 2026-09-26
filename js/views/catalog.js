'use strict';
/* ============ Listes de jeux ============ */
function listView(m,{title,sub,list,filters=true,search=false,empty,q:q0=''}){
  m.innerHTML=`<h1 class="ph">${title}</h1><p class="psub">${sub}</p>
  ${search?`<label class="hsearch" style="display:flex;margin:0 0 14px;max-width:none">${ic('search',18)}<input id="lsearch" type="search" placeholder="Rechercher un jeu" autocomplete="off"></label>`:''}
  ${filters?`<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:16px"><div class="chips" id="fv">${['Toutes','Faible','Moyenne','Haute','Réglable'].map((v,i)=>`<button class="chip ${i?'':'on'}" data-v="${v}">${i?'Volatilité '+v.toLowerCase():'Toutes volatilités'}</button>`).join('')}</div><select class="sel" id="fs" aria-label="Trier"><option value="pop">Populaires</option><option value="az">A à Z</option><option value="new">Nouveautés</option><option value="rtp">RTP le plus haut</option></select></div>`:''}
  <div class="ggrid" id="gg"></div>`;
  let vol='Toutes',sort='pop',q=q0;
  const rtpN=g=>parseFloat(g.rtp.replace(',','.').replace(/[^\d.]/g,''))||0;
  const draw=()=>{let L=list.filter(g=>(vol==='Toutes'||g.vol===vol)&&(!q||g.name.toLowerCase().includes(q.toLowerCase())||CATS[g.cat].n.toLowerCase().includes(q.toLowerCase())));
    if(sort==='az')L=[...L].sort((a,b)=>a.name.localeCompare(b.name,'fr'));if(sort==='new')L=[...L].sort((a,b)=>(b.badge==='new')-(a.badge==='new'));if(sort==='rtp')L=[...L].sort((a,b)=>rtpN(b)-rtpN(a));if(sort==='pop')L=[...L].sort((a,b)=>(b.pop||0)-(a.pop||0));
    $('#gg',m).innerHTML=L.length?L.map(gcard).join(''):`<div class="empty" style="grid-column:1/-1">${empty||'<b>Aucun jeu ne correspond</b>Essaie un autre filtre ou un autre mot-clé.'}</div>`;bindFavs(m)};
  if(filters){$$('#fv .chip',m).forEach(c=>c.addEventListener('click',()=>{vol=c.dataset.v;$$('#fv .chip',m).forEach(x=>x.classList.toggle('on',x===c));draw()}));$('#fs',m).addEventListener('change',e=>{sort=e.target.value;draw()})}
  if(search){const i=$('#lsearch',m);i.value=q;i.addEventListener('input',()=>{q=i.value;draw()});if(q)i.focus()}
  draw();
}
V.games=(m,arg)=>listView(m,{title:'Tous les jeux',sub:`${GL.length} jeux jouables avec tes jetons ◈.`,list:GL,search:true,q:arg?decodeURIComponent(arg):''});
V.cat=(m,k)=>{const c=CATS[k]||CATS.slots;listView(m,{title:c.n,sub:c.d+'.',list:GL.filter(g=>g.cat===(CATS[k]?k:'slots'))})};
V.fav=m=>listView(m,{title:'Favoris',sub:'Touche le cœur d’un jeu pour le retrouver ici.',list:S.fav.map(id=>GAMES[id]).filter(Boolean),filters:false,empty:'<b>Aucun favori pour l’instant</b>Ajoute un jeu avec le cœur en haut à droite de sa vignette.'});
V.recent=m=>listView(m,{title:'Récemment joués',sub:'Tes derniers jeux, du plus récent au plus ancien.',list:S.recent.map(id=>GAMES[id]).filter(Boolean),filters:false,empty:'<b>Tu n’as encore rien joué</b><a class="gold" href="#/lobby">Choisis un jeu dans le lobby</a>.'});

/* ============ Page de jeu ============ */
const when=t=>{const d=new Date(t);return d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})};
V.game=(m,id)=>{
  const g=GAMES[id];if(!g){location.hash='#/lobby';return}
  S.recent=[id,...S.recent.filter(x=>x!==id)].slice(0,12);save();
  m.innerHTML=`<div class="gp-head"><a class="hbtn" href="#/lobby" aria-label="Retour au lobby">${ic('back')}</a><div class="gp-t"><h1>${g.name}</h1><span>${CATS[g.cat].n} · RTP ${g.rtp} · Volatilité ${g.vol.toLowerCase()}</span></div><button class="hbtn fav ${isFav(id)?'on':''}" id="gfav" aria-label="Favori">${ic('heart')}</button></div>
  <div class="gp"><section class="stage" id="stage"></section><aside class="gside pan"><div class="tabs" role="tablist"><button class="tab on" data-t="h" role="tab">Historique</button><button class="tab" data-t="s" role="tab">Session</button><button class="tab" data-t="r" role="tab">Règles</button></div><div id="gtab"></div></aside></div>`;
  $('#gfav',m).addEventListener('click',e=>{const on=toggleFav(id);e.currentTarget.classList.toggle('on',on);toast(on?'Ajouté à tes favoris':'Retiré de tes favoris')});
  let tab='h';
  const drawTab=()=>{const T=$('#gtab',m);if(!T)return;
    if(tab==='h'){const L=S.hist.filter(e=>e.g===id).slice(0,20);T.innerHTML=L.length?L.map(e=>`<div class="hrow"><div><div>◈ ${fmt(e.bet)} ${e.info?`<span class="mu2">· ${esc(e.info)}</span>`:''}</div><div class="t">${when(e.t)} · n° ${e.id}</div></div><span class="pill ${e.bet===0?'y':e.win>e.bet?'g':e.win===0?'r':''}">${e.bet?fmtM(e.mult):'Offert'}</span><b class="num ${e.win>e.bet?'pos':e.win<e.bet?'neg':''}">${e.win>0?'+'+fmt(e.win):'0'}</b></div>`).join(''):'<div class="empty"><b>Aucune partie</b>Tes 20 derniers coups apparaîtront ici.</div>'}
    else if(tab==='s'){const s=sess.g[id]||{bet:0,win:0,n:0};const net=s.win-s.bet;const mins=Math.floor((Date.now()-sess.start)/60000);T.innerHTML=`<div class="stats"><div class="st"><b>${s.n}</b><span>Parties sur ce jeu</span></div><div class="st"><b>◈ ${fmt(s.bet)}</b><span>Misé</span></div><div class="st"><b>◈ ${fmt(s.win)}</b><span>Gagné</span></div><div class="st"><b class="${net>0?'pos':net<0?'neg':''}">${net>0?'+':''}${fmt(net)}</b><span>Résultat net</span></div></div><p class="mu" style="font-size:12.5px;margin:14px 0 0">Session en cours : ${mins} min · ${fmt(sess.wag)} ◈ misés tous jeux confondus.</p>`}
    else T.innerHTML=`<div class="rules">${typeof g.rules==='function'?g.rules():g.rules}</div>`};
  $$('.tab',m).forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.t;$$('.tab',m).forEach(x=>x.classList.toggle('on',x===b));drawTab()}));
  drawTab();
  const onR=e=>{if(e.detail.g===id&&tab!=='r')drawTab()};document.addEventListener('round',onR);
  const d=g.init($('#stage',m));
  destroy=()=>{document.removeEventListener('round',onR);d&&d()};
};
