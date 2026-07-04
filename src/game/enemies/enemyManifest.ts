export { publicAssetUrl } from '../assetUrls';

export interface EnemyAssetDefinition {
  id: string;
  label: string;
  role: string;
  modelPath: string;
  modelBytes: number;
  modelSha256: string;
  sourceUrl: string;
  targetHeightUnits: number;
  yawRadians: number;
}

export const ENEMY_ASSET_SOURCE = {
  sourceId: 'quaternius.ultimate-monsters.poly-pizza',
  name: 'Ultimate Monsters Bundle',
  author: 'Quaternius',
  sourceUrl: 'https://poly.pizza/bundle/Ultimate-Monsters-Bundle-5oyGWAmOB6',
  license: 'Public Domain, CC0',
  licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  licenseFile: 'public/assets/enemies/quaternius-monsters/LICENSE.txt',
  attributionRequired: false,
  commercialUseAllowed: true,
  redistributionAllowed: true,
} as const;

export const ENEMY_ASSET_DEFINITIONS: readonly EnemyAssetDefinition[] = [
  {
    id: 'enemy.monster.mushnub',
    label: 'MUSHNUB',
    role: 'spawn-lane bruiser',
    modelPath: 'assets/enemies/quaternius-monsters/models/mushnub.glb',
    modelBytes: 67_900,
    modelSha256: '04614a9d0db2a00d17cd85f4ef9c54e19cd3692530c0724b46809aa928e161e9',
    sourceUrl: 'https://poly.pizza/m/LWKmS30Xxl',
    targetHeightUnits: 1.55,
    yawRadians: Math.PI / 2,
  },
  {
    id: 'enemy.monster.pink-slime',
    label: 'SLIME',
    role: 'low target',
    modelPath: 'assets/enemies/quaternius-monsters/models/pink-slime.glb',
    modelBytes: 62_652,
    modelSha256: '34bb111a7931bb957f992e127d71fac321aaeea1bdcc7da56fa5aba55c83d783',
    sourceUrl: 'https://poly.pizza/m/AyP8sQmDLh',
    targetHeightUnits: 1.2,
    yawRadians: Math.PI / 2,
  },
  {
    id: 'enemy.monster.goleling',
    label: 'GOLELING',
    role: 'tough lane anchor',
    modelPath: 'assets/enemies/quaternius-monsters/models/goleling.glb',
    modelBytes: 217_332,
    modelSha256: 'fe6b5a04aef77aa9b38afee216802823b543d2409674bc86bd8bd152cb8cebce',
    sourceUrl: 'https://poly.pizza/m/71gomWolax',
    targetHeightUnits: 1.75,
    yawRadians: Math.PI / 2,
  },
];
