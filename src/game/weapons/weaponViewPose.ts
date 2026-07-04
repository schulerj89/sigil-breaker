import * as THREE from 'three';
import type { WeaponDefinition } from './weaponManifest';

export const WEAPON_VIEW_WALL_RETRACT_UNITS = 0.46;
export const WEAPON_VIEW_WALL_LOWER_UNITS = 0.09;
export const WEAPON_VIEW_WALL_TILT_RADIANS = 0.12;
export const WEAPON_WALL_IMPACT_INSET_UNITS = 0.035;
export const MIN_SHOT_TRACER_DISTANCE_UNITS = 0.7;

export interface WeaponViewPoseState {
  recoil: number;
  wallAvoidance: number;
}

export interface WeaponShotEffectPositions {
  muzzle: [number, number, number];
  tracerEnd: [number, number, number];
  wallImpact: [number, number, number];
}

export function getWeaponRootCameraPosition(
  view: WeaponDefinition['view'],
  pose: WeaponViewPoseState,
): [number, number, number] {
  return [
    view.position[0],
    view.position[1] - pose.wallAvoidance * WEAPON_VIEW_WALL_LOWER_UNITS,
    view.position[2] + pose.recoil + pose.wallAvoidance * WEAPON_VIEW_WALL_RETRACT_UNITS,
  ];
}

export function getWeaponRootCameraRotation(
  view: WeaponDefinition['view'],
  pose: WeaponViewPoseState,
): [number, number, number] {
  return [
    view.rotation[0] - pose.recoil * 1.4 - pose.wallAvoidance * WEAPON_VIEW_WALL_TILT_RADIANS,
    view.rotation[1],
    view.rotation[2] + pose.recoil * 0.55,
  ];
}

export function getWeaponMuzzleCameraPosition(
  view: WeaponDefinition['view'],
  pose: WeaponViewPoseState,
): [number, number, number] {
  return transformWeaponLocalPoint(view, getWeaponMuzzleLocalOffset(view), pose);
}

export function getWeaponShotEffectPositions(
  view: WeaponDefinition['view'],
  distance: number,
  pose: WeaponViewPoseState,
): WeaponShotEffectPositions {
  const tracerDistance = Math.max(MIN_SHOT_TRACER_DISTANCE_UNITS, distance);

  return {
    muzzle: getWeaponMuzzleCameraPosition(view, pose),
    tracerEnd: [0, 0, -tracerDistance],
    wallImpact: [0, 0, -distance + WEAPON_WALL_IMPACT_INSET_UNITS],
  };
}

export function getWeaponMuzzleLocalOffset(view: WeaponDefinition['view']): readonly [number, number, number] {
  return view.muzzleLocalOffset;
}

function transformWeaponLocalPoint(
  view: WeaponDefinition['view'],
  localPoint: readonly [number, number, number],
  pose: WeaponViewPoseState,
): [number, number, number] {
  const [rootX, rootY, rootZ] = getWeaponRootCameraPosition(view, pose);
  const [rotationX, rotationY, rotationZ] = getWeaponRootCameraRotation(view, pose);
  const offset = new THREE.Vector3(...localPoint)
    .multiplyScalar(view.scale)
    .applyEuler(new THREE.Euler(rotationX, rotationY, rotationZ, 'XYZ'));

  return [rootX + offset.x, rootY + offset.y, rootZ + offset.z];
}
