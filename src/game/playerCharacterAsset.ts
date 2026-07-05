import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { publicAssetUrl } from './assetUrls';

export const PLAYER_CHARACTER_ASSET = {
  id: 'player.hero.gadget-gremlin.apose.animated',
  modelPath: 'assets/characters/meshy-gadget-gremlin/models/player.hero.gadget-gremlin.apose.animated.glb',
  modelBytes: 10_983_096,
  modelSha256: '80bf9362d7b452f94bcac5b439469b3e67cde1641a9956ad5927b22776c5be7b',
  clipCount: 10,
  observedTriangles: 81_375,
  titleClipName: 'idle-alt',
} as const;

export type PlayerCharacterClipName =
  | 'walking'
  | 'running'
  | 'idle'
  | 'idle-alt'
  | 'low-health'
  | 'out-of-hp'
  | 'victory'
  | 'dance'
  | 'gun-hold'
  | 'run-and-shoot';

const sharedLoader = new GLTFLoader();
let sharedLoadPromise: Promise<GLTF> | null = null;

export function loadPlayerCharacterGltf(loader = sharedLoader): Promise<GLTF> {
  sharedLoadPromise ??= loader.loadAsync(publicAssetUrl(PLAYER_CHARACTER_ASSET.modelPath));
  return sharedLoadPromise;
}

export function clonePlayerCharacterScene(source: THREE.Object3D): THREE.Object3D {
  const clone = cloneSkeleton(source);
  clone.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return;
    }

    object.material = Array.isArray(object.material)
      ? object.material.map((material) => material.clone())
      : object.material.clone();
  });
  return clone;
}

export function findPlayerCharacterClip(
  clips: readonly THREE.AnimationClip[],
  clipName: PlayerCharacterClipName,
): THREE.AnimationClip | null {
  return clips.find((clip) => clip.name === clipName) ?? null;
}
