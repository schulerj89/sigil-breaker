import { initializePagesCacheBusting } from './game/cacheBusting';
import { createGame } from './game/createGame';
import './style.css';

initializePagesCacheBusting();

const root = document.querySelector<HTMLElement>('#game');

if (!root) {
  throw new Error('Missing #game root element.');
}

createGame(root);
