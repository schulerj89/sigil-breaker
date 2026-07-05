import type { WeaponSoundProfile } from './weaponManifest';
import {
  FOUNDATION_MUSIC_ASSET,
  GAME_AUDIO_ASSETS,
  MUSIC_AUDIO_ASSETS,
  TITLE_MUSIC_ASSET,
  WEAPON_AUDIO_ASSETS,
  type GameAudioAsset,
} from '../audioManifest';
import { publicAssetUrl } from '../assetUrls';

const SFX_POOL_SIZE = 4;
const ENEMY_PROJECTILE_SOURCE_PROFILE: WeaponSoundProfile = 'precision';
const ENEMY_PROJECTILE_GAIN = 0.54;
const ENEMY_PROJECTILE_PLAYBACK_RATE = 0.72;

export interface WeaponAudioSnapshot {
  musicMuted: boolean;
  musicPlaying: boolean;
  musicDecoded: boolean;
  activeMusicAssetId: string;
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

interface LoadedMusicAsset {
  id: string;
  url: string;
  bytes: number;
  volume: number;
  sourceBytes: ArrayBuffer | null;
  buffer: AudioBuffer | null;
  decodePromise: Promise<void> | null;
}

interface SfxPlaybackOptions {
  gainMultiplier?: number;
  playbackRate?: number;
}

export type MusicPhase = 'title' | 'gameplay';

type BrowserWindowWithAudioContext = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

export class WeaponAudio {
  private audioContext: AudioContext | null = null;
  private readonly loadedAssetIds = new Set<string>();
  private readonly assetLoadErrors: string[] = [];
  private readonly sfxByProfile = new Map<WeaponSoundProfile, LoadedAudioAsset>();
  private readonly musicById = new Map<string, LoadedMusicAsset>();
  private activeMusicAsset = TITLE_MUSIC_ASSET;
  private musicSource: AudioBufferSourceNode | null = null;
  private musicGain: GainNode | null = null;
  private musicSourceAssetId: string | null = null;
  private musicMuted = false;
  private unlocked = false;
  private playRequests = 0;
  private enemyProjectilePlayRequests = 0;
  private webAudioPlayRequests = 0;
  private htmlFallbackPlayRequests = 0;
  private missedPlayRequests = 0;
  private playFailures = 0;
  private root: HTMLElement | null = null;

  constructor() {
    this.createSfxPools();
    this.createMusicCache();
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

  setMusicPhase(phase: MusicPhase): void {
    const nextAsset = phase === 'gameplay' ? FOUNDATION_MUSIC_ASSET : TITLE_MUSIC_ASSET;
    if (nextAsset.id === this.activeMusicAsset.id) {
      return;
    }

    this.activeMusicAsset = nextAsset;
    this.stopMusic();
    if (this.unlocked && !this.musicMuted) {
      void this.ensureMusicPlaying();
    }
    this.updateMusicButtonState();
  }

  getSnapshot(): WeaponAudioSnapshot {
    const activeMusic = this.getActiveMusicAsset();
    return {
      musicMuted: this.musicMuted,
      musicPlaying: this.musicSource !== null && this.musicSourceAssetId === activeMusic.id && !this.musicMuted,
      musicDecoded: activeMusic.buffer !== null,
      activeMusicAssetId: this.activeMusicAsset.id,
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
    this.stopMusic();
    for (const asset of this.musicById.values()) {
      asset.sourceBytes = null;
      asset.buffer = null;
      asset.decodePromise = null;
    }
    this.musicById.clear();
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
    const musicChecks = MUSIC_AUDIO_ASSETS.map((definition) => this.verifyMusicAsset(definition));

    await Promise.all([...weaponChecks, ...musicChecks]);
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

  private createMusicCache(): void {
    for (const definition of MUSIC_AUDIO_ASSETS) {
      this.musicById.set(definition.id, {
        id: definition.id,
        url: publicAssetUrl(definition.path),
        bytes: definition.bytes,
        volume: definition.volume,
        sourceBytes: null,
        buffer: null,
        decodePromise: null,
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

  private async verifyMusicAsset(definition: GameAudioAsset): Promise<void> {
    const asset = this.musicById.get(definition.id);
    const sourceBytes = await this.fetchVerifiedAsset(definition.id, asset?.url ?? publicAssetUrl(definition.path), definition.bytes);
    if (!sourceBytes || !asset) {
      return;
    }

    asset.sourceBytes = sourceBytes;
    void this.decodeMusicAsset(asset).then(() => this.ensureMusicPlaying());
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
    void this.ensureMusicPlaying();
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

  private async decodeMusicAsset(asset = this.getActiveMusicAsset()): Promise<void> {
    const context = this.audioContext;
    if (
      !context ||
      context.state === 'closed' ||
      asset.buffer ||
      asset.decodePromise ||
      !asset.sourceBytes
    ) {
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

  private async ensureMusicPlaying(): Promise<void> {
    const activeMusic = this.getActiveMusicAsset();
    if (this.musicMuted || this.musicSource || !this.loadedAssetIds.has(activeMusic.id)) {
      this.updateMusicGain();
      return;
    }

    const context = this.audioContext;
    if (!context || context.state === 'closed') {
      return;
    }

    if (context.state === 'suspended') {
      await context.resume().catch(() => undefined);
    }
    await this.decodeMusicAsset(activeMusic);
    if (this.musicMuted || this.musicSource || !activeMusic.buffer || this.audioContext !== context) {
      this.updateMusicGain();
      return;
    }

    try {
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = activeMusic.buffer;
      source.loop = true;
      gain.gain.value = activeMusic.volume;
      source.connect(gain).connect(context.destination);
      source.onended = () => {
        if (this.musicSource === source) {
          this.musicSource = null;
          this.musicGain = null;
          this.musicSourceAssetId = null;
        }
      };
      source.start();
      this.musicSource = source;
      this.musicGain = gain;
      this.musicSourceAssetId = activeMusic.id;
      this.updateMusicGain();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.assetLoadErrors.push(`${activeMusic.id}: play failed: ${message}`);
    }
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
    this.updateMusicGain();
    if (!this.musicMuted) {
      this.unlock();
    }
    this.updateMusicButtonState();
  }

  private updateMusicGain(): void {
    if (!this.musicGain) {
      return;
    }

    this.musicGain.gain.value = this.musicMuted ? 0 : this.getActiveMusicAsset().volume;
  }

  private stopMusic(): void {
    const source = this.musicSource;
    this.musicSource = null;
    this.musicSourceAssetId = null;
    this.musicGain?.disconnect();
    this.musicGain = null;
    if (!source) {
      return;
    }

    source.onended = null;
    try {
      source.stop();
    } catch {
      // Already stopped by the audio graph.
    }
    source.disconnect();
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

  private getActiveMusicAsset(): LoadedMusicAsset {
    const asset = this.musicById.get(this.activeMusicAsset.id);
    if (!asset) {
      throw new Error(`Missing music asset ${this.activeMusicAsset.id}`);
    }
    return asset;
  }
}

function createAudioPool(url: string, size: number): HTMLAudioElement[] {
  return Array.from({ length: size }, () => {
    const audio = new Audio(url);
    audio.preload = 'auto';
    audio.load();
    return audio;
  });
}
