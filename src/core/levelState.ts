import type { Direction } from './direction';
import { DIRECTION_VECTORS } from './direction';
import { addPositions, isInBounds, positionsEqual } from './grid';
import type { Position } from './grid';
import type { ParsedLevel, SigilColor, TerrainTile } from './levelTypes';

export type EntityAtPosition =
  | { kind: 'player' }
  | { kind: 'crate'; crateIndex: number };

export interface LevelState {
  levelId: string;
  player: Position;
  crates: Position[];
  openDoors: Position[];
  turnCount: number;
  hasWon: boolean;
}

export function createLevelState(level: ParsedLevel): LevelState {
  return recomputeDerivedState(level, {
    levelId: level.id,
    player: { ...level.playerStart },
    crates: level.crates.map((crate) => ({ ...crate })),
    openDoors: [],
    turnCount: 0,
    hasWon: false,
  });
}

export function cloneState(state: LevelState): LevelState {
  return {
    levelId: state.levelId,
    player: { ...state.player },
    crates: state.crates.map((crate) => ({ ...crate })),
    openDoors: state.openDoors.map((door) => ({ ...door })),
    turnCount: state.turnCount,
    hasWon: state.hasWon,
  };
}

export function getEntityAt(state: LevelState, position: Position): EntityAtPosition | undefined {
  if (positionsEqual(state.player, position)) {
    return { kind: 'player' };
  }

  const crateIndex = state.crates.findIndex((crate) => positionsEqual(crate, position));
  return crateIndex === -1 ? undefined : { kind: 'crate', crateIndex };
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
  const nextPosition = addPositions(state.player, DIRECTION_VECTORS[direction]);

  if (!isInBounds(nextPosition, level)) {
    return state;
  }

  const entity = getEntityAt(state, nextPosition);
  if (entity?.kind === 'crate') {
    return pushCrate(level, state, entity.crateIndex, direction);
  }

  if (!isTilePassableForEntity(level, state, nextPosition)) {
    return state;
  }

  return recomputeDerivedState(level, {
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

  const nextCrates = state.crates.map((currentCrate, index) =>
    index === crateIndex ? { ...nextCratePosition } : { ...currentCrate },
  );

  return recomputeDerivedState(level, {
    ...state,
    player: { ...crate },
    crates: nextCrates,
    turnCount: state.turnCount + 1,
  });
}

function getOpenDoorPositions(level: ParsedLevel, state: LevelState): Position[] {
  const activePlateColors = new Set<SigilColor>();

  for (const crate of state.crates) {
    const tile = getTile(level, crate);
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

function isExitPosition(level: ParsedLevel, position: Position): boolean {
  return level.exits.some((exit) => positionsEqual(exit, position));
}

function getTile(level: ParsedLevel, position: Position): TerrainTile | undefined {
  if (!isInBounds(position, level)) {
    return undefined;
  }

  return level.tiles[position.y][position.x];
}
