import type { WeaponSoundProfile } from './weaponManifest';
import { FOUNDATION_MUSIC_ASSET, GAME_AUDIO_ASSETS, WEAPON_AUDIO_ASSETS } from '../audioManifest';
import { publicAssetUrl } from '../assetUrls';

const MUSIC_MUTED_STORAGE_KEY = 'sigilbreaker.foundation.musicMuted';
const SFX_POOL_SIZE = 4;

export interface WeaponAudioSnapshot {
  musicMuted: boolean;
  musicPlaying: boolean;
  unlocked: boolean;
  loadedAssetIds: string[];
  assetLoadErrors: string[];
  assetBytesLoaded: number;
}

interface LoadedAudioAsset {
  id: string;
  url: string;
  bytes: number;
  volume: number;
  pool: HTMLAudioElement[];
  nextIndex: number;
}

type BrowserWindowWithAudioContext = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

export class WeaponAudio {
  private audioContext: AudioContext | null = null;
  private readonly loadedAssetIds = new Set<string>();
  private readonly assetLoadErrors: string[] = [];
  private readonly sfxByProfile = new Map<WeaponSoundProfile, LoadedAudioAsset>();
  private readonly music = new Audio(publicAssetUrl(FOUNDATION_MUSIC_ASSET.path));
  private musicMuted = readStoredMusicMuted();
  private unlocked = false;
  private root: HTMLElement | null = null;

  constructor() {
    this.music.loop = true;
    this.music.preload = 'auto';
    this.music.volume = this.musicMuted ? 0 : FOUNDATION_MUSIC_ASSET.volume;
    void this.preload();
  }

  bind(root: HTMLElement): void {
    this.root = root;
    this.root.addEventListener('pointerdown', this.onPointerDown);
    this.updateMusicButtonState();
  }

  play(profile: WeaponSoundProfile): void {
    this.unlock();
    const asset = this.sfxByProfile.get(profile);
    if (!asset || asset.pool.length === 0) {
      return;
    }

    const audio = asset.pool[asset.nextIndex % asset.pool.length];
    asset.nextIndex = (asset.nextIndex + 1) % asset.pool.length;
    audio.pause();
    audio.currentTime = 0;
    audio.volume = asset.volume;
    void audio.play().catch(() => undefined);
  }

  getSnapshot(): WeaponAudioSnapshot {
    return {
      musicMuted: this.musicMuted,
      musicPlaying: !this.music.paused && !this.musicMuted,
      unlocked: this.unlocked,
      loadedAssetIds: [...this.loadedAssetIds].sort(),
      assetLoadErrors: [...this.assetLoadErrors],
      assetBytesLoaded: GAME_AUDIO_ASSETS.reduce(
        (total, asset) => (this.loadedAssetIds.has(asset.id) ? total + asset.bytes : total),
        0,
      ),
    };
  }

  dispose(): void {
    this.root?.removeEventListener('pointerdown', this.onPointerDown);
    this.root = null;
    for (const asset of this.sfxByProfile.values()) {
      for (const audio of asset.pool) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
    }
    this.sfxByProfile.clear();
    this.music.pause();
    this.music.removeAttribute('src');
    this.music.load();
    if (this.audioContext?.state !== 'closed') {
      void this.audioContext?.close();
    }
    this.audioContext = null;
  }

  private async preload(): Promise<void> {
    for (const [profile, definition] of Object.entries(WEAPON_AUDIO_ASSETS) as Array<
      [WeaponSoundProfile, (typeof WEAPON_AUDIO_ASSETS)[WeaponSoundProfile]]
    >) {
      const url = publicAssetUrl(definition.path);
      const ok = await this.verifyAsset(definition.id, url, definition.bytes);
      if (!ok) {
        continue;
      }

      this.sfxByProfile.set(profile, {
        id: definition.id,
        url,
        bytes: definition.bytes,
        volume: definition.volume,
        pool: createAudioPool(url, SFX_POOL_SIZE),
        nextIndex: 0,
      });
    }

    const musicUrl = publicAssetUrl(FOUNDATION_MUSIC_ASSET.path);
    const musicOk = await this.verifyAsset(FOUNDATION_MUSIC_ASSET.id, musicUrl, FOUNDATION_MUSIC_ASSET.bytes);
    if (musicOk) {
      this.music.src = musicUrl;
      this.music.load();
    }
  }

  private async verifyAsset(assetId: string, url: string, expectedBytes: number): Promise<boolean> {
    try {
      const response = await fetch(url, { cache: 'force-cache' });
      if (!response.ok) {
        this.assetLoadErrors.push(`${assetId}: ${response.status} ${response.statusText}`);
        return false;
      }

      const blob = await response.blob();
      if (blob.size !== expectedBytes) {
        this.assetLoadErrors.push(`${assetId}: expected ${expectedBytes}B, loaded ${blob.size}B`);
        return false;
      }
      this.loadedAssetIds.add(assetId);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.assetLoadErrors.push(`${assetId}: ${message}`);
      return false;
    }
  }

  private unlock(): void {
    this.unlocked = true;
    if (this.audioContext) {
      if (this.audioContext.state === 'suspended') {
        void this.audioContext.resume();
      }
    } else {
      const AudioContextCtor = window.AudioContext ?? (window as BrowserWindowWithAudioContext).webkitAudioContext;
      this.audioContext = new AudioContextCtor();
    }

    if (!this.musicMuted && this.loadedAssetIds.has(FOUNDATION_MUSIC_ASSET.id)) {
      void this.music.play().catch(() => undefined);
    }
  }

  private toggleMusic(): void {
    this.musicMuted = !this.musicMuted;
    storeMusicMuted(this.musicMuted);
    this.music.volume = this.musicMuted ? 0 : FOUNDATION_MUSIC_ASSET.volume;
    if (this.musicMuted) {
      this.music.pause();
    } else {
      this.unlock();
    }
    this.updateMusicButtonState();
  }

  private updateMusicButtonState(): void {
    const button = this.root?.querySelector<HTMLButtonElement>('[data-music-toggle]');
    if (!button) {
      return;
    }

    button.classList.toggle('hud__icon-button--muted', this.musicMuted);
    button.setAttribute('aria-pressed', String(this.musicMuted));
    button.setAttribute('aria-label', this.musicMuted ? 'Unmute music' : 'Mute music');
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    if (target.closest('[data-music-toggle]')) {
      event.preventDefault();
      this.toggleMusic();
      return;
    }

    this.unlock();
  };
}

function createAudioPool(url: string, size: number): HTMLAudioElement[] {
  return Array.from({ length: size }, () => {
    const audio = new Audio(url);
    audio.preload = 'auto';
    return audio;
  });
}

function readStoredMusicMuted(): boolean {
  try {
    return window.localStorage.getItem(MUSIC_MUTED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function storeMusicMuted(value: boolean): void {
  try {
    window.localStorage.setItem(MUSIC_MUTED_STORAGE_KEY, value ? '1' : '0');
  } catch {
    // Storage can be unavailable in privacy modes; mute still works for this session.
  }
}
