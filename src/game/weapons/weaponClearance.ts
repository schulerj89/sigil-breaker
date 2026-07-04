import { WEAPON_DEFINITIONS, type WeaponDefinition } from './weaponManifest';

export const WEAPON_COLLISION_RADIUS = 0.3;
export const WEAPON_WALL_PROBE_FORWARD_EXTRA = 0.18;

export interface WeaponFootprintClearance {
  rightOffset: number;
  forwardOffset: number;
  radius: number;
}

export function getWeaponFootprintClearance(): WeaponFootprintClearance {
  return {
    rightOffset: Math.max(...WEAPON_DEFINITIONS.map((weapon) => weapon.view.position[0])),
    forwardOffset:
      Math.max(...WEAPON_DEFINITIONS.map((weapon) => Math.abs(weapon.view.position[2]))) +
      WEAPON_WALL_PROBE_FORWARD_EXTRA,
    radius: WEAPON_COLLISION_RADIUS,
  };
}

export function getWeaponWallProbeLocalPosition(view: WeaponDefinition['view']): [number, number, number] {
  return [view.position[0], 0, view.position[2] - WEAPON_WALL_PROBE_FORWARD_EXTRA];
}
