'use strict';
/* ============ Shell : header, sidebar, nav ============ */
function renderAvatar(){const a=$('#avatar');a.textContent=S.avatar;a.style.setProperty('--lc',LEVELS[lvl()].c)}
function renderSide(){
  const r=(location.hash.slice(2)||'lobby');
  const L=(href,icn,t,extra='')=>`<a class="sl ${r===href||r.startsWith(href+'/')&&href!=='cat'?'on':''}" href="#/${href}"><span class="sl-ic">${ic(icn,18)}</span><span>${t}</span>${extra}</a>`;
  const i=lvl(),Lv=LEVELS[i],N=LEVELS[i+1],pr=N?Math.max(0,Math.min(1,(S.wagered-Lv.x)/(N.x-Lv.x))):1;
  const ready=S.daily+864e5-Date.now()<=0;
  $('#side').innerHTML=`<a class="side-me" href="#/vip" style="--lc:${Lv.c}"><span class="side-av">${S.avatar}</span><span class="side-mi"><b>${esc(S.name)}</b><span>${medal(i,16)} VIP ${Lv.n}</span><span class="bar"><i style="width:${pr*100}%"></i></span></span></a>
  <nav class="side-nav">${L('lobby','home','Lobby')}${L('games','grid','Tous les jeux','<span class="ct">'+GL.length+'</span>')}
  <h6>Catégories</h6>${Object.entries(CATS).map(([k,c])=>`<a class="sl ${r==='cat/'+k?'on':''}" href="#/cat/${k}"><span class="sl-ic">${ic(c.i,18)}</span><span>${c.n}</span><span class="ct">${GL.filter(g=>g.cat===k).length}</span></a>`).join('')}
  <h6>Mes jeux</h6>${L('fav','heart','Favoris','<span class="ct">'+S.fav.length+'</span>')}${L('recent','clock','Récemment joués')}
  <h6>Le Palace</h6>${L('promo','gift','Promotions',ready?'<span class="ct new">1</span>':'')}${L('vip','crown','Club VIP')}${L('board','trophy','Classement')}${L('profile','user','Mon profil')}${L('rg','shield','Jeu responsable')}${L('fair','scale','Équité')}</nav>
  <a class="side-jp" href="#/game/pharaon"><span>${ic('crown',14)} Jackpot Aurum</span><b class="gtext num" data-jp>◈ ${fmt(S.jackpot)}</b></a>
  <a class="side-wheel ${ready?'ready':''}" href="#/promo"><span class="sw-w"></span><span><b>${ready?'Roue du jour prête':'Roue du jour'}</b><small>${ready?'Tourne-la maintenant':'Reviens demain'}</small></span></a>`;
  const bn=[['lobby','home','Lobby'],['games','grid','Jeux'],['promo','gift','Promos'],['vip','crown','VIP'],['profile','user','Profil']];
  $('#bnav').innerHTML=bn.map(([k,ico,t])=>`<a class="bn ${k==='promo'?'bn-c':''} ${r.split('/')[0]===k||(k==='games'&&(r.startsWith('cat')||r.startsWith('game/')))?'on':''}" href="#/${k}">${k==='promo'?`<span class="bn-fab">${ic(ico,22)}${ready?'<i class="bn-dot"></i>':''}</span>`:ic(ico,22)}<span>${t}</span></a>`).join('');
}
function footer(){return `<footer class="foot">
  <div class="foot-top"><div class="foot-brand"><span class="foot-logo">${LOGO(40)}<span>Aurum <span class="gtext">Palace</span></span></span><p>Le casino social de démonstration : machines à sous, tables et Originals, joués uniquement avec des jetons fictifs.</p></div>
  <div class="foot-col"><h5>Jouer</h5><a href="#/cat/slots">Machines à sous</a><a href="#/cat/table">Jeux de table</a><a href="#/cat/originals">Originals</a><a href="#/cat/instant">Jeux instantanés</a></div>
  <div class="foot-col"><h5>Le Palace</h5><a href="#/promo">Promotions</a><a href="#/vip">Club VIP</a><a href="#/board">Classement</a><a href="#/profile">Mon profil</a></div>
  <div class="foot-col"><h5>Confiance</h5><a href="#/rg">Jeu responsable</a><a href="#/fair">Équité et hasard</a></div></div>
  <div class="foot-badges"><span class="age">18+</span><span class="fb">${ic('shield',15)} Jeu responsable</span><span class="fb">${ic('scale',15)} Hasard cryptographique</span><span class="fb">${ic('lock',15)} Aucun argent réel</span></div>
  <div class="disc"><b>Jeu gratuit à but de divertissement.</b> Aucune mise ni gain en argent réel. Les jetons ◈ n’ont aucune valeur monétaire, ne s’achètent pas et ne s’échangent pas. Si le jeu devient un problème pour toi ou un proche : Joueurs Info Service, 09 74 75 13 13 (appel non surtaxé).</div>
  <p class="foot-legal">© Aurum Palace — casino social de démonstration. Symboles de « Fruit Classic » et de certaines illustrations par Ville Seppänen (villeseppanen.com), licence CC BY 4.0. Polices Cinzel et Inter, licence SIL OFL 1.1.</p></footer>`}
