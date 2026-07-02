import type { Direction } from './direction';
import { DIRECTION_VECTORS } from './direction';
import { addPositions, isInBounds, positionsEqual } from './grid';
import type { Position } from './grid';
import type { ParsedLevel, SigilColor, TerrainTile } from './levelTypes';

export type EntityAtPosition =
  | { kind: 'player' }
  | { kind: 'crate'; crateIndex: number }
  | { kind: 'golem'; golemIndex: number };

export interface LevelState {
  levelId: string;
  player: Position;
  crates: Position[];
  golems: Position[];
  openDoors: Position[];
  turnCount: number;
  hasWon: boolean;
  isCaught: boolean;
}

export function createLevelState(level: ParsedLevel): LevelState {
  return recomputeDerivedState(level, {
    levelId: level.id,
    player: { ...level.playerStart },
    crates: level.crates.map((crate) => ({ ...crate })),
    golems: level.golems.map((golem) => ({ ...golem })),
    openDoors: [],
    turnCount: 0,
    hasWon: false,
    isCaught: false,
  });
}

export function cloneState(state: LevelState): LevelState {
  return {
    levelId: state.levelId,
    player: { ...state.player },
    crates: state.crates.map((crate) => ({ ...crate })),
    golems: state.golems.map((golem) => ({ ...golem })),
    openDoors: state.openDoors.map((door) => ({ ...door })),
    turnCount: state.turnCount,
    hasWon: state.hasWon,
    isCaught: state.isCaught,
  };
}

export function getEntityAt(state: LevelState, position: Position): EntityAtPosition | undefined {
  if (positionsEqual(state.player, position)) {
    return { kind: 'player' };
  }

  const crateIndex = state.crates.findIndex((crate) => positionsEqual(crate, position));
  if (crateIndex !== -1) {
    return { kind: 'crate', crateIndex };
  }

  const golemIndex = state.golems.findIndex((golem) => positionsEqual(golem, position));
  return golemIndex === -1 ? undefined : { kind: 'golem', golemIndex };
}

export function isPassable(level: ParsedLevel, state: LevelState, position: Position): boolean {
  if (!isInBounds(position, level)) {
    return false;
  }

  const tile = level.tiles[position.y][position.x];
  if (tile.kind === 'wall') {
    return false;
  }

  if (tile.kind === 'door' && !isDoorOpen(state, position)) {
    return false;
  }

  return getEntityAt(state, position) === undefined;
}

export function applyMove(level: ParsedLevel, state: LevelState, direction: Direction): LevelState {
  if (state.hasWon || state.isCaught) {
    return state;
  }

  const nextPosition = addPositions(state.player, DIRECTION_VECTORS[direction]);

  if (!isInBounds(nextPosition, level)) {
    return state;
  }

  const entity = getEntityAt(state, nextPosition);
  if (entity?.kind === 'crate') {
    return pushCrate(level, state, entity.crateIndex, direction);
  }

  if (entity?.kind === 'golem') {
    return state;
  }

  if (!isTilePassableForEntity(level, state, nextPosition)) {
    return state;
  }

  return completeSuccessfulTurn(level, {
    ...state,
    player: { ...nextPosition },
    turnCount: state.turnCount + 1,
  });
}

export function recomputeDerivedState(level: ParsedLevel, state: LevelState): LevelState {
  const openDoors = getOpenDoorPositions(level, state);
  const derivedState = {
    ...cloneState(state),
    openDoors,
  };

  return {
    ...derivedState,
    hasWon: isExitPosition(level, derivedState.player) && isTilePassableForEntity(level, derivedState, derivedState.player),
  };
}

export function previewGolemMoves(level: ParsedLevel, state: LevelState): Position[] {
  const derivedState = recomputeDerivedState(level, state);

  return derivedState.golems.map((golem, golemIndex) =>
    getNextGolemPosition(level, derivedState, golem, golemIndex),
  );
}

function pushCrate(
  level: ParsedLevel,
  state: LevelState,
  crateIndex: number,
  direction: Direction,
): LevelState {
  const crate = state.crates[crateIndex];
  const nextCratePosition = addPositions(crate, DIRECTION_VECTORS[direction]);

  if (!isTilePassableForEntity(level, state, nextCratePosition)) {
    return state;
  }

  if (state.crates.some((otherCrate, index) => index !== crateIndex && positionsEqual(otherCrate, nextCratePosition))) {
    return state;
  }

  if (state.golems.some((golem) => positionsEqual(golem, nextCratePosition))) {
    return state;
  }

  const nextCrates = state.crates.map((currentCrate, index) =>
    index === crateIndex ? { ...nextCratePosition } : { ...currentCrate },
  );

  return completeSuccessfulTurn(level, {
    ...state,
    player: { ...crate },
    crates: nextCrates,
    turnCount: state.turnCount + 1,
  });
}

function completeSuccessfulTurn(level: ParsedLevel, state: LevelState): LevelState {
  return moveGolems(level, recomputeDerivedState(level, state));
}

function moveGolems(level: ParsedLevel, state: LevelState): LevelState {
  let nextState = cloneState(state);

  for (let golemIndex = 0; golemIndex < nextState.golems.length; golemIndex += 1) {
    const currentPosition = nextState.golems[golemIndex];
    const nextPosition = getNextGolemPosition(level, nextState, currentPosition, golemIndex);
    nextState = {
      ...nextState,
      golems: nextState.golems.map((golem, index) =>
        index === golemIndex ? { ...nextPosition } : { ...golem },
      ),
      isCaught: nextState.isCaught || positionsEqual(nextPosition, nextState.player),
    };
    nextState = recomputeDerivedState(level, nextState);
  }

  return nextState;
}

function getNextGolemPosition(
  level: ParsedLevel,
  state: LevelState,
  golem: Position,
  golemIndex: number,
): Position {
  const currentDistance = manhattanDistance(golem, state.player);
  const candidates = GOLEM_DIRECTION_PRIORITY.map((direction) => ({
    position: addPositions(golem, DIRECTION_VECTORS[direction]),
    distance: manhattanDistance(addPositions(golem, DIRECTION_VECTORS[direction]), state.player),
  }));

  const bestMove = candidates.find(
    (candidate) =>
      candidate.distance < currentDistance &&
      canGolemEnter(level, state, candidate.position, golemIndex),
  );

  return bestMove?.position ?? golem;
}

function getOpenDoorPositions(level: ParsedLevel, state: LevelState): Position[] {
  const activePlateColors = new Set<SigilColor>();

  for (const plateHolder of [...state.crates, ...state.golems]) {
    const tile = getTile(level, plateHolder);
    if (tile?.kind === 'pressurePlate' && tile.color) {
      activePlateColors.add(tile.color);
    }
  }

  return level.doors
    .filter((door) => activePlateColors.has(door.color))
    .map((door) => ({ ...door.position }));
}

function isDoorOpen(state: LevelState, position: Position): boolean {
  return state.openDoors.some((door) => positionsEqual(door, position));
}

function isTilePassableForEntity(level: ParsedLevel, state: LevelState, position: Position): boolean {
  if (!isInBounds(position, level)) {
    return false;
  }

  const tile = getTile(level, position);
  if (!tile || tile.kind === 'wall') {
    return false;
  }

  return tile.kind !== 'door' || isDoorOpen(state, position);
}

function canGolemEnter(
  level: ParsedLevel,
  state: LevelState,
  position: Position,
  movingGolemIndex: number,
): boolean {
  if (!isInBounds(position, level)) {
    return false;
  }

  if (isExitPosition(level, position)) {
    return false;
  }

  const tile = getTile(level, position);
  if (!tile || tile.kind === 'wall') {
    return false;
  }

  if (tile.kind === 'door' && !isDoorOpen(state, position)) {
    return false;
  }

  if (state.crates.some((crate) => positionsEqual(crate, position))) {
    return false;
  }

  return !state.golems.some(
    (golem, index) => index !== movingGolemIndex && positionsEqual(golem, position),
  );
}

function isExitPosition(level: ParsedLevel, position: Position): boolean {
  return level.exits.some((exit) => positionsEqual(exit, position));
}

function getTile(level: ParsedLevel, position: Position): TerrainTile | undefined {
  if (!isInBounds(position, level)) {
    return undefined;
  }

  return level.tiles[position.y][position.x];
}

function manhattanDistance(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

const GOLEM_DIRECTION_PRIORITY: Direction[] = ['up', 'right', 'down', 'left'];
