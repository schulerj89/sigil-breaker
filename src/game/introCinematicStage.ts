import * as THREE from 'three';
import { publicAssetUrl } from './assetUrls';
import {
  COMMANDER_VOICE_NAME,
  INTRO_COMMANDER_VOICE_LINES,
  type CharacterVoiceLine,
} from './characterVoice';
import { getLevelTiles, getSpawnPosition, type LevelTile } from './levelMap';

export const INTRO_COMMANDER_PORTRAIT_ASSET_ID = 'ui.cinematic.commander-kade.hologram';
export const INTRO_COMMANDER_PORTRAIT_PATH = 'assets/characters/commander-kade/commander-kade-hologram.webp';
export const INTRO_CINEMATIC_SKIP_UNLOCK_SECONDS = 2;
export const INTRO_CINEMATIC_TOTAL_SECONDS = 35.2;

interface IntroCinematicCue {
  cueId: string;
  startSeconds: number;
  endSeconds: number;
  line: CharacterVoiceLine;
  shotLabel: string;
}

interface IntroShot {
  cueId: string;
  cameraStart: THREE.Vector3;
  cameraEnd: THREE.Vector3;
  lookStart: THREE.Vector3;
  lookEnd: THREE.Vector3;
  fovStart: number;
  fovEnd: number;
}

export interface IntroCinematicStageSnapshot {
  assetId: string;
  portraitPath: string;
  portraitLoaded: boolean;
  visible: boolean;
  phaseTimeSeconds: number;
  totalSeconds: number;
  skipAvailable: boolean;
  activeCueId: string | null;
  activeVoiceAssetId: string | null;
  currentSpeaker: string;
  currentCaption: string;
  currentShotLabel: string;
  streamingAnchor: [number, number, number];
  errors: string[];
}

export interface IntroCinematicOpenOptions {
  onCue: (line: CharacterVoiceLine) => void;
  onComplete: () => void;
}

const INTRO_CUES: readonly IntroCinematicCue[] = [
  {
    cueId: 'deck-breach',
    startSeconds: 0.65,
    endSeconds: 6.25,
    line: INTRO_COMMANDER_VOICE_LINES[0],
    shotLabel: 'RIFT BREACH',
  },
  {
    cueId: 'hostiles',
    startSeconds: 6.35,
    endSeconds: 14.75,
    line: INTRO_COMMANDER_VOICE_LINES[1],
    shotLabel: 'ROOM CLEAR',
  },
  {
    cueId: 'weapons',
    startSeconds: 14.85,
    endSeconds: 20.65,
    line: INTRO_COMMANDER_VOICE_LINES[2],
    shotLabel: 'SPARK / BORE',
  },
  {
    cueId: 'survival',
    startSeconds: 20.75,
    endSeconds: 28.35,
    line: INTRO_COMMANDER_VOICE_LINES[3],
    shotLabel: 'LIGHT SUIT',
  },
  {
    cueId: 'exit-rift',
    startSeconds: 28.45,
    endSeconds: INTRO_CINEMATIC_TOTAL_SECONDS,
    line: INTRO_COMMANDER_VOICE_LINES[4],
    shotLabel: 'EXIT RIFT',
  },
] as const;

export class IntroCinematicStage {
  private readonly screen: HTMLElement | null;
  private readonly portraitImage: HTMLElement | null;
  private readonly speakerElement: HTMLElement | null;
  private readonly captionElement: HTMLElement | null;
  private readonly shotLabelElement: HTMLElement | null;
  private readonly portrait = new Image();
  private readonly errors: string[] = [];
  private readonly spawnPosition = getSpawnPosition();
  private readonly exitTile = readExitTile();
  private readonly enemyTiles = getLevelTiles().filter((tile) => tile.symbol === 'E');
  private readonly cameraPosition = new THREE.Vector3();
  private readonly lookTarget = new THREE.Vector3();
  private readonly streamingAnchor = new THREE.Vector3();
  private readonly shots: readonly IntroShot[];
  private loadPromise: Promise<void> | null = null;
  private portraitLoaded = false;
  private visible = false;
  private completed = false;
  private phaseTimeSeconds = 0;
  private originalFov = 70;
  private activeCue: IntroCinematicCue | null = null;
  private readonly playedCueIds = new Set<string>();
  private cueHandler: ((line: CharacterVoiceLine) => void) | null = null;
  private completeHandler: (() => void) | null = null;

  constructor(
    root: HTMLElement,
    private readonly camera: THREE.PerspectiveCamera,
  ) {
    this.screen = root.querySelector<HTMLElement>('[data-intro-cinematic]');
    this.portraitImage = root.querySelector<HTMLElement>('[data-intro-portrait-image]');
    this.speakerElement = root.querySelector<HTMLElement>('[data-intro-speaker]');
    this.captionElement = root.querySelector<HTMLElement>('[data-intro-caption]');
    this.shotLabelElement = root.querySelector<HTMLElement>('[data-intro-shot-label]');
    this.shots = createIntroShots(this.spawnPosition, this.exitTile, this.enemyTiles);
    this.streamingAnchor.set(this.spawnPosition.x, 1.6, this.spawnPosition.z);
  }

  load(): Promise<void> {
    if (this.portraitLoaded) {
      return Promise.resolve();
    }

    this.loadPromise ??= new Promise<void>((resolve) => {
      const portraitUrl = publicAssetUrl(INTRO_COMMANDER_PORTRAIT_PATH);
      if (this.portraitImage) {
        this.portraitImage.style.backgroundImage = `url("${portraitUrl}")`;
      }
      this.portrait.onload = () => {
        this.portraitLoaded = true;
        resolve();
      };
      this.portrait.onerror = () => {
        this.errors.push(`${INTRO_COMMANDER_PORTRAIT_ASSET_ID}: failed to load`);
        resolve();
      };
      this.portrait.src = portraitUrl;
    });

    return this.loadPromise;
  }

  open(options: IntroCinematicOpenOptions): void {
    this.visible = true;
    this.completed = false;
    this.phaseTimeSeconds = 0;
    this.originalFov = this.camera.fov;
    this.activeCue = null;
    this.playedCueIds.clear();
    this.cueHandler = options.onCue;
    this.completeHandler = options.onComplete;
    this.screen?.classList.remove('intro-cinematic--skip-visible');
    this.setSpeaker(COMMANDER_VOICE_NAME);
    this.setCaption('Rift link opening...');
    this.setShotLabel('MISSION BRIEF');
    this.applyCamera();
    void this.load();
  }

  close(): void {
    this.visible = false;
    this.completed = true;
    this.cueHandler = null;
    this.completeHandler = null;
    this.screen?.classList.remove('intro-cinematic--skip-visible');
    this.camera.fov = this.originalFov;
    this.camera.updateProjectionMatrix();
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    if (!visible) {
      this.screen?.classList.remove('intro-cinematic--skip-visible');
    }
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  update(deltaSeconds: number): void {
    if (!this.visible || this.completed) {
      return;
    }

    this.phaseTimeSeconds = Math.min(INTRO_CINEMATIC_TOTAL_SECONDS, this.phaseTimeSeconds + deltaSeconds);
    this.screen?.classList.toggle('intro-cinematic--skip-visible', this.isSkipAvailable());
    this.applyCueState();
    this.applyCamera();

    if (this.phaseTimeSeconds >= INTRO_CINEMATIC_TOTAL_SECONDS) {
      this.completed = true;
      this.completeHandler?.();
    }
  }

  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene): void {
    renderer.render(scene, this.camera);
  }

  getStreamingAnchor(): readonly [number, number, number] {
    return [this.streamingAnchor.x, this.streamingAnchor.y, this.streamingAnchor.z];
  }

  getSnapshot(): IntroCinematicStageSnapshot {
    return {
      assetId: INTRO_COMMANDER_PORTRAIT_ASSET_ID,
      portraitPath: INTRO_COMMANDER_PORTRAIT_PATH,
      portraitLoaded: this.portraitLoaded,
      visible: this.visible,
      phaseTimeSeconds: roundMetric(this.phaseTimeSeconds),
      totalSeconds: INTRO_CINEMATIC_TOTAL_SECONDS,
      skipAvailable: this.isSkipAvailable(),
      activeCueId: this.activeCue?.cueId ?? null,
      activeVoiceAssetId: this.activeCue?.line.id ?? null,
      currentSpeaker: this.speakerElement?.textContent ?? COMMANDER_VOICE_NAME,
      currentCaption: this.captionElement?.textContent ?? '',
      currentShotLabel: this.shotLabelElement?.textContent ?? '',
      streamingAnchor: [
        roundMetric(this.streamingAnchor.x),
        roundMetric(this.streamingAnchor.y),
        roundMetric(this.streamingAnchor.z),
      ],
      errors: [...this.errors],
    };
  }

  dispose(): void {
    this.close();
    this.portrait.onload = null;
    this.portrait.onerror = null;
    this.portrait.removeAttribute('src');
  }

  private applyCueState(): void {
    const cue = readActiveCue(this.phaseTimeSeconds);
    if (cue && cue !== this.activeCue) {
      this.activeCue = cue;
      this.setSpeaker(cue.line.characterName);
      this.setCaption(stripVoiceDirectionTags(cue.line.text));
      this.setShotLabel(cue.shotLabel);
    }

    for (const candidate of INTRO_CUES) {
      if (candidate.startSeconds > this.phaseTimeSeconds || this.playedCueIds.has(candidate.cueId)) {
        continue;
      }
      this.playedCueIds.add(candidate.cueId);
      this.cueHandler?.(candidate.line);
    }
  }

  private applyCamera(): void {
    const shot = readActiveShot(this.shots, this.phaseTimeSeconds);
    const cue = INTRO_CUES.find((candidate) => candidate.cueId === shot.cueId) ?? INTRO_CUES[0];
    const t = smoothProgress((this.phaseTimeSeconds - cue.startSeconds) / Math.max(0.001, cue.endSeconds - cue.startSeconds));

    this.cameraPosition.lerpVectors(shot.cameraStart, shot.cameraEnd, t);
    this.lookTarget.lerpVectors(shot.lookStart, shot.lookEnd, t);
    this.camera.position.copy(this.cameraPosition);
    this.camera.fov = THREE.MathUtils.lerp(shot.fovStart, shot.fovEnd, t);
    this.camera.lookAt(this.lookTarget);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    this.streamingAnchor.set(this.lookTarget.x, 1.6, this.lookTarget.z);
  }

  private isSkipAvailable(): boolean {
    return this.visible && this.phaseTimeSeconds >= INTRO_CINEMATIC_SKIP_UNLOCK_SECONDS;
  }

  private setSpeaker(text: string): void {
    if (this.speakerElement) {
      this.speakerElement.textContent = text;
    }
  }

  private setCaption(text: string): void {
    if (this.captionElement) {
      this.captionElement.textContent = text;
    }
  }

  private setShotLabel(text: string): void {
    if (this.shotLabelElement) {
      this.shotLabelElement.textContent = text;
    }
  }
}

function createIntroShots(
  spawn: THREE.Vector3,
  exitTile: LevelTile,
  enemyTiles: readonly LevelTile[],
): readonly IntroShot[] {
  const firstEnemy = enemyTiles[0] ?? exitTile;
  const midEnemy = enemyTiles[Math.floor(enemyTiles.length / 2)] ?? firstEnemy;
  const exitPosition = new THREE.Vector3(exitTile.worldX, 0, exitTile.worldZ);
  const spawnLook = new THREE.Vector3(spawn.x, 1.0, spawn.z);
  const firstEnemyLook = new THREE.Vector3(firstEnemy.worldX, 0.85, firstEnemy.worldZ);
  const midEnemyLook = new THREE.Vector3(midEnemy.worldX, 0.95, midEnemy.worldZ);
  const exitLook = new THREE.Vector3(exitPosition.x, 1.0, exitPosition.z);

  return [
    {
      cueId: 'deck-breach',
      cameraStart: new THREE.Vector3(spawn.x + 4.6, 2.35, spawn.z + 5.8),
      cameraEnd: new THREE.Vector3(spawn.x + 2.2, 1.85, spawn.z + 3.2),
      lookStart: spawnLook,
      lookEnd: new THREE.Vector3(spawn.x - 1.5, 1.0, spawn.z),
      fovStart: 58,
      fovEnd: 52,
    },
    {
      cueId: 'hostiles',
      cameraStart: new THREE.Vector3(firstEnemy.worldX + 4.2, 2.45, firstEnemy.worldZ + 5.2),
      cameraEnd: new THREE.Vector3(firstEnemy.worldX + 1.5, 2.0, firstEnemy.worldZ + 2.8),
      lookStart: firstEnemyLook,
      lookEnd: new THREE.Vector3(firstEnemy.worldX - 1.2, 0.95, firstEnemy.worldZ - 0.5),
      fovStart: 60,
      fovEnd: 54,
    },
    {
      cueId: 'weapons',
      cameraStart: new THREE.Vector3(spawn.x + 1.3, 1.55, spawn.z + 1.6),
      cameraEnd: new THREE.Vector3(spawn.x + 2.2, 1.55, spawn.z + 0.8),
      lookStart: new THREE.Vector3(spawn.x + 4.4, 1.25, spawn.z - 1.2),
      lookEnd: new THREE.Vector3(spawn.x + 5.2, 1.15, spawn.z - 1.9),
      fovStart: 50,
      fovEnd: 48,
    },
    {
      cueId: 'survival',
      cameraStart: new THREE.Vector3(midEnemy.worldX - 4.8, 2.1, midEnemy.worldZ - 3.5),
      cameraEnd: new THREE.Vector3(midEnemy.worldX - 2.2, 1.9, midEnemy.worldZ - 1.7),
      lookStart: midEnemyLook,
      lookEnd: new THREE.Vector3(midEnemy.worldX + 1.4, 0.9, midEnemy.worldZ + 1.2),
      fovStart: 58,
      fovEnd: 52,
    },
    {
      cueId: 'exit-rift',
      cameraStart: new THREE.Vector3(exitPosition.x - 5.6, 2.55, exitPosition.z - 5.6),
      cameraEnd: new THREE.Vector3(exitPosition.x - 2.7, 1.65, exitPosition.z - 2.5),
      lookStart: exitLook,
      lookEnd: new THREE.Vector3(exitPosition.x, 1.15, exitPosition.z),
      fovStart: 62,
      fovEnd: 46,
    },
  ];
}

function readExitTile(): LevelTile {
  const exitTile = getLevelTiles().find((tile) => tile.symbol === 'X');
  if (!exitTile) {
    throw new Error('Foundation level is missing an X exit tile.');
  }

  return exitTile;
}

function readActiveCue(timeSeconds: number): IntroCinematicCue | null {
  for (let index = INTRO_CUES.length - 1; index >= 0; index--) {
    const cue = INTRO_CUES[index];
    if (timeSeconds >= cue.startSeconds) {
      return cue;
    }
  }

  return null;
}

function readActiveShot(shots: readonly IntroShot[], timeSeconds: number): IntroShot {
  const cue = readActiveCue(timeSeconds);
  if (!cue) {
    return shots[0];
  }

  return shots.find((shot) => shot.cueId === cue.cueId) ?? shots[0];
}

function stripVoiceDirectionTags(text: string): string {
  return text.replace(/\[[^\]]+\]\s*/g, '').trim();
}

function smoothProgress(value: number): number {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}

function roundMetric(value: number): number {
  return Math.round(value * 10) / 10;
}
