'use strict';
/* ============ Shell : header, sidebar, nav ============ */
function renderAvatar(){const a=$('#avatar');a.textContent=S.avatar;a.style.setProperty('--lc',LEVELS[lvl()].c)}
function renderSide(){
  const r=(location.hash.slice(2)||'lobby');
  const L=(href,icn,t,extra='')=>`<a class="sl ${r===href||r.startsWith(href+'/')&&href!=='cat'?'on':''}" href="#/${href}">${ic(icn)}<span>${t}</span>${extra}</a>`;
  $('#side').innerHTML=`<div class="side-jp"><span>Jackpot Aurum</span><b class="gtext num" data-jp>◈ ${fmt(S.jackpot)}</b></div>
  ${L('lobby','home','Lobby')}${L('games','grid','Tous les jeux','<span class="ct">'+GL.length+'</span>')}
  <h6>Catégories</h6>${Object.entries(CATS).map(([k,c])=>`<a class="sl ${r==='cat/'+k?'on':''}" href="#/cat/${k}">${ic(c.i)}<span>${c.n}</span><span class="ct">${GL.filter(g=>g.cat===k).length}</span></a>`).join('')}
  <h6>Mes jeux</h6>${L('fav','heart','Favoris','<span class="ct">'+S.fav.length+'</span>')}${L('recent','clock','Récemment joués')}
  <h6>Le Palace</h6>${L('promo','gift','Promotions')}${L('vip','crown','Club VIP')}${L('board','trophy','Classement')}${L('profile','user','Mon profil')}${L('rg','shield','Jeu responsable')}${L('fair','scale','Équité')}`;
  const bn=[['lobby','home','Lobby'],['games','grid','Jeux'],['promo','gift','Promos'],['vip','crown','VIP'],['profile','user','Profil']];
  $('#bnav').innerHTML=bn.map(([k,i,t])=>`<a class="bn ${r.split('/')[0]===k||(k==='games'&&(r.startsWith('cat')||r.startsWith('game/')))?'on':''}" href="#/${k}">${ic(i,22)}<span>${t}</span></a>`).join('');
}
function footer(){return `<footer class="foot"><div class="fl"><a href="#/rg">Jeu responsable</a><a href="#/fair">Équité et hasard</a><a href="#/promo">Promotions</a><a href="#/vip">Club VIP</a><a href="#/board">Classement</a></div><div class="disc"><span class="age">18+</span><div><b>Jeu gratuit à but de divertissement.</b> Aucune mise ni gain en argent réel. Les jetons ◈ n’ont aucune valeur monétaire, ne s’achètent pas et ne s’échangent pas. Si le jeu devient un problème pour toi ou un proche : Joueurs Info Service, 09 74 75 13 13 (appel non surtaxé).</div></div><p style="margin:12px 0 0">© Aurum Palace — casino social de démonstration.</p></footer>`}
