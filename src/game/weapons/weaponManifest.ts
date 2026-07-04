export type WeaponSoundProfile = 'sidearm' | 'scatter' | 'heavy';

export interface WeaponDefinition {
  id: string;
  label: string;
  role: string;
  modelPath: string;
  previewPath: string;
  modelBytes: number;
  modelSha256: string;
  magazineSize: number;
  fireIntervalMs: number;
  reloadMs: number;
  recoilKick: number;
  rangeUnits: number;
  soundProfile: WeaponSoundProfile;
  view: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: number;
  };
}

const VIEW_FORWARD_YAW = 0;
const PUBLIC_ASSET_VERSION_PARAM = 'assetBuild';

export const WEAPON_ASSET_SOURCE = {
  sourceId: 'kenney.blaster-kit.2-1',
  name: 'Blaster Kit 2.1',
  author: 'Kenney',
  sourceUrl: 'https://kenney.nl/assets/blaster-kit',
  downloadUrl: 'https://kenney.nl/media/pages/assets/blaster-kit/261d80a716-1753959510/kenney_blaster-kit_2.1.zip',
  license: 'Creative Commons Zero, CC0',
  licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  licenseFile: 'public/assets/weapons/kenney-blaster-kit/LICENSE.txt',
  attributionRequired: false,
  commercialUseAllowed: true,
  redistributionAllowed: true,
} as const;

export const WEAPON_DEFINITIONS: readonly WeaponDefinition[] = [
  {
    id: 'weapon.blaster.spark',
    label: 'SPARK',
    role: 'fast sidearm',
    modelPath: 'assets/weapons/kenney-blaster-kit/models/blaster-a.glb',
    previewPath: 'assets/weapons/kenney-blaster-kit/previews/blaster-a.png',
    modelBytes: 44_992,
    modelSha256: 'd6d6fe0ec5baf21d7717449220799d45b95d2d663ace7b22612b255dc1a8b308',
    magazineSize: 18,
    fireIntervalMs: 155,
    reloadMs: 620,
    recoilKick: 0.035,
    rangeUnits: 28,
    soundProfile: 'sidearm',
    view: {
      position: [0.32, -0.34, -0.88],
      rotation: [-0.08, VIEW_FORWARD_YAW, 0.02],
      scale: 0.68,
    },
  },
  {
    id: 'weapon.blaster.bore',
    label: 'BORE',
    role: 'close scatter',
    modelPath: 'assets/weapons/kenney-blaster-kit/models/blaster-h.glb',
    previewPath: 'assets/weapons/kenney-blaster-kit/previews/blaster-h.png',
    modelBytes: 28_380,
    modelSha256: 'f124a4ffd990a248e801aa451ab7ec4abde71a18c121b571f9bb52206609b36b',
    magazineSize: 8,
    fireIntervalMs: 470,
    reloadMs: 880,
    recoilKick: 0.085,
    rangeUnits: 18,
    soundProfile: 'scatter',
    view: {
      position: [0.36, -0.36, -0.98],
      rotation: [-0.1, VIEW_FORWARD_YAW, 0.02],
      scale: 0.82,
    },
  },
  {
    id: 'weapon.blaster.vault',
    label: 'VAULT',
    role: 'heavy pulse',
    modelPath: 'assets/weapons/kenney-blaster-kit/models/blaster-p.glb',
    previewPath: 'assets/weapons/kenney-blaster-kit/previews/blaster-p.png',
    modelBytes: 80_460,
    modelSha256: '2ffc94c6d8f12d45410012b13169988b70929c7e6ae7d4f868a188265210e49a',
    magazineSize: 12,
    fireIntervalMs: 285,
    reloadMs: 760,
    recoilKick: 0.065,
    rangeUnits: 24,
    soundProfile: 'heavy',
    view: {
      position: [0.4, -0.39, -1.08],
      rotation: [-0.09, VIEW_FORWARD_YAW, 0.03],
      scale: 0.72,
    },
  },
];

export function publicAssetUrl(path: string): string {
  return withAssetVersion(`${import.meta.env.BASE_URL}${path}`);
}

export function withAssetVersion(url: string): string {
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }

  const hashIndex = url.indexOf('#');
  const withoutHash = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const hash = hashIndex === -1 ? '' : url.slice(hashIndex);
  if (new RegExp(`[?&]${PUBLIC_ASSET_VERSION_PARAM}=`).test(withoutHash)) {
    return url;
  }

  const separator = withoutHash.includes('?') ? '&' : '?';
  return `${withoutHash}${separator}${PUBLIC_ASSET_VERSION_PARAM}=${encodeURIComponent(__SIGILBREAKER_BUILD_ID__)}${hash}`;
}
