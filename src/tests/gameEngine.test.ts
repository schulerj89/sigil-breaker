import { describe, expect, it } from 'vitest';
import type { Direction } from '../core/direction';
import {
  applyMove,
  createLevelState,
  isPassable,
  previewGolemMoves,
  recomputeDerivedState,
} from '../core/levelState';
import { parseLevel } from '../core/levelParser';
import type { ParsedLevel } from '../core/levelTypes';
import {
  applySessionMove,
  createGameSession,
  restartSession,
  undoSession,
} from '../systems/gameEngine';

function levelFromMap(map: string[]): ParsedLevel {
  return parseLevel({
    id: 'test-level',
    name: 'Test Level',
    map,
  });
}

function moveMany(level: ParsedLevel, directions: Direction[]) {
  return directions.reduce((state, direction) => applyMove(level, state, direction), createLevelState(level));
}

describe('game engine movement', () => {
  it('prevents the player from walking through walls', () => {
    const level = levelFromMap(['#####', '#P###', '#...#', '#####']);
    const state = createLevelState(level);

    expect(applyMove(level, state, 'right')).toBe(state);
  });

  it('allows the player to move onto floor', () => {
    const level = levelFromMap(['#####', '#P..#', '#...#', '#####']);
    const state = applyMove(level, createLevelState(level), 'right');

    expect(state.player).toEqual({ x: 2, y: 1 });
    expect(state.turnCount).toBe(1);
  });

  it('allows the player to push one crate', () => {
    const level = levelFromMap(['#####', '#PC.#', '#...#', '#####']);
    const state = applyMove(level, createLevelState(level), 'right');

    expect(state.player).toEqual({ x: 2, y: 1 });
    expect(state.crates).toEqual([{ x: 3, y: 1 }]);
  });

  it('prevents the player from pushing two crates at once', () => {
    const level = levelFromMap(['#####', '#PCC#', '#...#', '#####']);
    const state = createLevelState(level);

    expect(applyMove(level, state, 'right')).toBe(state);
  });

  it('prevents pushing a crate into a wall', () => {
    const level = levelFromMap(['#####', '#PC##', '#...#', '#####']);
    const state = createLevelState(level);

    expect(applyMove(level, state, 'right')).toBe(state);
  });

  it('opens a red door when a crate is on any red plate', () => {
    const level = levelFromMap(['#####', '#P..#', '#.C.#', '#.RD#', '#..E#', '#####']);
    const state = moveMany(level, ['right', 'down']);

    expect(state.crates).toEqual([{ x: 2, y: 3 }]);
    expect(state.openDoors).toEqual([{ x: 3, y: 3 }]);
    expect(isPassable(level, state, { x: 3, y: 3 })).toBe(true);
  });

  it('closes the red door when no crate remains on a red plate', () => {
    const level = levelFromMap(['#####', '#P..#', '#.C.#', '#.RD#', '#..E#', '#####']);
    const state = moveMany(level, ['right', 'down', 'down']);

    expect(state.crates).toEqual([{ x: 2, y: 4 }]);
    expect(state.openDoors).toEqual([]);
    expect(isPassable(level, state, { x: 3, y: 3 })).toBe(false);
  });

  it('prevents the player from passing through a closed door', () => {
    const level = levelFromMap(['#####', '#PDE#', '#...#', '#####']);
    const state = createLevelState(level);

    expect(applyMove(level, state, 'right')).toBe(state);
  });

  it('allows the player to pass through an open door', () => {
    const level = levelFromMap(['#####', '#PDE#', '#.R.#', '#####']);
    const openState = recomputeDerivedState(level, {
      ...createLevelState(level),
      crates: [{ x: 2, y: 2 }],
    });

    const moved = applyMove(level, openState, 'right');

    expect(openState.openDoors).toEqual([{ x: 2, y: 1 }]);
    expect(moved.player).toEqual({ x: 2, y: 1 });
  });

  it('sets win state when the player reaches an exit', () => {
    const level = levelFromMap(['#####', '#PE.#', '#...#', '#####']);
    const state = applyMove(level, createLevelState(level), 'right');

    expect(state.player).toEqual({ x: 2, y: 1 });
    expect(state.hasWon).toBe(true);
  });

  it('moves a golem after a successful player move', () => {
    const level = levelFromMap(['#####', '#P..#', '#..G#', '#...#', '#####']);
    const state = applyMove(level, createLevelState(level), 'right');

    expect(state.player).toEqual({ x: 2, y: 1 });
    expect(state.golems).toEqual([{ x: 3, y: 1 }]);
  });

  it('does not move a golem after a blocked player move', () => {
    const level = levelFromMap(['#####', '#P#G#', '#...#', '#####']);
    const state = createLevelState(level);

    expect(applyMove(level, state, 'right')).toBe(state);
    expect(state.golems).toEqual([{ x: 3, y: 1 }]);
  });

  it('uses deterministic golem tie-break priority', () => {
    const level = levelFromMap(['#####', '#P..#', '#.G.#', '#...#', '#####']);
    const state = recomputeDerivedState(level, {
      ...createLevelState(level),
      player: { x: 3, y: 1 },
    });

    expect(previewGolemMoves(level, state)).toEqual([{ x: 2, y: 1 }]);
  });

  it('prevents a golem from passing through a wall', () => {
    const level = levelFromMap(['#####', '#P..#', '#..##', '#..G#', '#####']);
    const state = recomputeDerivedState(level, {
      ...createLevelState(level),
      player: { x: 3, y: 1 },
    });

    expect(previewGolemMoves(level, state)).toEqual([{ x: 3, y: 3 }]);
  });

  it('prevents a golem from passing through a crate', () => {
    const level = levelFromMap(['#####', '#...#', '#PCG#', '#...#', '#####']);
    const state = createLevelState(level);

    expect(previewGolemMoves(level, state)).toEqual([{ x: 3, y: 2 }]);
  });

  it('allows a golem to stand on a red plate', () => {
    const level = levelFromMap(['#####', '#.P.#', '#.R.#', '#.G.#', '#####']);
    const state = applyMove(level, createLevelState(level), 'left');

    expect(state.golems).toEqual([{ x: 2, y: 2 }]);
  });

  it('opens a red door when a golem stands on a red plate', () => {
    const level = levelFromMap(['######', '#.P..#', '#.RD.#', '#.G..#', '######']);
    const state = applyMove(level, createLevelState(level), 'left');

    expect(state.golems).toEqual([{ x: 2, y: 2 }]);
    expect(state.openDoors).toEqual([{ x: 3, y: 2 }]);
    expect(isPassable(level, state, { x: 3, y: 2 })).toBe(true);
  });

  it('sets caught state when a golem moves onto the player', () => {
    const level = levelFromMap(['#####', '#P..#', '#.G.#', '#...#', '#####']);
    const state = applyMove(level, createLevelState(level), 'right');

    expect(state.golems).toEqual([{ x: 2, y: 1 }]);
    expect(state.isCaught).toBe(true);
  });
});

describe('game session history', () => {
  it('undo restores player, crates, doors, turn count, and win state', () => {
    const level = levelFromMap(['#####', '#P..#', '#.C.#', '#.RD#', '#..E#', '#####']);
    let session = createGameSession(level);

    session = applySessionMove(session, 'right');
    const beforePush = session.state;
    session = applySessionMove(session, 'down');

    expect(session.state.openDoors).toEqual([{ x: 3, y: 3 }]);

    session = undoSession(session);

    expect(session.state).toEqual(beforePush);
    expect(session.state.openDoors).toEqual([]);
    expect(session.state.turnCount).toBe(1);
    expect(session.state.hasWon).toBe(false);
  });

  it('restart restores the initial state', () => {
    const level = levelFromMap(['#####', '#P..#', '#.C.#', '#.RD#', '#..E#', '#####']);
    let session = createGameSession(level);

    session = applySessionMove(session, 'right');
    session = applySessionMove(session, 'down');
    session = restartSession(session);

    expect(session.state).toEqual(session.initialState);
    expect(session.history).toEqual([]);
  });

  it('undo restores golem position and caught state', () => {
    const level = levelFromMap(['#####', '#P..#', '#.G.#', '#...#', '#####']);
    let session = createGameSession(level);

    session = applySessionMove(session, 'right');
    expect(session.state.isCaught).toBe(true);
    expect(session.state.golems).toEqual([{ x: 2, y: 1 }]);

    session = undoSession(session);

    expect(session.state.golems).toEqual([{ x: 2, y: 2 }]);
    expect(session.state.isCaught).toBe(false);
  });

  it('restart restores golem position', () => {
    const level = levelFromMap(['#####', '#P..#', '#..G#', '#...#', '#####']);
    let session = createGameSession(level);

    session = applySessionMove(session, 'right');
    expect(session.state.golems).toEqual([{ x: 3, y: 1 }]);

    session = restartSession(session);

    expect(session.state.golems).toEqual([{ x: 3, y: 2 }]);
  });
});
