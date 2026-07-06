import * as THREE from 'three';
import { publicAssetUrl } from './assetUrls';
import { DEBUG_SCENE_ID, GAME_TITLE, PERFORMANCE_BUDGETS, type GamePhase } from './config';
import { createDebugApi, type DebugApi, type UiLoadingSnapshot } from './debug';
import { DeathCinematicStage, type DeathCinematicStageSnapshot } from './deathCinematicStage';
import { EnemySystem, type EnemySystemSnapshot } from './enemies/enemySystem';
import { createFoundationLevelRuntime, type FoundationLevelRuntime } from './foundationLevelRuntime';
import { FpsControls } from './fpsControls';
import { Health, type HealthSnapshot } from './health';
import {
  CHARACTER_VOICE_LINES,
  VOICE_LAB_TITLE,
  type CharacterVoiceLine,
  createCharacterVoiceLab,
} from './characterVoice';
import {
  INTRO_COMMANDER_PORTRAIT_ASSET_ID,
  IntroCinematicStage,
  type IntroCinematicStageSnapshot,
} from './introCinematicStage';
import { getLevelTiles, getSpawnPosition, LEVEL_HEIGHT_TILES, LEVEL_WIDTH_TILES } from './levelMap';
import { createMobileZoomGuard } from './mobileZoomGuard';
import { createPlayerCharacterPoseHarness } from './playerCharacterPoseHarness';
import { TitleHeroStage, type TitleHeroStageSnapshot } from './titleHeroStage';
import { VictoryCinematicStage, type VictoryCinematicStageSnapshot } from './victoryCinematicStage';
import { WEAPON_DEFINITIONS } from './weapons/weaponManifest';
import { WeaponSystem } from './weapons/weaponSystem';

export interface SigilbreakerApp {
  dispose: () => void;
  debug: DebugApi;
}

const TITLE_BACKGROUND_ASSET_ID = 'ui.title.background.gadget-rift.generated';
const TITLE_BACKGROUND_PATH = 'assets/title/gadget-rift-title-bg.webp';
const TITLE_START_TRANSITION_MS = 360;
const DEATH_ACTIONS_REVEAL_SECONDS = 3.2;
const VICTORY_SCORE_REVEAL_SECONDS = 2.2;
const PLAYER_MAX_HEALTH = 25;
const HUD_UPDATE_INTERVAL_MS = 250;
const HUD_RELOAD_UPDATE_INTERVAL_MS = 50;
const EXPECTED_GAMEPLAY_ASSET_COUNT = 28;
const EXPECTED_BOOT_ASSET_COUNT = EXPECTED_GAMEPLAY_ASSET_COUNT + 2;
const EXIT_RIFT_TRIGGER_RADIUS_UNITS = 1.05;
const DEATH_VOICE_LINES: readonly CharacterVoiceLine[] = CHARACTER_VOICE_LINES.filter(
  (line) => line.category === 'fail',
);
const VICTORY_VOICE_LINES: readonly CharacterVoiceLine[] = CHARACTER_VOICE_LINES.filter(
  (line) => line.category === 'level-complete',
);

interface VictoryScore {
  clearTimeSeconds: number;
  enemiesDestroyed: number;
  enemiesTotal: number;
  hp: number;
  hpMax: number;
  shotsFired: number;
  rank: string;
}

declare global {
  interface Window {
    __SIGILBREAKER_DEBUG__?: DebugApi;
  }
}

export function createGame(root: HTMLElement): SigilbreakerApp {
  root.innerHTML = createShellMarkup();

  const canvas = root.querySelector<HTMLCanvasElement>('.game-canvas');
  if (!canvas) {
    throw new Error('Missing game canvas.');
  }

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: shouldPreserveDrawingBuffer(),
  });
  renderer.localClippingEnabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x0d1012, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, PERFORMANCE_BUDGETS.maxDevicePixelRatio));

  const scene = new THREE.Scene();
  scene.name = DEBUG_SCENE_ID;
  scene.background = new THREE.Color(0x0d1012);
  scene.fog = new THREE.Fog(0x0d1012, 12, 30);

  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 180);
  scene.add(camera);

  const disposables: Array<{ dispose: () => void }> = [];
  const track = <Resource extends { dispose: () => void }>(resource: Resource): Resource => {
    disposables.push(resource);
    return resource;
  };

  const levelRuntime = createFoundationLevelRuntime(scene, track);
  const exitRiftPosition = readFoundationExitPosition();
  const zoomGuard = track(createMobileZoomGuard(root));
  const controls = new FpsControls(root, camera);
  const playerHealth = new Health(PLAYER_MAX_HEALTH);
  const weaponSystemRef: { current: WeaponSystem | null } = { current: null };
  const enemySystem = new EnemySystem(scene, {
    damagePlayer: (amount) => playerHealth.damage(amount),
    playProjectileSound: () => weaponSystemRef.current?.playEnemyProjectileSound(),
  });
  const weaponSystem = new WeaponSystem(root, camera, {
    resolveTargetHit: (request) => enemySystem.resolveShotHit(
      request.origin,
      request.direction,
      request.maxDistance,
      request.damage,
    ),
  });
  const playerPoseHarness = createPlayerCharacterPoseHarness(root);
  const characterVoiceLab = createCharacterVoiceLab(root, {
    playVoice: (line, options) => weaponSystem.playVoice(line, options),
    stopVoice: () => weaponSystem.stopVoice(),
  });
  const titleHeroStage = new TitleHeroStage(TITLE_BACKGROUND_PATH);
  const introCinematicStage = new IntroCinematicStage(root, camera);
  const deathCinematicStage = new DeathCinematicStage(scene, camera);
  const victoryCinematicStage = new VictoryCinematicStage(scene, camera);
  void titleHeroStage.load();
  void introCinematicStage.load();
  void deathCinematicStage.load();
  void victoryCinematicStage.load();
  weaponSystemRef.current = weaponSystem;
  levelRuntime.update(controls.getSnapshot().player.position);

  let animationFrame = 0;
  let lastTime = performance.now();
  let lastHudUpdate = 0;
  let fps = PERFORMANCE_BUDGETS.targetFps;
  let debugVisible = false;
  let gamePhase: GamePhase = 'loading';
  let titleStartPending = false;
  let titleStartTransitionTimeout = 0;
  let titleBackgroundLoaded = false;
  let titleBackgroundError: string | null = null;
  let lastDeathVoiceLineId: string | null = null;
  let lastVictoryVoiceLineId: string | null = null;
  let deathActionsVisible = false;
  let victoryScoreVisible = false;
  let victoryActionsVisible = false;
  let levelStartedAt = performance.now();
  let currentVictoryScore: VictoryScore = createEmptyVictoryScore();

  const debug = createDebugApi(
    renderer,
    () => fps,
    () => controls.getSnapshot(),
    () => levelRuntime.getSnapshot(),
    () => weaponSystem.getSnapshot(),
    () => playerHealth.getSnapshot(),
    () => enemySystem.getSnapshot(),
    () => zoomGuard.getSnapshot(),
    () => ({
      debugVisible,
      phase: gamePhase,
      loading: readLoadingSnapshot(
        levelRuntime,
        weaponSystem,
        enemySystem,
        titleHeroStage.getSnapshot(),
        introCinematicStage.getSnapshot(),
        deathCinematicStage.getSnapshot(),
        victoryCinematicStage.getSnapshot(),
        titleBackgroundLoaded,
        titleBackgroundError,
      ),
      titleHero: titleHeroStage.getSnapshot(),
      introCinematic: introCinematicStage.getSnapshot(),
      deathCinematic: deathCinematicStage.getSnapshot(),
      victoryCinematic: victoryCinematicStage.getSnapshot(),
      victoryScore: currentVictoryScore,
    }),
    (pose) => controls.setPose(pose),
    (amount) => playerHealth.damage(amount),
  );
  window.__SIGILBREAKER_DEBUG__ = debug;

  const shell = root.querySelector<HTMLElement>('.game-shell');
  const titleBackgroundUrl = publicAssetUrl(TITLE_BACKGROUND_PATH);
  shell?.style.setProperty('--title-background-image', `url("${titleBackgroundUrl}")`);
  const titleBackgroundImage = new Image();
  titleBackgroundImage.onload = () => {
    titleBackgroundLoaded = true;
  };
  titleBackgroundImage.onerror = () => {
    titleBackgroundError = `${TITLE_BACKGROUND_ASSET_ID}: failed to load`;
  };
  titleBackgroundImage.src = titleBackgroundUrl;

  const debugToggle = root.querySelector<HTMLButtonElement>('[data-debug-toggle]');
  const debugDeathButton = root.querySelector<HTMLButtonElement>('[data-debug-death]');
  const debugDeathGameplayButton = root.querySelector<HTMLButtonElement>('[data-debug-death-gameplay]');
  const debugVictoryButton = root.querySelector<HTMLButtonElement>('[data-debug-victory]');
  const titleStartButton = root.querySelector<HTMLButtonElement>('[data-title-start]');
  const titleCharacterDebugButton = root.querySelector<HTMLButtonElement>('[data-title-character-debug]');
  const titleVoiceLabButton = root.querySelector<HTMLButtonElement>('[data-title-voice-lab]');
  const introSkipButton = root.querySelector<HTMLButtonElement>('[data-intro-skip]');
  const characterDebugBackButton = root.querySelector<HTMLButtonElement>('[data-character-debug-back]');
  const voiceLabBackButton = root.querySelector<HTMLButtonElement>('[data-voice-lab-back]');
  const deathTryAgainButton = root.querySelector<HTMLButtonElement>('[data-death-try-again]');
  const deathReturnTitleButton = root.querySelector<HTMLButtonElement>('[data-death-return-title]');
  const victoryCinematicScreen = root.querySelector<HTMLElement>('[data-victory-cinematic]');
  const victoryCaption = root.querySelector<HTMLElement>('[data-victory-caption]');
  const victoryContinueButton = root.querySelector<HTMLButtonElement>('[data-victory-continue]');
  const victoryTryAgainButton = root.querySelector<HTMLButtonElement>('[data-victory-try-again]');
  const victoryReturnTitleButton = root.querySelector<HTMLButtonElement>('[data-victory-return-title]');
  const loadingScreen = root.querySelector<HTMLElement>('[data-loading-screen]');
  const titleScreen = root.querySelector<HTMLElement>('[data-title-screen]');
  const introCinematicScreen = root.querySelector<HTMLElement>('[data-intro-cinematic]');
  const characterDebugScreen = root.querySelector<HTMLElement>('[data-character-debug]');
  const voiceLabScreen = root.querySelector<HTMLElement>('[data-voice-lab]');
  const deathCinematicScreen = root.querySelector<HTMLElement>('[data-death-cinematic]');
  const deathCaption = root.querySelector<HTMLElement>('[data-death-caption]');
  const applyGamePhase = (): void => {
    if (shell) {
      shell.dataset.gamePhase = gamePhase;
      shell.classList.toggle('game-shell--death-actions-visible', deathActionsVisible);
      shell.classList.toggle('game-shell--victory-score-visible', victoryScoreVisible);
      shell.classList.toggle('game-shell--victory-actions-visible', victoryActionsVisible);
    }
    if (titleStartButton) {
      titleStartButton.disabled = gamePhase !== 'title';
    }
    if (titleCharacterDebugButton) {
      titleCharacterDebugButton.disabled = gamePhase !== 'title';
    }
    if (titleVoiceLabButton) {
      titleVoiceLabButton.disabled = gamePhase !== 'title';
    }
    loadingScreen?.setAttribute('aria-hidden', String(gamePhase !== 'loading'));
    titleScreen?.setAttribute('aria-hidden', String(gamePhase !== 'title'));
    introCinematicScreen?.setAttribute('aria-hidden', String(gamePhase !== 'intro-cinematic'));
    victoryCinematicScreen?.setAttribute('aria-hidden', String(gamePhase !== 'victory-cinematic'));
    characterDebugScreen?.setAttribute('aria-hidden', String(gamePhase !== 'character-debug'));
    voiceLabScreen?.setAttribute('aria-hidden', String(gamePhase !== 'voice-lab'));
    deathCinematicScreen?.setAttribute('aria-hidden', String(gamePhase !== 'death-cinematic'));
    controls.setInputEnabled(gamePhase === 'gameplay');
    weaponSystem.setInputEnabled(gamePhase === 'gameplay');
    weaponSystem.setViewVisible(gamePhase === 'gameplay');
    weaponSystem.setMusicPhase(
      gamePhase === 'gameplay' || gamePhase === 'death-cinematic' || gamePhase === 'victory-cinematic'
        ? 'gameplay'
        : 'title',
    );
    titleHeroStage.setVisible(gamePhase === 'title' || gamePhase === 'voice-lab');
    introCinematicStage.setVisible(gamePhase === 'intro-cinematic');
    deathCinematicStage.setVisible(gamePhase === 'death-cinematic');
    victoryCinematicStage.setVisible(gamePhase === 'victory-cinematic');
  };
  const finishIntroCinematic = (): void => {
    if (gamePhase !== 'intro-cinematic') {
      return;
    }

    weaponSystem.stopVoice();
    introCinematicStage.close();
    resetCombatState();
    startLevelTimer();
    gamePhase = 'gameplay';
    applyGamePhase();
  };
  const openIntroCinematic = (): void => {
    resetCombatState();
    introCinematicStage.open({
      onCue: (line) => weaponSystem.playVoice(line),
      onComplete: finishIntroCinematic,
    });
    gamePhase = 'intro-cinematic';
    applyGamePhase();
  };
  const startGameplay = (): void => {
    if (gamePhase !== 'title' || titleStartPending) {
      return;
    }
    titleStartPending = true;
    shell?.classList.add('game-shell--title-starting');
    if (titleStartButton) {
      titleStartButton.disabled = true;
    }
    if (titleCharacterDebugButton) {
      titleCharacterDebugButton.disabled = true;
    }
    if (titleVoiceLabButton) {
      titleVoiceLabButton.disabled = true;
    }
    titleStartTransitionTimeout = window.setTimeout(() => {
      titleStartPending = false;
      shell?.classList.remove('game-shell--title-starting');
      if (gamePhase !== 'title') {
        return;
      }
      openIntroCinematic();
    }, TITLE_START_TRANSITION_MS);
  };
  const resetCombatState = (): void => {
    const spawn = getSpawnPosition();
    playerHealth.reset();
    controls.setPose({
      x: spawn.x,
      z: spawn.z,
      yawRadians: -Math.PI / 2,
      pitchRadians: 0,
    });
    enemySystem.resetCombatState();
    weaponSystem.resetCombatState();
    levelRuntime.update(controls.getSnapshot().player.position);
  };
  const isPlayerInsideExitRift = (position: readonly [number, number, number]): boolean => {
    return Math.hypot(position[0] - exitRiftPosition.x, position[2] - exitRiftPosition.z) <= EXIT_RIFT_TRIGGER_RADIUS_UNITS;
  };
  const startLevelTimer = (): void => {
    levelStartedAt = performance.now();
  };
  const chooseDeathVoiceLine = (): CharacterVoiceLine | null => {
    if (DEATH_VOICE_LINES.length === 0) {
      return null;
    }

    const choices = DEATH_VOICE_LINES.length > 1
      ? DEATH_VOICE_LINES.filter((line) => line.id !== lastDeathVoiceLineId)
      : DEATH_VOICE_LINES;
    const line = choices[readRandomIndex(choices.length)];
    lastDeathVoiceLineId = line.id;
    return line;
  };
  const playDeathVoice = (line: CharacterVoiceLine): void => {
    weaponSystem.playVoice(line);
  };
  const chooseVictoryVoiceLine = (): CharacterVoiceLine | null => {
    if (VICTORY_VOICE_LINES.length === 0) {
      return null;
    }

    const choices = VICTORY_VOICE_LINES.length > 1
      ? VICTORY_VOICE_LINES.filter((line) => line.id !== lastVictoryVoiceLineId)
      : VICTORY_VOICE_LINES;
    const line = choices[readRandomIndex(choices.length)];
    lastVictoryVoiceLineId = line.id;
    return line;
  };
  const openVictoryCinematic = (): void => {
    const victoryVoiceLine = chooseVictoryVoiceLine();
    if (gamePhase !== 'gameplay' || !victoryVoiceLine) {
      return;
    }

    victoryScoreVisible = false;
    victoryActionsVisible = false;
    const controlsSnapshot = controls.getSnapshot();
    currentVictoryScore = createVictoryScore(
      performance.now() - levelStartedAt,
      playerHealth.getSnapshot(),
      enemySystem.getSnapshot(),
      weaponSystem.getSnapshot().shotCount,
    );
    updateVictoryScoreboard(root, currentVictoryScore);
    victoryCinematicStage.open({
      playerPosition: controlsSnapshot.player.position,
      yawRadians: controlsSnapshot.player.yawRadians,
    });
    if (victoryCaption) {
      victoryCaption.textContent = stripVoiceDirectionTags(victoryVoiceLine.text);
    }
    gamePhase = 'victory-cinematic';
    applyGamePhase();
    weaponSystem.playVoice(victoryVoiceLine);
  };
  const openDeathCinematic = (): void => {
    const deathVoiceLine = chooseDeathVoiceLine();
    if (gamePhase !== 'gameplay' || !deathVoiceLine) {
      return;
    }

    deathActionsVisible = false;
    const snapshot = controls.getSnapshot();
    deathCinematicStage.open({
      playerPosition: snapshot.player.position,
      yawRadians: snapshot.player.yawRadians,
    });
    if (deathCaption) {
      deathCaption.textContent = stripVoiceDirectionTags(deathVoiceLine.text);
    }
    gamePhase = 'death-cinematic';
    applyGamePhase();
    playDeathVoice(deathVoiceLine);
  };
  const revealDeathActions = (): void => {
    if (deathActionsVisible) {
      return;
    }

    deathActionsVisible = true;
    applyGamePhase();
  };
  const revealVictoryScore = (): void => {
    if (victoryScoreVisible) {
      return;
    }

    victoryScoreVisible = true;
    applyGamePhase();
  };
  const continueFromVictoryScore = (): void => {
    if (gamePhase !== 'victory-cinematic' || !victoryScoreVisible) {
      return;
    }

    victoryActionsVisible = true;
    applyGamePhase();
  };
  const retryAfterDeath = (): void => {
    if (gamePhase !== 'death-cinematic') {
      return;
    }

    weaponSystem.stopVoice();
    deathCinematicStage.close();
    deathActionsVisible = false;
    resetCombatState();
    startLevelTimer();
    gamePhase = 'gameplay';
    applyGamePhase();
  };
  const returnToTitleAfterDeath = (): void => {
    if (gamePhase !== 'death-cinematic') {
      return;
    }

    weaponSystem.stopVoice();
    deathCinematicStage.close();
    deathActionsVisible = false;
    resetCombatState();
    gamePhase = 'title';
    applyGamePhase();
  };
  const retryAfterVictory = (): void => {
    if (gamePhase !== 'victory-cinematic') {
      return;
    }

    weaponSystem.stopVoice();
    victoryCinematicStage.close();
    victoryScoreVisible = false;
    victoryActionsVisible = false;
    currentVictoryScore = createEmptyVictoryScore();
    resetCombatState();
    startLevelTimer();
    gamePhase = 'gameplay';
    applyGamePhase();
  };
  const returnToTitleAfterVictory = (): void => {
    if (gamePhase !== 'victory-cinematic') {
      return;
    }

    weaponSystem.stopVoice();
    victoryCinematicStage.close();
    victoryScoreVisible = false;
    victoryActionsVisible = false;
    currentVictoryScore = createEmptyVictoryScore();
    resetCombatState();
    gamePhase = 'title';
    applyGamePhase();
  };
  const openCharacterDebug = (): void => {
    if (gamePhase !== 'title') {
      return;
    }
    playerPoseHarness.open();
    gamePhase = 'character-debug';
    applyGamePhase();
  };
  const closeCharacterDebug = (): void => {
    if (gamePhase !== 'character-debug') {
      return;
    }
    playerPoseHarness.close();
    gamePhase = 'title';
    applyGamePhase();
  };
  const openVoiceLab = (): void => {
    if (gamePhase !== 'title') {
      return;
    }
    characterVoiceLab.open();
    gamePhase = 'voice-lab';
    applyGamePhase();
  };
  const closeVoiceLab = (): void => {
    if (gamePhase !== 'voice-lab') {
      return;
    }
    characterVoiceLab.close();
    gamePhase = 'title';
    applyGamePhase();
  };
  const onTitleStartPointerDown = (event: PointerEvent): void => {
    event.preventDefault();
    startGameplay();
  };
  const onTitleStartClick = (event: MouseEvent): void => {
    event.preventDefault();
    startGameplay();
  };
  const onTitleCharacterDebugPointerDown = (event: PointerEvent): void => {
    event.preventDefault();
    openCharacterDebug();
  };
  const onTitleCharacterDebugClick = (event: MouseEvent): void => {
    event.preventDefault();
    openCharacterDebug();
  };
  const onTitleVoiceLabPointerDown = (event: PointerEvent): void => {
    event.preventDefault();
    openVoiceLab();
  };
  const onTitleVoiceLabClick = (event: MouseEvent): void => {
    event.preventDefault();
    openVoiceLab();
  };
  const onIntroSkipPointerDown = (event: PointerEvent): void => {
    event.preventDefault();
    finishIntroCinematic();
  };
  const onIntroSkipClick = (event: MouseEvent): void => {
    event.preventDefault();
    finishIntroCinematic();
  };
  const onCharacterDebugBackPointerDown = (event: PointerEvent): void => {
    event.preventDefault();
    closeCharacterDebug();
  };
  const onVoiceLabBackPointerDown = (event: PointerEvent): void => {
    event.preventDefault();
    closeVoiceLab();
  };
  const onDeathTryAgainPointerDown = (event: PointerEvent): void => {
    event.preventDefault();
    retryAfterDeath();
  };
  const onDeathTryAgainClick = (event: MouseEvent): void => {
    event.preventDefault();
    retryAfterDeath();
  };
  const onDeathReturnTitlePointerDown = (event: PointerEvent): void => {
    event.preventDefault();
    returnToTitleAfterDeath();
  };
  const onDeathReturnTitleClick = (event: MouseEvent): void => {
    event.preventDefault();
    returnToTitleAfterDeath();
  };
  const onVictoryContinuePointerDown = (event: PointerEvent): void => {
    event.preventDefault();
    continueFromVictoryScore();
  };
  const onVictoryContinueClick = (event: MouseEvent): void => {
    event.preventDefault();
    continueFromVictoryScore();
  };
  const onVictoryTryAgainPointerDown = (event: PointerEvent): void => {
    event.preventDefault();
    retryAfterVictory();
  };
  const onVictoryTryAgainClick = (event: MouseEvent): void => {
    event.preventDefault();
    retryAfterVictory();
  };
  const onVictoryReturnTitlePointerDown = (event: PointerEvent): void => {
    event.preventDefault();
    returnToTitleAfterVictory();
  };
  const onVictoryReturnTitleClick = (event: MouseEvent): void => {
    event.preventDefault();
    returnToTitleAfterVictory();
  };
  const updateDebugVisibility = (): void => {
    shell?.classList.toggle('game-shell--debug-hidden', !debugVisible);
    if (debugToggle) {
      debugToggle.setAttribute('aria-pressed', String(!debugVisible));
      debugToggle.setAttribute('aria-label', debugVisible ? 'Hide debug HUD' : 'Show debug HUD');
      debugToggle.textContent = debugVisible ? 'DBG' : 'HUD';
    }
  };
  const onDebugTogglePointerDown = (event: PointerEvent): void => {
    event.preventDefault();
    debugVisible = !debugVisible;
    updateDebugVisibility();
  };
  const onDebugDeathPointerDown = (event: PointerEvent): void => {
    event.preventDefault();
    if (gamePhase !== 'gameplay') {
      return;
    }

    playerHealth.damage(playerHealth.max);
    openDeathCinematic();
  };
  const onDebugDeathGameplayPointerDown = (event: PointerEvent): void => {
    event.preventDefault();
    if (gamePhase !== 'gameplay') {
      return;
    }

    playerHealth.damage(playerHealth.max);
  };
  const onDebugVictoryPointerDown = (event: PointerEvent): void => {
    event.preventDefault();
    openVictoryCinematic();
  };
  titleStartButton?.addEventListener('pointerdown', onTitleStartPointerDown);
  titleStartButton?.addEventListener('click', onTitleStartClick);
  titleCharacterDebugButton?.addEventListener('pointerdown', onTitleCharacterDebugPointerDown);
  titleCharacterDebugButton?.addEventListener('click', onTitleCharacterDebugClick);
  titleVoiceLabButton?.addEventListener('pointerdown', onTitleVoiceLabPointerDown);
  titleVoiceLabButton?.addEventListener('click', onTitleVoiceLabClick);
  introSkipButton?.addEventListener('pointerdown', onIntroSkipPointerDown);
  introSkipButton?.addEventListener('click', onIntroSkipClick);
  characterDebugBackButton?.addEventListener('pointerdown', onCharacterDebugBackPointerDown);
  voiceLabBackButton?.addEventListener('pointerdown', onVoiceLabBackPointerDown);
  deathTryAgainButton?.addEventListener('pointerdown', onDeathTryAgainPointerDown);
  deathTryAgainButton?.addEventListener('click', onDeathTryAgainClick);
  deathReturnTitleButton?.addEventListener('pointerdown', onDeathReturnTitlePointerDown);
  deathReturnTitleButton?.addEventListener('click', onDeathReturnTitleClick);
  victoryContinueButton?.addEventListener('pointerdown', onVictoryContinuePointerDown);
  victoryContinueButton?.addEventListener('click', onVictoryContinueClick);
  victoryTryAgainButton?.addEventListener('pointerdown', onVictoryTryAgainPointerDown);
  victoryTryAgainButton?.addEventListener('click', onVictoryTryAgainClick);
  victoryReturnTitleButton?.addEventListener('pointerdown', onVictoryReturnTitlePointerDown);
  victoryReturnTitleButton?.addEventListener('click', onVictoryReturnTitleClick);
  debugToggle?.addEventListener('pointerdown', onDebugTogglePointerDown);
  debugDeathButton?.addEventListener('pointerdown', onDebugDeathPointerDown);
  debugDeathGameplayButton?.addEventListener('pointerdown', onDebugDeathGameplayPointerDown);
  debugVictoryButton?.addEventListener('pointerdown', onDebugVictoryPointerDown);
  applyGamePhase();
  updateDebugVisibility();

  const resize = (): void => {
    const width = Math.max(1, root.clientWidth);
    const height = Math.max(1, root.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, PERFORMANCE_BUDGETS.maxDevicePixelRatio));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    playerPoseHarness.resize(width, height);
    titleHeroStage.resize(width, height);
    introCinematicStage.resize(width, height);
    deathCinematicStage.resize(width, height);
    victoryCinematicStage.resize(width, height);
  };

  const animate = (now: number): void => {
    const deltaSeconds = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;
    fps = fps * 0.9 + (1 / Math.max(deltaSeconds, 0.001)) * 0.1;

    if (gamePhase === 'gameplay') {
      controls.update(deltaSeconds);
      enemySystem.update(deltaSeconds, controls.getSnapshot().player.position, debugVisible);
      if (!playerHealth.isAlive) {
        openDeathCinematic();
      } else if (isPlayerInsideExitRift(controls.getSnapshot().player.position)) {
        openVictoryCinematic();
      }
    }
    if (gamePhase === 'character-debug') {
      playerPoseHarness.update(deltaSeconds);
      playerPoseHarness.render(renderer);
    } else if (gamePhase === 'title' || gamePhase === 'voice-lab') {
      titleHeroStage.update(deltaSeconds, now / 1000);
      titleHeroStage.render(renderer);
    } else if (gamePhase === 'intro-cinematic') {
      introCinematicStage.update(deltaSeconds);
      levelRuntime.update(introCinematicStage.getStreamingAnchor(), deltaSeconds);
      introCinematicStage.render(renderer, scene);
    } else if (gamePhase === 'death-cinematic') {
      deathCinematicStage.update(deltaSeconds);
      if (deathCinematicStage.getSnapshot().phaseTimeSeconds >= DEATH_ACTIONS_REVEAL_SECONDS) {
        revealDeathActions();
      }
      levelRuntime.update(controls.getSnapshot().player.position, deltaSeconds);
      deathCinematicStage.render(renderer);
    } else if (gamePhase === 'victory-cinematic') {
      victoryCinematicStage.update(deltaSeconds);
      if (victoryCinematicStage.getSnapshot().phaseTimeSeconds >= VICTORY_SCORE_REVEAL_SECONDS) {
        revealVictoryScore();
      }
      levelRuntime.update(controls.getSnapshot().player.position, deltaSeconds);
      victoryCinematicStage.render(renderer);
    } else {
      weaponSystem.update(deltaSeconds, now);
      levelRuntime.update(controls.getSnapshot().player.position, deltaSeconds);
      renderer.render(scene, camera);
    }

    const hudUpdateInterval = weaponSystem.isReloading() ? HUD_RELOAD_UPDATE_INTERVAL_MS : HUD_UPDATE_INTERVAL_MS;
    if (now - lastHudUpdate >= hudUpdateInterval) {
      lastHudUpdate = now;
      updateDebugHud(root, debug);
      const loadingSnapshot = readLoadingSnapshot(
        levelRuntime,
        weaponSystem,
        enemySystem,
        titleHeroStage.getSnapshot(),
        introCinematicStage.getSnapshot(),
        deathCinematicStage.getSnapshot(),
        victoryCinematicStage.getSnapshot(),
        titleBackgroundLoaded,
        titleBackgroundError,
      );
      updateLoadingScreen(root, loadingSnapshot);
      if (gamePhase === 'loading' && loadingSnapshot.ready) {
        gamePhase = 'title';
        applyGamePhase();
      }
    }

    animationFrame = window.requestAnimationFrame(animate);
  };

  resize();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(root);
  window.addEventListener('orientationchange', resize);
  animationFrame = window.requestAnimationFrame(animate);

  return {
    debug,
    dispose: () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(titleStartTransitionTimeout);
      characterVoiceLab.dispose();
      weaponSystem.stopVoice();
      controls.dispose();
      weaponSystem.dispose();
      enemySystem.dispose();
      levelRuntime.dispose();
      playerPoseHarness.dispose();
      titleHeroStage.dispose();
      introCinematicStage.dispose();
      deathCinematicStage.dispose();
      victoryCinematicStage.dispose();
      titleBackgroundImage.onload = null;
      titleBackgroundImage.onerror = null;
      debugToggle?.removeEventListener('pointerdown', onDebugTogglePointerDown);
      debugDeathButton?.removeEventListener('pointerdown', onDebugDeathPointerDown);
      debugDeathGameplayButton?.removeEventListener('pointerdown', onDebugDeathGameplayPointerDown);
      debugVictoryButton?.removeEventListener('pointerdown', onDebugVictoryPointerDown);
      titleStartButton?.removeEventListener('pointerdown', onTitleStartPointerDown);
      titleStartButton?.removeEventListener('click', onTitleStartClick);
      titleCharacterDebugButton?.removeEventListener('pointerdown', onTitleCharacterDebugPointerDown);
      titleCharacterDebugButton?.removeEventListener('click', onTitleCharacterDebugClick);
      titleVoiceLabButton?.removeEventListener('pointerdown', onTitleVoiceLabPointerDown);
      titleVoiceLabButton?.removeEventListener('click', onTitleVoiceLabClick);
      introSkipButton?.removeEventListener('pointerdown', onIntroSkipPointerDown);
      introSkipButton?.removeEventListener('click', onIntroSkipClick);
      characterDebugBackButton?.removeEventListener('pointerdown', onCharacterDebugBackPointerDown);
      voiceLabBackButton?.removeEventListener('pointerdown', onVoiceLabBackPointerDown);
      deathTryAgainButton?.removeEventListener('pointerdown', onDeathTryAgainPointerDown);
      deathTryAgainButton?.removeEventListener('click', onDeathTryAgainClick);
      deathReturnTitleButton?.removeEventListener('pointerdown', onDeathReturnTitlePointerDown);
      deathReturnTitleButton?.removeEventListener('click', onDeathReturnTitleClick);
      victoryContinueButton?.removeEventListener('pointerdown', onVictoryContinuePointerDown);
      victoryContinueButton?.removeEventListener('click', onVictoryContinueClick);
      victoryTryAgainButton?.removeEventListener('pointerdown', onVictoryTryAgainPointerDown);
      victoryTryAgainButton?.removeEventListener('click', onVictoryTryAgainClick);
      victoryReturnTitleButton?.removeEventListener('pointerdown', onVictoryReturnTitlePointerDown);
      victoryReturnTitleButton?.removeEventListener('click', onVictoryReturnTitleClick);
      resizeObserver.disconnect();
      window.removeEventListener('orientationchange', resize);
      scene.traverse((object) => {
        object.removeFromParent();
      });
      for (const disposable of disposables) {
        disposable.dispose();
      }
      renderer.dispose();
      if (window.__SIGILBREAKER_DEBUG__ === debug) {
        delete window.__SIGILBREAKER_DEBUG__;
      }
      root.replaceChildren();
    },
  };
}

function createShellMarkup(): string {
  return `
    <div class="game-shell" data-game-phase="loading">
      <canvas class="game-canvas" aria-label="${GAME_TITLE} prototype render"></canvas>
      <div class="look-zone" aria-hidden="true"></div>
      <div class="hud">
        <div class="hud__left">
          <span class="hud__badge" data-debug-ui>${LEVEL_WIDTH_TILES} x ${LEVEL_HEIGHT_TILES}</span>
          <div class="health-meter" data-health-meter>
            <span class="health-meter__label" data-health-label>HP</span>
            <span class="health-meter__track" aria-hidden="true">
              <span class="health-meter__fill" data-health-fill></span>
            </span>
            <span class="health-meter__value" data-health-value>${PLAYER_MAX_HEALTH} / ${PLAYER_MAX_HEALTH}</span>
          </div>
        </div>
        <div class="hud__center">
          <span class="hud__badge hud__badge--metric" data-debug-ui data-debug-fps>FPS --</span>
          <span class="hud__badge hud__badge--metric hud__badge--coords" data-debug-ui data-debug-coordinates>XYZ -- -- --</span>
          <span class="hud__badge hud__badge--metric" data-debug-ui data-debug-memory>JS --</span>
          <span class="hud__badge hud__badge--metric" data-debug-ui data-debug-level-memory>LVL --</span>
          <span class="hud__badge hud__badge--metric" data-debug-ui data-debug-chunks>CH --</span>
        </div>
        <div class="hud__right">
          <button
            class="hud__icon-button hud__icon-button--debug"
            type="button"
            data-ui-control
            data-debug-toggle
            aria-label="Hide debug HUD"
            aria-pressed="false"
          >DBG</button>
          <button
            class="hud__icon-button hud__icon-button--debug hud__icon-button--death"
            type="button"
            data-ui-control
            data-debug-ui
            data-debug-death
            aria-label="Trigger death cinematic"
          >KO</button>
          <button
            class="hud__icon-button hud__icon-button--debug hud__icon-button--death"
            type="button"
            data-ui-control
            data-debug-ui
            data-debug-death-gameplay
            aria-label="Trigger gameplay death on next tick"
          >KO2</button>
          <button
            class="hud__icon-button hud__icon-button--debug hud__icon-button--victory"
            type="button"
            data-ui-control
            data-debug-ui
            data-debug-victory
            aria-label="Trigger victory cinematic"
          >WIN</button>
          <button
            class="hud__icon-button hud__icon-button--music"
            type="button"
            data-ui-control
            data-music-toggle
            aria-label="Mute music"
            aria-pressed="false"
          >
            <span class="music-icon" aria-hidden="true"></span>
          </button>
          <span class="hud__badge hud__badge--weapon" data-debug-ui data-weapon-label>${WEAPON_DEFINITIONS[0].label}</span>
          <div class="ammo-meter" data-weapon-ammo-meter>
            <span class="ammo-meter__label">AMMO</span>
            <span class="ammo-meter__value" data-weapon-ammo>-- / --</span>
            <span class="ammo-meter__track" aria-hidden="true">
              <span class="ammo-meter__fill" data-weapon-reload-fill></span>
            </span>
          </div>
          <span class="hud__badge hud__badge--build" data-debug-ui>${__SIGILBREAKER_BUILD_ID__}</span>
        </div>
      </div>
      <div class="crosshair" aria-hidden="true"></div>
      <div class="loading-screen" data-loading-screen role="status" aria-live="polite">
        <div class="loading-screen__content">
          <div class="loading-screen__brand">${GAME_TITLE}</div>
          <div class="loading-screen__label">LOADING ASSETS</div>
          <div class="loading-screen__bar" aria-hidden="true">
            <span class="loading-screen__fill" data-loading-fill></span>
          </div>
          <div class="loading-screen__count" data-loading-count>0 / ${EXPECTED_BOOT_ASSET_COUNT}</div>
        </div>
      </div>
      <div class="title-screen" data-title-screen aria-hidden="true">
        <div class="title-screen__copy">
          <h1 class="title-screen__title" aria-label="${GAME_TITLE}">${renderTitleLines(GAME_TITLE)}</h1>
          <p class="title-screen__tagline">LOCK, LOAD, RIFT</p>
          <button
            class="title-screen__start"
            type="button"
            data-ui-control
            data-title-start
            disabled
          >PLAY</button>
          <button
            class="title-screen__start title-screen__debug"
            type="button"
            data-ui-control
            data-title-character-debug
            disabled
          >HERO LAB</button>
          <button
            class="title-screen__start title-screen__debug"
            type="button"
            data-ui-control
            data-title-voice-lab
            disabled
          >VOICE LAB</button>
        </div>
      </div>
      <div class="intro-cinematic" data-intro-cinematic aria-hidden="true">
        <div class="intro-cinematic__bar intro-cinematic__bar--top" aria-hidden="true"></div>
        <aside class="intro-cinematic__portrait" aria-label="Commander Kade comms portrait">
          <div class="intro-cinematic__portrait-image" data-intro-portrait-image aria-hidden="true"></div>
          <div class="intro-cinematic__portrait-name">COMMANDER KADE</div>
        </aside>
        <div class="intro-cinematic__shot-label" data-intro-shot-label>MISSION BRIEF</div>
        <div class="intro-cinematic__bar intro-cinematic__bar--bottom">
          <div class="intro-cinematic__dialogue">
            <div class="intro-cinematic__speaker" data-intro-speaker>Commander Kade</div>
            <div class="intro-cinematic__caption" data-intro-caption>Rift link opening...</div>
          </div>
          <button
            class="intro-cinematic__skip"
            type="button"
            data-ui-control
            data-intro-skip
          >SKIP</button>
        </div>
      </div>
      <div class="death-cinematic" data-death-cinematic aria-hidden="true">
        <div class="death-cinematic__bar death-cinematic__bar--top" aria-hidden="true"></div>
        <div class="death-cinematic__bar death-cinematic__bar--bottom" aria-hidden="true">
          <div class="death-cinematic__caption" data-death-caption>Oof! Reboot me!</div>
        </div>
        <div class="death-cinematic__actions" data-death-actions>
          <button
            class="death-cinematic__button death-cinematic__button--primary"
            type="button"
            data-ui-control
            data-death-try-again
          >TRY AGAIN</button>
          <button
            class="death-cinematic__button"
            type="button"
            data-ui-control
            data-death-return-title
          >RETURN TO TITLE</button>
        </div>
      </div>
      <div class="victory-cinematic" data-victory-cinematic aria-hidden="true">
        <div class="victory-cinematic__bar victory-cinematic__bar--top" aria-hidden="true"></div>
        <div class="victory-cinematic__bar victory-cinematic__bar--bottom" aria-hidden="true">
          <div class="victory-cinematic__caption" data-victory-caption>Rift sealed! Nice work!</div>
        </div>
        <section class="victory-scoreboard" data-victory-scoreboard aria-label="Level clear scoreboard">
          <div class="victory-scoreboard__eyebrow">LEVEL CLEAR</div>
          <div class="victory-scoreboard__rank" data-victory-rank>A</div>
          <div class="victory-scoreboard__grid">
            <span>TIME</span>
            <strong data-victory-time>0:00</strong>
            <span>HP</span>
            <strong data-victory-hp>${PLAYER_MAX_HEALTH} / ${PLAYER_MAX_HEALTH}</strong>
            <span>HOSTILES</span>
            <strong data-victory-enemies>0 / 0</strong>
            <span>SHOTS</span>
            <strong data-victory-shots>0</strong>
          </div>
          <button
            class="victory-scoreboard__continue"
            type="button"
            data-ui-control
            data-victory-continue
          >CONTINUE</button>
        </section>
        <div class="victory-cinematic__actions" data-victory-actions>
          <button
            class="death-cinematic__button death-cinematic__button--primary"
            type="button"
            data-ui-control
            data-victory-try-again
          >TRY AGAIN</button>
          <button
            class="death-cinematic__button"
            type="button"
            data-ui-control
            data-victory-return-title
          >RETURN TO TITLE</button>
        </div>
      </div>
      <div class="voice-lab" data-voice-lab aria-hidden="true">
        <div class="voice-lab__topbar">
          <button
            class="character-debug__button"
            type="button"
            data-ui-control
            data-voice-lab-back
          >BACK</button>
          <div class="voice-lab__title">${VOICE_LAB_TITLE}</div>
          <button
            class="character-debug__button"
            type="button"
            data-ui-control
            data-voice-lab-stop
          >STOP</button>
        </div>
        <section class="voice-lab__panel" aria-label="${VOICE_LAB_TITLE}">
          <div class="voice-lab__status" data-voice-lab-status>VOICE LAB READY</div>
          <div class="voice-lab__list" data-voice-line-list></div>
        </section>
      </div>
      <div class="character-debug" data-character-debug aria-hidden="true">
        <div class="character-debug__topbar">
          <button
            class="character-debug__button"
            type="button"
            data-ui-control
            data-character-debug-back
          >BACK</button>
          <div class="character-debug__title">CHARACTER POSE</div>
          <div class="character-debug__actions">
            <button
              class="character-debug__button"
              type="button"
              data-ui-control
              data-character-pose-copy
            >COPY</button>
            <button
              class="character-debug__button character-debug__button--primary"
              type="button"
              data-ui-control
              data-character-pose-save
            >SAVE</button>
          </div>
        </div>
        <aside class="character-debug__panel">
          <div class="character-debug__status" data-character-pose-status>LOAD</div>
          <div class="character-debug__view">
            <label class="character-debug__view-row character-debug__view-row--animation">
              <span>ANIM</span>
              <select data-ui-control data-character-animation-select></select>
            </label>
            <label class="character-debug__view-row character-debug__view-row--bone">
              <span>BONE</span>
              <select data-ui-control data-character-bone-select></select>
            </label>
            <label class="character-debug__view-row character-debug__view-row--view">
              <span>VIEW</span>
              <input data-ui-control data-character-view-yaw type="range" min="-180" max="180" step="1" value="0" />
            </label>
            <label class="character-debug__view-row character-debug__view-row--zoom">
              <span>ZOOM</span>
              <input data-ui-control data-character-view-zoom type="range" min="2.1" max="5.5" step="0.1" value="3.2" />
            </label>
          </div>
          <div class="character-debug__tools">
            <button
              class="character-debug__button"
              type="button"
              data-ui-control
              data-character-pose-reset
            >RESET</button>
            <button
              class="character-debug__button"
              type="button"
              data-ui-control
              data-character-pose-mirror
            >MIRROR</button>
          </div>
          <div class="character-pose" data-character-pose-controls></div>
          <textarea class="character-debug__json" data-ui-control data-character-pose-json readonly spellcheck="false"></textarea>
        </aside>
      </div>
      <div class="touch-zones">
        <div class="stick" data-move-stick>
          <div class="stick__knob" data-stick-knob></div>
        </div>
        <div class="action-pad action-pad--combat">
          <button
            class="action-button action-button--weapon-cycle"
            type="button"
            data-ui-control
            data-action-button
            data-weapon-cycle-button
            aria-label="Switch weapon"
          >
            <svg class="gun-icon" viewBox="0 0 40 32" aria-hidden="true" focusable="false">
              <path class="gun-icon__body gun-icon__body--top" d="M6 8h17l4 3h6v4h-8l-3-2h-7l-2 7H9l1-7H6z" />
              <path class="gun-icon__body gun-icon__body--bottom" d="M34 24H17l-4-3H7v-4h8l3 2h7l2-7h4l-1 7h4z" />
              <path class="gun-icon__swap" d="M27 5l4 4-4 4M13 27l-4-4 4-4" />
            </svg>
          </button>
          <button
            class="action-button action-button--fire"
            type="button"
            data-ui-control
            data-action-button
            data-fire-button
            aria-label="Hold to aim and fire"
          >
            <span class="reticle-icon" aria-hidden="true"></span>
          </button>
        </div>
      </div>
      <div class="rotate-prompt" role="status" aria-live="polite">
        <div class="rotate-prompt__content">
          <div class="rotate-prompt__icon" aria-hidden="true">
            <span class="rotate-prompt__phone"></span>
          </div>
          <div class="rotate-prompt__label">ROTATE TO LANDSCAPE</div>
        </div>
      </div>
    </div>
  `;
}

function readLoadingSnapshot(
  levelRuntime: FoundationLevelRuntime,
  weaponSystem: WeaponSystem,
  enemySystem: EnemySystem,
  titleHeroSnapshot: TitleHeroStageSnapshot,
  introCinematicSnapshot: IntroCinematicStageSnapshot,
  deathCinematicSnapshot: DeathCinematicStageSnapshot,
  victoryCinematicSnapshot: VictoryCinematicStageSnapshot,
  titleBackgroundLoaded: boolean,
  titleBackgroundError: string | null,
): UiLoadingSnapshot {
  const levelSnapshot = levelRuntime.getSnapshot();
  const weaponSnapshot = weaponSystem.getSnapshot();
  const enemySnapshot = enemySystem.getSnapshot();
  const loadedGameplayAssetIds = new Set([
    ...levelSnapshot.loadedTextureAssetIds,
    ...weaponSnapshot.loadedAssetIds,
    ...enemySnapshot.loadedAssetIds,
  ]);
  const assetLoadErrors = [
    ...levelSnapshot.assetLoadErrors,
    ...weaponSnapshot.assetLoadErrors,
    ...enemySnapshot.assetLoadErrors,
    ...titleHeroSnapshot.errors,
    ...introCinematicSnapshot.errors,
    ...deathCinematicSnapshot.errors,
    ...victoryCinematicSnapshot.errors,
  ];
  if (titleBackgroundError) {
    assetLoadErrors.push(titleBackgroundError);
  }
  const loadedAssets =
    loadedGameplayAssetIds.size +
    (titleBackgroundLoaded ? 1 : 0) +
    (introCinematicSnapshot.portraitLoaded ? 1 : 0);
  const ready =
    loadedAssets >= EXPECTED_BOOT_ASSET_COUNT &&
    assetLoadErrors.length === 0 &&
    weaponSnapshot.modelBytesLoaded > 0 &&
    enemySnapshot.modelBytesLoaded > 0 &&
    titleBackgroundLoaded &&
    titleHeroSnapshot.loaded &&
    introCinematicSnapshot.portraitLoaded &&
    deathCinematicSnapshot.loaded &&
    victoryCinematicSnapshot.loaded;

  return {
    ready,
    loadedAssets,
    expectedAssets: EXPECTED_BOOT_ASSET_COUNT,
    titleBackgroundLoaded,
    titleBackgroundAssetId: TITLE_BACKGROUND_ASSET_ID,
    titleHeroLoaded: titleHeroSnapshot.loaded,
    titleHeroAssetId: titleHeroSnapshot.assetId,
    introPortraitLoaded: introCinematicSnapshot.portraitLoaded,
    introPortraitAssetId: INTRO_COMMANDER_PORTRAIT_ASSET_ID,
    assetLoadErrors,
  };
}

function renderTitleLines(title: string): string {
  let letterIndex = 0;
  return title
    .toUpperCase()
    .split(/\s+/)
    .map((word) => {
      const letters = [...word]
        .map((letter) => `<span aria-hidden="true" style="--letter-index: ${letterIndex++}">${letter}</span>`)
        .join('');
      return `<span class="title-screen__line" aria-hidden="true">${letters}</span>`;
    })
    .join('');
}

function updateLoadingScreen(root: HTMLElement, snapshot: UiLoadingSnapshot): void {
  const count = root.querySelector<HTMLElement>('[data-loading-count]');
  const fill = root.querySelector<HTMLElement>('[data-loading-fill]');
  if (count) {
    count.textContent = snapshot.assetLoadErrors.length > 0
      ? 'LOAD ISSUE'
      : `${snapshot.loadedAssets} / ${snapshot.expectedAssets}`;
  }
  if (fill) {
    fill.style.width = `${Math.max(0, Math.min(1, snapshot.loadedAssets / snapshot.expectedAssets)) * 100}%`;
  }
}

function readFoundationExitPosition(): THREE.Vector3 {
  const exitTile = getLevelTiles().find((tile) => tile.symbol === 'X');
  if (!exitTile) {
    throw new Error('Foundation level is missing an X exit tile.');
  }

  return new THREE.Vector3(exitTile.worldX, 0, exitTile.worldZ);
}

function createEmptyVictoryScore(): VictoryScore {
  return {
    clearTimeSeconds: 0,
    enemiesDestroyed: 0,
    enemiesTotal: 0,
    hp: PLAYER_MAX_HEALTH,
    hpMax: PLAYER_MAX_HEALTH,
    shotsFired: 0,
    rank: 'A',
  };
}

function createVictoryScore(
  elapsedMs: number,
  health: HealthSnapshot,
  enemies: EnemySystemSnapshot,
  shotsFired: number,
): VictoryScore {
  const clearTimeSeconds = Math.max(0, elapsedMs / 1000);
  const hp = Math.max(0, Math.round(health.current));
  const hpRatio = health.max > 0 ? health.current / health.max : 0;
  const clearRatio = enemies.total > 0 ? enemies.destroyed / enemies.total : 0;
  const rankScore =
    hpRatio * 42 +
    clearRatio * 38 +
    Math.max(0, 1 - clearTimeSeconds / 180) * 20 -
    Math.max(0, shotsFired - 80) * 0.08;

  return {
    clearTimeSeconds: roundMetric(clearTimeSeconds),
    enemiesDestroyed: enemies.destroyed,
    enemiesTotal: enemies.total,
    hp,
    hpMax: Math.round(health.max),
    shotsFired,
    rank: readVictoryRank(rankScore),
  };
}

function updateVictoryScoreboard(root: HTMLElement, score: VictoryScore): void {
  setHudText(root, '[data-victory-rank]', score.rank);
  setHudText(root, '[data-victory-time]', formatVictoryTime(score.clearTimeSeconds));
  setHudText(root, '[data-victory-hp]', `${score.hp} / ${score.hpMax}`);
  setHudText(root, '[data-victory-enemies]', `${score.enemiesDestroyed} / ${score.enemiesTotal}`);
  setHudText(root, '[data-victory-shots]', String(score.shotsFired));
}

function readVictoryRank(score: number): string {
  if (score >= 92) {
    return 'S';
  }
  if (score >= 78) {
    return 'A';
  }
  if (score >= 58) {
    return 'B';
  }
  return 'C';
}

function formatVictoryTime(seconds: number): string {
  const totalSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function shouldPreserveDrawingBuffer(): boolean {
  return import.meta.env.DEV || new URLSearchParams(window.location.search).has('qaCapture');
}

function updateDebugHud(root: HTMLElement, debug: DebugApi): void {
  const snapshot = debug.getSnapshot();
  setHudText(root, '[data-debug-fps]', `FPS ${Math.round(snapshot.rendererMetrics.fps)}`);
  setHudText(root, '[data-debug-coordinates]', formatCoordinates(snapshot.scene.playerPosition));
  setHudText(root, '[data-debug-memory]', `JS ${formatMaybeMb(snapshot.memoryMetrics.jsHeapMb)}`);
  setHudText(root, '[data-debug-level-memory]', `LVL ${formatBytes(snapshot.memoryMetrics.levelRuntimeBytesEstimate)}`);
  setHudText(root, '[data-weapon-label]', snapshot.weapon.activeWeaponLabel);
  setHudText(
    root,
    '[data-weapon-ammo]',
    snapshot.weapon.isReloading
      ? `LOAD ${Math.ceil(snapshot.weapon.reloadRemainingMs / 1000)}s`
      : `${snapshot.weapon.ammoInMagazine} / ${snapshot.weapon.magazineSize}`,
  );
  setHudWidth(root, '[data-weapon-reload-fill]', `${snapshot.weapon.reloadProgress * 100}%`);
  setHudClass(root, '[data-weapon-ammo-meter]', 'ammo-meter--reloading', snapshot.weapon.isReloading);
  setHudText(
    root,
    '[data-debug-chunks]',
    `CH ${snapshot.level.streaming.activeChunks}/${snapshot.level.streaming.loadedChunks}`,
  );
  setHudText(
    root,
    '[data-health-value]',
    `${Math.round(snapshot.player.health.current)} / ${Math.round(snapshot.player.health.max)}`,
  );
  setHudWidth(root, '[data-health-fill]', `${Math.max(0, Math.min(1, snapshot.player.health.ratio)) * 100}%`);
}

function setHudText(root: HTMLElement, selector: string, text: string): void {
  const element = root.querySelector<HTMLElement>(selector);
  if (element) {
    element.textContent = text;
  }
}

function setHudWidth(root: HTMLElement, selector: string, width: string): void {
  const element = root.querySelector<HTMLElement>(selector);
  if (element) {
    element.style.width = width;
  }
}

function setHudClass(root: HTMLElement, selector: string, className: string, enabled: boolean): void {
  const element = root.querySelector<HTMLElement>(selector);
  if (element) {
    element.classList.toggle(className, enabled);
  }
}

function formatMaybeMb(value: number | null): string {
  if (value === null) {
    return '--';
  }

  return `${Math.round(value)}M`;
}

function formatCoordinates(position: readonly [number, number, number]): string {
  return `XYZ ${formatCoordinate(position[0])} ${formatCoordinate(position[1])} ${formatCoordinate(position[2])}`;
}

function formatCoordinate(value: number): string {
  return value.toFixed(1);
}

function roundMetric(value: number): number {
  return Math.round(value * 10) / 10;
}

function stripVoiceDirectionTags(text: string): string {
  return text.replace(/\[[^\]]+\]\s*/g, '').trim();
}

function readRandomIndex(length: number): number {
  if (length <= 1) {
    return 0;
  }

  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.getRandomValues) {
    const value = new Uint32Array(1);
    cryptoApi.getRandomValues(value);
    return value[0] % length;
  }

  return Math.floor(Math.random() * length);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes}B`;
  }

  if (bytes < 1_048_576) {
    return `${Math.round(bytes / 1024)}K`;
  }

  return `${Math.round(bytes / 1_048_576)}M`;
}
