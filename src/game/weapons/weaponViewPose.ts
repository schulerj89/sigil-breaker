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
  aimBlend: number;
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
  const baseX = lerp(view.position[0], view.aimPosition[0], pose.aimBlend);
  const baseY = lerp(view.position[1], view.aimPosition[1], pose.aimBlend);
  const baseZ = lerp(view.position[2], view.aimPosition[2], pose.aimBlend);

  return [
    baseX,
    baseY - pose.wallAvoidance * WEAPON_VIEW_WALL_LOWER_UNITS,
    baseZ + pose.recoil + pose.wallAvoidance * WEAPON_VIEW_WALL_RETRACT_UNITS,
  ];
}

export function getWeaponRootCameraRotation(
  view: WeaponDefinition['view'],
  pose: WeaponViewPoseState,
): [number, number, number] {
  const baseX = lerp(view.rotation[0], view.aimRotation[0], pose.aimBlend);
  const baseY = lerp(view.rotation[1], view.aimRotation[1], pose.aimBlend);
  const baseZ = lerp(view.rotation[2], view.aimRotation[2], pose.aimBlend);

  return [
    baseX - pose.recoil * 1.4 - pose.wallAvoidance * WEAPON_VIEW_WALL_TILT_RADIANS,
    baseY,
    baseZ + pose.recoil * 0.55,
  ];
}

export function getWeaponRootCameraScale(view: WeaponDefinition['view'], pose: WeaponViewPoseState): number {
  return view.scale * lerp(1, view.aimScaleMultiplier, pose.aimBlend);
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
    .multiplyScalar(getWeaponRootCameraScale(view, pose))
    .applyEuler(new THREE.Euler(rotationX, rotationY, rotationZ, 'XYZ'));

  return [rootX + offset.x, rootY + offset.y, rootZ + offset.z];
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}
