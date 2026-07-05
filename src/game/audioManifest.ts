import type { WeaponSoundProfile } from './weapons/weaponManifest';

export interface GameAudioAsset {
  id: string;
  path: string;
  bytes: number;
  volume: number;
  kind: 'music' | 'sfx' | 'voice';
}

export const WEAPON_AUDIO_ASSETS: Record<WeaponSoundProfile, GameAudioAsset> = {
  sidearm: {
    id: 'audio.weapon.spark.elevenlabs',
    path: 'assets/audio/elevenlabs-foundation/spark-sidearm.mp3',
    bytes: 17_180,
    volume: 0.82,
    kind: 'sfx',
  },
  scatter: {
    id: 'audio.weapon.bore.elevenlabs',
    path: 'assets/audio/elevenlabs-foundation/bore-scatter.mp3',
    bytes: 20_106,
    volume: 0.9,
    kind: 'sfx',
  },
  heavy: {
    id: 'audio.weapon.vault.elevenlabs',
    path: 'assets/audio/elevenlabs-foundation/vault-heavy.mp3',
    bytes: 18_434,
    volume: 1.8,
    kind: 'sfx',
  },
  precision: {
    id: 'audio.weapon.rift.elevenlabs',
    path: 'assets/audio/elevenlabs-foundation/rift-precision.mp3',
    bytes: 17_180,
    volume: 0.92,
    kind: 'sfx',
  },
  burst: {
    id: 'audio.weapon.torch.elevenlabs',
    path: 'assets/audio/elevenlabs-foundation/torch-burst.mp3',
    bytes: 17_598,
    volume: 0.88,
    kind: 'sfx',
  },
};

export const FOUNDATION_MUSIC_ASSET: GameAudioAsset = {
  id: 'audio.music.foundation.elevenlabs',
  path: 'assets/audio/elevenlabs-foundation/foundation-combat-loop-long.mp3',
  bytes: 768_254,
  volume: 0.34,
  kind: 'music',
};

export const TITLE_MUSIC_ASSET: GameAudioAsset = {
  id: 'audio.music.title.industrial-guitar.elevenlabs',
  path: 'assets/audio/elevenlabs-foundation/title-industrial-guitar-loop.mp3',
  bytes: 1_440_750,
  volume: 0.46,
  kind: 'music',
};

export const MUSIC_AUDIO_ASSETS = [
  TITLE_MUSIC_ASSET,
  FOUNDATION_MUSIC_ASSET,
] as const;

export const GAME_AUDIO_ASSETS = [
  WEAPON_AUDIO_ASSETS.sidearm,
  WEAPON_AUDIO_ASSETS.scatter,
  WEAPON_AUDIO_ASSETS.heavy,
  WEAPON_AUDIO_ASSETS.precision,
  WEAPON_AUDIO_ASSETS.burst,
  TITLE_MUSIC_ASSET,
  FOUNDATION_MUSIC_ASSET,
] as const;
