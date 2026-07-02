import type { Position } from './grid';

export type SigilColor = 'red';

export type TerrainKind = 'floor' | 'wall' | 'pressurePlate' | 'door' | 'exit';

export interface TerrainTile {
  kind: TerrainKind;
  color?: SigilColor;
}

export interface LevelDefinition {
  id: string;
  name: string;
  map: string[];
}

export interface Door {
  position: Position;
  color: SigilColor;
}

export interface PressurePlate {
  position: Position;
  color: SigilColor;
}

export interface ParsedLevel {
  id: string;
  name: string;
  width: number;
  height: number;
  tiles: TerrainTile[][];
  playerStart: Position;
  crates: Position[];
  pressurePlates: PressurePlate[];
  doors: Door[];
  exits: Position[];
}
