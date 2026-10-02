import './ui/styles.css';
import { App } from './core/App';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLElement;
const loading = document.getElementById('loading') as HTMLElement;
const tips = [
  'Astuce : freinez en ligne droite, relâchez progressivement en entrant dans le virage.',
  'Astuce : sans ABS, une roue bloquée ne dirige plus la voiture.',
  'Astuce : en mode Simulation, toutes les aides sont coupées et la boîte est manuelle.',
  'Astuce : F3 affiche la télémétrie des pneus (charge, glissement, angle de dérive).',
  'Astuce : dans le garage, l’onglet Réglages montre l’effet de vos réglages sur le 0–100 et la vitesse max.',
];
const tipEl = document.getElementById('loading-tip');
if (tipEl) tipEl.textContent = tips[Math.floor(Math.random() * tips.length)];

/** Keyboard events only reach the game once it has focus (e.g. when embedded in another page). */
function showFocusHint(): void {
  if (document.hasFocus()) return;
  const hint = document.createElement('button');
  hint.className = 'focus-hint';
  hint.textContent = 'Cliquez ici pour prendre le volant';
  const dismiss = () => {
    window.focus();
    hint.remove();
  };
  hint.addEventListener('click', dismiss);
  window.addEventListener('focus', () => hint.remove(), { once: true });
  ui.appendChild(hint);
}

function fail(err: unknown): void {
  console.error(err);
  loading.classList.add('error');
  const msg = document.getElementById('loading-msg');
  if (msg) msg.textContent = `Impossible de démarrer le rendu 3D : ${err instanceof Error ? err.message : String(err)}`;
}

// Let the loading screen paint before the (synchronous) scene build.
requestAnimationFrame(() =>
  setTimeout(() => {
    try {
      const app = new App(canvas, ui);
      app.start();
      // Debug/automation hook (used by the browser smoke test in tools/).
      (window as unknown as { __app: App }).__app = app;
      (window as unknown as { __debug: object }).__debug = {
        gltfRoundTrip: async (id: string) => (await import('./debug/gltfRoundTrip')).gltfRoundTrip(id),
        engineSoundWav: async (id: string) => (await import('./debug/engineSound')).engineSoundWav(id),
      };
      loading.classList.add('done');
      setTimeout(() => loading.remove(), 800);
      showFocusHint();
    } catch (err) {
      fail(err);
    }
  }, 30),
);
