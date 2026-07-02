import type { Direction } from '../core/direction';
import { applyMove, cloneState, createLevelState, type LevelState } from '../core/levelState';
import type { ParsedLevel } from '../core/levelTypes';

export const MAX_UNDO_HISTORY = 100;

export interface GameSession {
  level: ParsedLevel;
  initialState: LevelState;
  state: LevelState;
  history: LevelState[];
}

export function createGameSession(level: ParsedLevel): GameSession {
  const initialState = createLevelState(level);

  return {
    level,
    initialState: cloneState(initialState),
    state: cloneState(initialState),
    history: [],
  };
}

export function applySessionMove(session: GameSession, direction: Direction): GameSession {
  if (session.state.hasWon || session.state.isCaught) {
    return session;
  }

  const nextState = applyMove(session.level, session.state, direction);
  if (nextState === session.state) {
    return session;
  }

  return {
    ...session,
    state: nextState,
    history: [...session.history, cloneState(session.state)].slice(-MAX_UNDO_HISTORY),
  };
}

export function undoSession(session: GameSession): GameSession {
  const previousState = session.history.at(-1);
  if (!previousState) {
    return session;
  }

  return {
    ...session,
    state: cloneState(previousState),
    history: session.history.slice(0, -1),
  };
}

export function restartSession(session: GameSession): GameSession {
  return {
    ...session,
    state: cloneState(session.initialState),
    history: [],
  };
}
