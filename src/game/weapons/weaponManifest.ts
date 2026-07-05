export type WeaponSoundProfile = 'sidearm' | 'scatter' | 'heavy' | 'precision' | 'burst';
export { publicAssetUrl, withAssetVersion } from '../assetUrls';

export interface WeaponDefinition {
  id: string;
  label: string;
  role: string;
  modelPath: string;
  previewPath: string;
  modelBytes: number;
  modelSha256: string;
  magazineSize: number;
  damage: number;
  fireIntervalMs: number;
  reloadMs: number;
  recoilKick: number;
  rangeUnits: number;
  soundProfile: WeaponSoundProfile;
  view: {
    position: [number, number, number];
    aimPosition: [number, number, number];
    rotation: [number, number, number];
    aimRotation: [number, number, number];
    scale: number;
    aimScaleMultiplier: number;
    muzzleLocalOffset: [number, number, number];
    characterGrip: {
      position: [number, number, number];
      aimPosition: [number, number, number];
      rotation: [number, number, number];
      aimRotation: [number, number, number];
      scale: number;
      aimScaleMultiplier: number;
      clipTopY: number | null;
    };
  };
  effects: {
    muzzleColor: number;
    tracerColor: number;
    impactColor: number;
    muzzleScale: number;
    impactScale: number;
    tracerOpacity: number;
    flashMs: number;
    feedbackMs: number;
  };
}

const VIEW_FORWARD_YAW = 0;
const degreesToRadians = (value: number): number => (value * Math.PI) / 180;

function createVisibleArmGrip(): WeaponDefinition['view']['characterGrip'] {
  return {
    position: [-0.05, -0.6, 0.71],
    aimPosition: [-0.32, -1.36, 0.44],
    rotation: [degreesToRadians(1.15), Math.PI, degreesToRadians(-1.72)],
    aimRotation: [0, degreesToRadians(109), degreesToRadians(-0.57)],
    scale: 0.62,
    aimScaleMultiplier: 1.02,
    clipTopY: 0.28,
  };
}

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
    damage: 34,
    fireIntervalMs: 155,
    reloadMs: 620,
    recoilKick: 0.035,
    rangeUnits: 28,
    soundProfile: 'sidearm',
    view: {
      position: [0.52, -0.34, -0.88],
      aimPosition: [0, -0.28, -0.88],
      rotation: [-0.08, VIEW_FORWARD_YAW, 0.02],
      aimRotation: [-0.04, VIEW_FORWARD_YAW, 0],
      scale: 0.9,
      aimScaleMultiplier: 1.04,
      muzzleLocalOffset: [0.02, 0.03, -0.46],
      characterGrip: createVisibleArmGrip(),
    },
    effects: {
      muzzleColor: 0x8df7ff,
      tracerColor: 0x7dd3fc,
      impactColor: 0xb7f3ff,
      muzzleScale: 0.95,
      impactScale: 0.9,
      tracerOpacity: 0.82,
      flashMs: 60,
      feedbackMs: 90,
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
    damage: 72,
    fireIntervalMs: 470,
    reloadMs: 880,
    recoilKick: 0.085,
    rangeUnits: 18,
    soundProfile: 'scatter',
    view: {
      position: [0.56, -0.42, -0.98],
      aimPosition: [0, -0.36, -0.96],
      rotation: [-0.1, VIEW_FORWARD_YAW, 0.02],
      aimRotation: [-0.05, VIEW_FORWARD_YAW, 0],
      scale: 1.09,
      aimScaleMultiplier: 1.04,
      muzzleLocalOffset: [-0.05, 0.08, -0.4],
      characterGrip: createVisibleArmGrip(),
    },
    effects: {
      muzzleColor: 0xff8a3d,
      tracerColor: 0xffc45c,
      impactColor: 0xff7a3c,
      muzzleScale: 1.22,
      impactScale: 1.16,
      tracerOpacity: 0.88,
      flashMs: 82,
      feedbackMs: 112,
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
    damage: 48,
    fireIntervalMs: 285,
    reloadMs: 760,
    recoilKick: 0.065,
    rangeUnits: 24,
    soundProfile: 'heavy',
    view: {
      position: [0.6, -0.45, -1.08],
      aimPosition: [0, -0.4, -1.04],
      rotation: [-0.09, VIEW_FORWARD_YAW, 0.03],
      aimRotation: [-0.05, VIEW_FORWARD_YAW, 0],
      scale: 0.95,
      aimScaleMultiplier: 1.04,
      muzzleLocalOffset: [-0.06, 0.05, -0.52],
      characterGrip: createVisibleArmGrip(),
    },
    effects: {
      muzzleColor: 0xc084fc,
      tracerColor: 0xe879f9,
      impactColor: 0xa78bfa,
      muzzleScale: 1.34,
      impactScale: 1.28,
      tracerOpacity: 0.94,
      flashMs: 96,
      feedbackMs: 128,
    },
  },
  {
    id: 'weapon.blaster.rift',
    label: 'RIFT',
    role: 'precision rail',
    modelPath: 'assets/weapons/kenney-blaster-kit/models/blaster-q.glb',
    previewPath: 'assets/weapons/kenney-blaster-kit/previews/blaster-q.png',
    modelBytes: 55_856,
    modelSha256: 'e2062bf76cf9ea7690acbb5ae18c9d92be5f7623ec3a2f4b363eb926d1017522',
    magazineSize: 6,
    damage: 92,
    fireIntervalMs: 620,
    reloadMs: 980,
    recoilKick: 0.11,
    rangeUnits: 36,
    soundProfile: 'precision',
    view: {
      position: [0.58, -0.43, -1.08],
      aimPosition: [0, -0.36, -1.04],
      rotation: [-0.09, VIEW_FORWARD_YAW, 0.02],
      aimRotation: [-0.045, VIEW_FORWARD_YAW, 0],
      scale: 1.02,
      aimScaleMultiplier: 1.06,
      muzzleLocalOffset: [-0.04, 0.08, -0.55],
      characterGrip: createVisibleArmGrip(),
    },
    effects: {
      muzzleColor: 0x34d399,
      tracerColor: 0x86efac,
      impactColor: 0x22c55e,
      muzzleScale: 1.08,
      impactScale: 1.04,
      tracerOpacity: 0.9,
      flashMs: 74,
      feedbackMs: 118,
    },
  },
  {
    id: 'weapon.blaster.torch',
    label: 'TORCH',
    role: 'burst carbine',
    modelPath: 'assets/weapons/kenney-blaster-kit/models/blaster-m.glb',
    previewPath: 'assets/weapons/kenney-blaster-kit/previews/blaster-m.png',
    modelBytes: 41_532,
    modelSha256: 'ff3f1196f2e9acabbdc44143dc3b93f79f4c5e8176e54514479bd2b788477c80',
    magazineSize: 24,
    damage: 24,
    fireIntervalMs: 105,
    reloadMs: 700,
    recoilKick: 0.027,
    rangeUnits: 22,
    soundProfile: 'burst',
    view: {
      position: [0.56, -0.39, -0.98],
      aimPosition: [0, -0.33, -0.96],
      rotation: [-0.085, VIEW_FORWARD_YAW, 0.02],
      aimRotation: [-0.04, VIEW_FORWARD_YAW, 0],
      scale: 1.06,
      aimScaleMultiplier: 1.05,
      muzzleLocalOffset: [-0.02, 0.07, -0.45],
      characterGrip: createVisibleArmGrip(),
    },
    effects: {
      muzzleColor: 0xfb7185,
      tracerColor: 0xfda4af,
      impactColor: 0xf43f5e,
      muzzleScale: 1.02,
      impactScale: 0.98,
      tracerOpacity: 0.86,
      flashMs: 54,
      feedbackMs: 82,
    },
  },
];
