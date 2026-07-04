const HORIZONTAL_DIRECTION_EPSILON = 0.0001;

export function getHorizontalShotDirectionLength(directionX: number, directionZ: number): number {
  return Math.hypot(directionX, directionZ);
}

export function getHorizontalRaycastDistance(cameraSpaceDistance: number, horizontalDirectionLength: number): number {
  return Math.max(0, cameraSpaceDistance) * Math.max(0, horizontalDirectionLength);
}

export function getCameraSpaceShotDistance(horizontalDistance: number, horizontalDirectionLength: number): number {
  if (horizontalDirectionLength <= HORIZONTAL_DIRECTION_EPSILON) {
    return Math.max(0, horizontalDistance);
  }

  return Math.max(0, horizontalDistance) / horizontalDirectionLength;
}

export function hasHorizontalShotDirection(horizontalDirectionLength: number): boolean {
  return horizontalDirectionLength > HORIZONTAL_DIRECTION_EPSILON;
}
