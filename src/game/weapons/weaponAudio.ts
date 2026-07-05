import type { WeaponSoundProfile } from './weaponManifest';
import {
  FOUNDATION_MUSIC_ASSET,
  GAME_AUDIO_ASSETS,
  WEAPON_AUDIO_ASSETS,
  type GameAudioAsset,
} from '../audioManifest';
import { publicAssetUrl } from '../assetUrls';

const MUSIC_MUTED_STORAGE_KEY = 'sigilbreaker.foundation.musicMuted';
const SFX_POOL_SIZE = 4;
const ENEMY_PROJECTILE_SOURCE_PROFILE: WeaponSoundProfile = 'precision';
const ENEMY_PROJECTILE_GAIN = 0.54;
const ENEMY_PROJECTILE_PLAYBACK_RATE = 0.72;

export interface WeaponAudioSnapshot {
  musicMuted: boolean;
  musicPlaying: boolean;
  unlocked: boolean;
  sfxPoolProfiles: WeaponSoundProfile[];
  decodedSfxProfiles: WeaponSoundProfile[];
  playRequests: number;
  enemyProjectilePlayRequests: number;
  webAudioPlayRequests: number;
  htmlFallbackPlayRequests: number;
  missedPlayRequests: number;
  playFailures: number;
  loadedAssetIds: string[];
  assetLoadErrors: string[];
  assetBytesLoaded: number;
}

interface LoadedAudioAsset {
  id: string;
  url: string;
  bytes: number;
  volume: number;
  sourceBytes: ArrayBuffer | null;
  buffer: AudioBuffer | null;
  decodePromise: Promise<void> | null;
  pool: HTMLAudioElement[];
  nextIndex: number;
}

interface SfxPlaybackOptions {
  gainMultiplier?: number;
  playbackRate?: number;
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
  private playRequests = 0;
  private enemyProjectilePlayRequests = 0;
  private webAudioPlayRequests = 0;
  private htmlFallbackPlayRequests = 0;
  private missedPlayRequests = 0;
  private playFailures = 0;
  private root: HTMLElement | null = null;

  constructor() {
    this.music.loop = true;
    this.music.preload = 'auto';
    this.music.volume = this.musicMuted ? 0 : FOUNDATION_MUSIC_ASSET.volume;
    this.createSfxPools();
    void this.preload();
  }

  bind(root: HTMLElement): void {
    this.root = root;
    this.root.addEventListener('pointerdown', this.onPointerDown);
    this.updateMusicButtonState();
  }

  play(profile: WeaponSoundProfile): void {
    this.playRequests++;
    this.unlock();
    const asset = this.sfxByProfile.get(profile);
    if (!asset || asset.pool.length === 0) {
      this.missedPlayRequests++;
      return;
    }

    if (this.playBufferedSfx(asset)) {
      return;
    }

    this.playHtmlSfx(asset);
  }

  playEnemyProjectile(): void {
    this.enemyProjectilePlayRequests++;
    this.unlock();
    const asset = this.sfxByProfile.get(ENEMY_PROJECTILE_SOURCE_PROFILE);
    if (!asset || asset.pool.length === 0) {
      this.missedPlayRequests++;
      return;
    }

    if (
      this.playBufferedSfx(asset, {
        gainMultiplier: ENEMY_PROJECTILE_GAIN,
        playbackRate: ENEMY_PROJECTILE_PLAYBACK_RATE,
      })
    ) {
      return;
    }

    this.playHtmlSfx(asset, {
      gainMultiplier: ENEMY_PROJECTILE_GAIN,
    });
  }

  getSnapshot(): WeaponAudioSnapshot {
    return {
      musicMuted: this.musicMuted,
      musicPlaying: !this.music.paused && !this.musicMuted,
      unlocked: this.unlocked,
      sfxPoolProfiles: [...this.sfxByProfile.keys()].sort(),
      decodedSfxProfiles: [...this.sfxByProfile.entries()]
        .filter(([, asset]) => asset.buffer !== null)
        .map(([profile]) => profile)
        .sort(),
      playRequests: this.playRequests,
      enemyProjectilePlayRequests: this.enemyProjectilePlayRequests,
      webAudioPlayRequests: this.webAudioPlayRequests,
      htmlFallbackPlayRequests: this.htmlFallbackPlayRequests,
      missedPlayRequests: this.missedPlayRequests,
      playFailures: this.playFailures,
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
      asset.sourceBytes = null;
      asset.buffer = null;
      asset.decodePromise = null;
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
    const weaponChecks = (Object.entries(WEAPON_AUDIO_ASSETS) as Array<
      [WeaponSoundProfile, (typeof WEAPON_AUDIO_ASSETS)[WeaponSoundProfile]]
    >).map(async ([profile, definition]) => {
      await this.verifySfxAsset(profile, definition);
    });

    const musicUrl = publicAssetUrl(FOUNDATION_MUSIC_ASSET.path);
    const musicBytes = await this.fetchVerifiedAsset(
      FOUNDATION_MUSIC_ASSET.id,
      musicUrl,
      FOUNDATION_MUSIC_ASSET.bytes,
    );
    if (musicBytes) {
      this.music.src = musicUrl;
      this.music.load();
    }
    await Promise.all(weaponChecks);
  }

  private createSfxPools(): void {
    for (const [profile, definition] of Object.entries(WEAPON_AUDIO_ASSETS) as Array<
      [WeaponSoundProfile, (typeof WEAPON_AUDIO_ASSETS)[WeaponSoundProfile]]
    >) {
      const url = publicAssetUrl(definition.path);
      this.sfxByProfile.set(profile, {
        id: definition.id,
        url,
        bytes: definition.bytes,
        volume: definition.volume,
        sourceBytes: null,
        buffer: null,
        decodePromise: null,
        pool: createAudioPool(url, SFX_POOL_SIZE),
        nextIndex: 0,
      });
    }
  }

  private async verifySfxAsset(profile: WeaponSoundProfile, definition: GameAudioAsset): Promise<void> {
    const asset = this.sfxByProfile.get(profile);
    const url = asset?.url ?? publicAssetUrl(definition.path);
    const sourceBytes = await this.fetchVerifiedAsset(definition.id, url, definition.bytes);
    if (!sourceBytes || !asset) {
      return;
    }

    asset.sourceBytes = sourceBytes;
    void this.decodeSfxAsset(asset);
  }

  private async fetchVerifiedAsset(assetId: string, url: string, expectedBytes: number): Promise<ArrayBuffer | null> {
    try {
      const response = await fetch(url, { cache: 'force-cache' });
      if (!response.ok) {
        this.assetLoadErrors.push(`${assetId}: ${response.status} ${response.statusText}`);
        return null;
      }

      const sourceBytes = await response.arrayBuffer();
      if (sourceBytes.byteLength !== expectedBytes) {
        this.assetLoadErrors.push(`${assetId}: expected ${expectedBytes}B, loaded ${sourceBytes.byteLength}B`);
        return null;
      }
      this.loadedAssetIds.add(assetId);
      return sourceBytes;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.assetLoadErrors.push(`${assetId}: ${message}`);
      return null;
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
    void this.decodeAllSfxAssets();

    if (!this.musicMuted && this.loadedAssetIds.has(FOUNDATION_MUSIC_ASSET.id)) {
      void this.music.play().catch(() => undefined);
    }
  }

  private async decodeAllSfxAssets(): Promise<void> {
    await Promise.all([...this.sfxByProfile.values()].map((asset) => this.decodeSfxAsset(asset)));
  }

  private async decodeSfxAsset(asset: LoadedAudioAsset): Promise<void> {
    const context = this.audioContext;
    if (!context || context.state === 'closed' || asset.buffer || asset.decodePromise || !asset.sourceBytes) {
      return asset.decodePromise ?? Promise.resolve();
    }

    asset.decodePromise = context
      .decodeAudioData(asset.sourceBytes.slice(0))
      .then((buffer) => {
        asset.buffer = buffer;
        asset.sourceBytes = null;
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.assetLoadErrors.push(`${asset.id}: decode failed: ${message}`);
        asset.sourceBytes = null;
      })
      .finally(() => {
        asset.decodePromise = null;
      });

    return asset.decodePromise;
  }

  private playBufferedSfx(asset: LoadedAudioAsset, options: SfxPlaybackOptions = {}): boolean {
    const context = this.audioContext;
    if (!context || context.state === 'closed' || !asset.buffer) {
      return false;
    }

    try {
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = asset.buffer;
      source.playbackRate.value = options.playbackRate ?? 1;
      gain.gain.value = asset.volume * (options.gainMultiplier ?? 1);
      source.connect(gain).connect(context.destination);
      source.start();
      this.webAudioPlayRequests++;
      return true;
    } catch {
      this.playFailures++;
      return false;
    }
  }

  private playHtmlSfx(asset: LoadedAudioAsset, options: SfxPlaybackOptions = {}): void {
    const audio = asset.pool[asset.nextIndex % asset.pool.length];
    asset.nextIndex = (asset.nextIndex + 1) % asset.pool.length;
    audio.pause();
    audio.currentTime = 0;
    audio.volume = Math.min(1, Math.max(0, asset.volume * (options.gainMultiplier ?? 1)));
    this.htmlFallbackPlayRequests++;
    void audio.play().catch(() => {
      this.playFailures++;
    });
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
    audio.load();
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
