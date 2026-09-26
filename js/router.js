'use strict';
/* ============ Routeur ============ */
let destroy=null;
const V={};
function go(){
  if(destroy){try{destroy()}catch(e){console.error(e)}destroy=null}
  const [r,arg]=(location.hash.slice(2)||'lobby').split('/');
  const m=$('#main');m.innerHTML='';
  (V[r]||V.lobby)(m,arg);
  if(!m.querySelector('.foot'))m.insertAdjacentHTML('beforeend',footer());
  renderSide();scrollTo(0,0);
}
addEventListener('hashchange',go);
