import type { WeaponSoundProfile } from './weapons/weaponManifest';

export interface GameAudioAsset {
  id: string;
  path: string;
  bytes: number;
  volume: number;
  kind: 'music' | 'sfx';
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
    volume: 1,
    kind: 'sfx',
  },
};

export const FOUNDATION_MUSIC_ASSET: GameAudioAsset = {
  id: 'audio.music.foundation.elevenlabs',
  path: 'assets/audio/elevenlabs-foundation/foundation-combat-loop.mp3',
  bytes: 384_149,
  volume: 0.34,
  kind: 'music',
};

export const GAME_AUDIO_ASSETS = [
  WEAPON_AUDIO_ASSETS.sidearm,
  WEAPON_AUDIO_ASSETS.scatter,
  WEAPON_AUDIO_ASSETS.heavy,
  FOUNDATION_MUSIC_ASSET,
] as const;
