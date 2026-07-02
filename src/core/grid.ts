export interface Position {
  x: number;
  y: number;
}

export interface GridSize {
  width: number;
  height: number;
}

export function addPositions(a: Position, b: Position): Position {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function positionsEqual(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}

export function isInBounds(position: Position, size: GridSize): boolean {
  return (
    position.x >= 0 &&
    position.y >= 0 &&
    position.x < size.width &&
    position.y < size.height
  );
}
