import './ui/styles.css';
import { Game } from './core/Game';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLElement;
const loading = document.getElementById('loading') as HTMLElement;
const tips = [
  'Astuce : freinez en ligne droite, relâchez progressivement en entrant dans le virage.',
  'Astuce : sans ABS, une roue bloquée ne dirige plus la voiture.',
  'Astuce : en mode Simulation, toutes les aides sont coupées et la boîte est manuelle.',
  'Astuce : F3 affiche la télémétrie des pneus (charge, glissement, angle de dérive).',
];
const tipEl = document.getElementById('loading-tip');
if (tipEl) tipEl.textContent = tips[Math.floor(Math.random() * tips.length)];

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
      const game = new Game(canvas, ui);
      game.start();
      // Debug/automation hook (used by the smoke test in tools/).
      (window as unknown as { __game: Game }).__game = game;
      loading.classList.add('done');
      setTimeout(() => loading.remove(), 800);
    } catch (err) {
      fail(err);
    }
  }, 30),
);
