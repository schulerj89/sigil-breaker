import { createGame } from './game/createGame';
import './style.css';

const root = document.querySelector<HTMLElement>('#game');

if (!root) {
  throw new Error('Missing #game root element.');
}

createGame(root);
