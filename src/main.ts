import { initializePagesCacheBusting } from './game/cacheBusting';
import { createGame } from './game/createGame';
import './style.css';

initializePagesCacheBusting();

const root = document.querySelector<HTMLElement>('#game');

if (!root) {
  throw new Error('Missing #game root element.');
}

let app = createGame(root);

if (new URLSearchParams(window.location.search).has('qaCapture')) {
  window.__SIGILBREAKER_RESTART__ = () => {
    app.dispose();
    app = createGame(root);
  };
}

declare global {
  interface Window {
    __SIGILBREAKER_RESTART__?: () => void;
  }
}
