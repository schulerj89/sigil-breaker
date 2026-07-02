import Phaser from 'phaser';
import { TILE_TEXTURE_KEYS } from '../assets/assetManifest';
import { getLevelEntry, levelCatalog } from '../content/levelCatalog';
import type { Direction } from '../core/direction';
import { positionsEqual, type Position } from '../core/grid';
import { previewGolemMoves } from '../core/levelState';
import type { TerrainTile } from '../core/levelTypes';
import type { GameSession } from '../systems/gameEngine';
import {
  applySessionMove,
  createGameSession,
  restartSession,
  undoSession,
} from '../systems/gameEngine';
import {
  completeLevel,
  loadProgress,
  saveProgress,
  type ProgressState,
  type StorageLike,
} from '../systems/progress';
import { makeTextButton } from '../ui/textButton';

const LEVEL_PADDING = 18;
const DESKTOP_HUD_HEIGHT = 104;
const COMPACT_HUD_HEIGHT = 94;
const COMPACT_LANDSCAPE_HUD_HEIGHT = 74;
const TOUCH_CONTROLS_HEIGHT = 136;
const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  color: '#f4efe7',
  fontFamily: 'Inter, Arial, sans-serif',
  fontSize: '16px',
};

interface LevelSceneData {
  levelIndex?: number;
}

interface SceneLayout {
  compact: boolean;
  showTouchControls: boolean;
  hudHeight: number;
  controlsHeight: number;
  boardOriginX: number;
  boardOriginY: number;
  tileSize: number;
}

export class LevelScene extends Phaser.Scene {
  private levelIndex = 0;
  private session!: GameSession;
  private progress!: ProgressState;
  private showGrid = true;
  private showPreview = false;
  private hasRecordedWin = false;
  private swipeStart?: Position;

  constructor() {
    super('LevelScene');
  }

  create(data: LevelSceneData): void {
    this.levelIndex = Phaser.Math.Clamp(data.levelIndex ?? 0, 0, levelCatalog.length - 1);
    this.progress = loadProgress(getBrowserStorage(), levelIds());
    this.session = createGameSession(getLevelEntry(this.levelIndex).level);

    this.input.keyboard?.on('keydown', this.handleKeyDown);
    this.input.on('pointerdown', this.handlePointerDown);
    this.input.on('pointerup', this.handlePointerUp);
    this.scale.on('resize', this.renderLevel, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown', this.handleKeyDown);
      this.input.off('pointerdown', this.handlePointerDown);
      this.input.off('pointerup', this.handlePointerUp);
      this.scale.off('resize', this.renderLevel, this);
    });

    this.renderLevel();
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key.toLowerCase() === 'z' || event.key === 'Backspace') {
      event.preventDefault();
      this.undoTurn();
      return;
    }

    if (event.key.toLowerCase() === 'r') {
      event.preventDefault();
      this.restartLevel();
      return;
    }

    if (event.key.toLowerCase() === 'g') {
      event.preventDefault();
      this.toggleGrid();
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      this.togglePreview();
      return;
    }

    if (event.key.toLowerCase() === 'n' && this.session.state.hasWon) {
      event.preventDefault();
      this.goToLevel(this.levelIndex + 1);
      return;
    }

    const direction = directionFromKeyboardEvent(event);
    if (!direction) {
      return;
    }

    event.preventDefault();
    this.movePlayer(direction);
  };

  private readonly handlePointerDown = (pointer: Phaser.Input.Pointer): void => {
    this.swipeStart = { x: pointer.x, y: pointer.y };
  };

  private readonly handlePointerUp = (pointer: Phaser.Input.Pointer): void => {
    if (!this.swipeStart) {
      return;
    }

    const deltaX = pointer.x - this.swipeStart.x;
    const deltaY = pointer.y - this.swipeStart.y;
    this.swipeStart = undefined;

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    if (Math.max(absX, absY) < 34) {
      return;
    }

    this.movePlayer(absX > absY ? (deltaX > 0 ? 'right' : 'left') : deltaY > 0 ? 'down' : 'up');
  };

  private movePlayer(direction: Direction): void {
    const nextSession = applySessionMove(this.session, direction);
    if (nextSession !== this.session) {
      this.session = nextSession;
      this.recordWinIfNeeded();
      this.renderLevel();
    }
  }

  private undoTurn(): void {
    this.session = undoSession(this.session);
    this.hasRecordedWin = this.session.state.hasWon;
    this.renderLevel();
  }

  private restartLevel(): void {
    this.session = restartSession(this.session);
    this.hasRecordedWin = false;
    this.renderLevel();
  }

  private toggleGrid(): void {
    this.showGrid = !this.showGrid;
    this.renderLevel();
  }

  private togglePreview(): void {
    this.showPreview = !this.showPreview;
    this.renderLevel();
  }

  private renderLevel(): void {
    this.children.removeAll(true);

    const layout = this.calculateLayout();
    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x101418).setOrigin(0);
    this.renderHud(layout);

    const { width, height } = this.session.level;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        this.addTile(this.session.level.tiles[y][x], layout.boardOriginX, layout.boardOriginY, x, y, layout.tileSize);
      }
    }

    for (const crate of this.session.state.crates) {
      this.addEntity(TILE_TEXTURE_KEYS.crate, layout.boardOriginX, layout.boardOriginY, crate.x, crate.y, layout.tileSize, 0.82);
    }

    for (const golem of this.session.state.golems) {
      this.addEntity(TILE_TEXTURE_KEYS.golem, layout.boardOriginX, layout.boardOriginY, golem.x, golem.y, layout.tileSize, 0.88);
    }

    this.addEntity(
      TILE_TEXTURE_KEYS.player,
      layout.boardOriginX,
      layout.boardOriginY,
      this.session.state.player.x,
      this.session.state.player.y,
      layout.tileSize,
      0.72,
    );

    if (this.showGrid) {
      this.addGridOverlay(layout.boardOriginX, layout.boardOriginY, width, height, layout.tileSize);
    }

    if (this.showPreview) {
      this.addGolemPreview(layout.boardOriginX, layout.boardOriginY, layout.tileSize);
    }

    if (layout.showTouchControls) {
      this.renderTouchControls(layout);
    }
  }

  private calculateLayout(): SceneLayout {
    const compact = isCompactScreen(this.scale.width, this.scale.height);
    const compactLandscape = compact && this.scale.width > this.scale.height;
    const showTouchControls = compact && !compactLandscape;
    const hudHeight = compact
      ? compactLandscape
        ? COMPACT_LANDSCAPE_HUD_HEIGHT
        : COMPACT_HUD_HEIGHT
      : DESKTOP_HUD_HEIGHT;
    const controlsHeight = showTouchControls ? TOUCH_CONTROLS_HEIGHT : 0;
    const padding = compact ? 12 : LEVEL_PADDING;
    const { width, height } = this.session.level;
    const availableWidth = Math.max(1, this.scale.width - padding * 2);
    const availableHeight = Math.max(1, this.scale.height - hudHeight - controlsHeight - padding * 2);
    const tileSize = Math.max(1, Math.floor(Math.min(availableWidth / width, availableHeight / height)));
    const boardWidth = tileSize * width;
    const boardHeight = tileSize * height;

    return {
      compact,
      showTouchControls,
      hudHeight,
      controlsHeight,
      boardOriginX: Math.floor((this.scale.width - boardWidth) / 2),
      boardOriginY: Math.floor(hudHeight + padding + (availableHeight - boardHeight) / 2),
      tileSize,
    };
  }

  private renderHud(layout: SceneLayout): void {
    const entry = getLevelEntry(this.levelIndex);
    const progress = this.progress.levels[entry.id];
    const bestTurns = progress?.bestTurns === undefined ? '--' : String(progress.bestTurns);
    const compact = layout.compact;

    this.add.text(compact ? 12 : 18, compact ? 8 : 12, `${entry.order.toString().padStart(2, '0')} ${entry.title}`, {
      ...TEXT_STYLE,
      fontSize: compact ? '16px' : '20px',
    });
    this.add.text(compact ? 12 : 18, compact ? 32 : 40, `Turns ${this.session.state.turnCount}   Best ${bestTurns}`, {
      ...TEXT_STYLE,
      fontSize: compact ? '13px' : '16px',
    });

    if (compact) {
      this.renderCompactNav();
    } else {
      this.renderDesktopNav();
      this.renderDesktopActionButtons();
    }

    if (this.session.state.hasWon) {
      this.add
        .text(compact ? this.scale.width - 12 : this.scale.width / 2, compact ? 32 : 36, compact ? 'Solved' : 'Solved', {
          ...TEXT_STYLE,
          color: '#62c997',
          fontSize: compact ? '14px' : '22px',
        })
        .setOrigin(compact ? 1 : 0.5, 0);
    }

    if (this.session.state.isCaught) {
      this.add
        .text(compact ? this.scale.width - 12 : this.scale.width / 2, compact ? 32 : 36, compact ? 'Caught' : 'Caught', {
          ...TEXT_STYLE,
          color: '#e26d6d',
          fontSize: compact ? '14px' : '22px',
        })
        .setOrigin(compact ? 1 : 0.5, 0);
    }
  }

  private renderCompactNav(): void {
    const buttonGap = 6;
    const buttonWidths = [64, 52, 52, 52];
    const totalWidth = buttonWidths.reduce((sum, width) => sum + width, 0) + buttonGap * (buttonWidths.length - 1);
    let x = Math.max(8, Math.floor((this.scale.width - totalWidth) / 2));
    const y = 56;

    this.addHudButton(x, y, buttonWidths[0], 30, 'Select', () => this.scene.start('LevelSelectScene'));
    x += buttonWidths[0] + buttonGap;
    this.addHudButton(x, y, buttonWidths[1], 30, 'Prev', () => this.goToLevel(this.levelIndex - 1));
    x += buttonWidths[1] + buttonGap;
    this.addHudButton(x, y, buttonWidths[2], 30, 'Next', () => this.goToLevel(this.levelIndex + 1));
    x += buttonWidths[2] + buttonGap;
    this.addHudButton(x, y, buttonWidths[3], 30, 'Menu', () => this.scene.start('TitleScene'));
  }

  private renderDesktopNav(): void {
    makeTextButton(this, this.scale.width - 322, 18, 'Select', () => {
      this.scene.start('LevelSelectScene');
    });
    makeTextButton(this, this.scale.width - 238, 18, 'Prev', () => {
      this.goToLevel(this.levelIndex - 1);
    });
    makeTextButton(this, this.scale.width - 166, 18, 'Next', () => {
      this.goToLevel(this.levelIndex + 1);
    });
    makeTextButton(this, this.scale.width - 94, 18, 'Menu', () => {
      this.scene.start('TitleScene');
    });
  }

  private renderDesktopActionButtons(): void {
    this.addHudButton(18, 66, 72, 30, 'Undo', () => this.undoTurn());
    this.addHudButton(98, 66, 86, 30, 'Restart', () => this.restartLevel());
    this.addHudButton(192, 66, 70, 30, this.showGrid ? 'Grid On' : 'Grid Off', () => this.toggleGrid());
    this.addHudButton(270, 66, 86, 30, this.showPreview ? 'Preview On' : 'Preview', () => this.togglePreview());
  }

  private renderTouchControls(layout: SceneLayout): void {
    const top = this.scale.height - layout.controlsHeight;
    this.add.rectangle(0, top, this.scale.width, layout.controlsHeight, 0x171d23, 0.96).setOrigin(0);

    const dpadSize = 40;
    const dpadOffset = 42;
    const dpadCenterX = Math.min(78, Math.max(66, this.scale.width * 0.22));
    const dpadCenterY = top + layout.controlsHeight / 2;
    this.addHudButton(dpadCenterX, dpadCenterY - dpadOffset, dpadSize, dpadSize, '^', () => this.movePlayer('up'), true);
    this.addHudButton(dpadCenterX - dpadOffset, dpadCenterY, dpadSize, dpadSize, '<', () => this.movePlayer('left'), true);
    this.addHudButton(dpadCenterX + dpadOffset, dpadCenterY, dpadSize, dpadSize, '>', () => this.movePlayer('right'), true);
    this.addHudButton(dpadCenterX, dpadCenterY + dpadOffset, dpadSize, dpadSize, 'v', () => this.movePlayer('down'), true);

    const actionStartX = Math.max(dpadCenterX + 68, Math.floor(this.scale.width * 0.44));
    const actionGap = 8;
    const actionWidth = Math.max(68, Math.floor((this.scale.width - actionStartX - 12 - actionGap) / 2));
    const actionHeight = 32;
    this.addHudButton(actionStartX, top + 20, actionWidth, actionHeight, 'Undo', () => this.undoTurn());
    this.addHudButton(actionStartX + actionWidth + actionGap, top + 20, actionWidth, actionHeight, 'Restart', () => this.restartLevel());
    this.addHudButton(actionStartX, top + 64, actionWidth, actionHeight, this.showGrid ? 'Grid On' : 'Grid Off', () => this.toggleGrid());
    this.addHudButton(actionStartX + actionWidth + actionGap, top + 64, actionWidth, actionHeight, 'Preview', () => this.togglePreview());
  }

  private addHudButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    onClick: () => void,
    centered = false,
  ): Phaser.GameObjects.Container {
    const originX = centered ? 0.5 : 0;
    const originY = centered ? 0.5 : 0;
    const background = this.add
      .rectangle(0, 0, width, height, 0xf0d078)
      .setOrigin(originX, originY)
      .setStrokeStyle(1, 0x101418, 0.72);
    const text = this.add
      .text(centered ? 0 : width / 2, centered ? 0 : height / 2, label, {
        color: '#101418',
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: width < 54 ? '18px' : '13px',
      })
      .setOrigin(0.5)
      .setAlign('center');
    const container = this.add.container(x, y, [background, text]);

    background.setInteractive({ useHandCursor: true });
    background.on('pointerdown', onClick);
    background.on('pointerover', () => background.setFillStyle(0xf4efe7));
    background.on('pointerout', () => background.setFillStyle(0xf0d078));

    return container;
  }

  private addTile(
    tile: TerrainTile,
    originX: number,
    originY: number,
    x: number,
    y: number,
    tileSize: number,
  ): void {
    this.add
      .image(
        originX + x * tileSize + tileSize / 2,
        originY + y * tileSize + tileSize / 2,
        this.textureKeyForTile(tile, { x, y }),
      )
      .setDisplaySize(tileSize, tileSize);
  }

  private addEntity(
    textureKey: string,
    originX: number,
    originY: number,
    x: number,
    y: number,
    tileSize: number,
    scale: number,
  ): void {
    const size = Math.max(1, Math.floor(tileSize * scale));
    const image = this.add
      .image(
        originX + x * tileSize + tileSize / 2,
        originY + y * tileSize + tileSize / 2,
        textureKey,
      )
      .setDisplaySize(size, size);

    this.tweens.add({
      targets: image,
      scaleX: image.scaleX * 1.04,
      scaleY: image.scaleY * 1.04,
      duration: 80,
      yoyo: true,
      ease: 'Sine.easeOut',
    });
  }

  private addGridOverlay(
    originX: number,
    originY: number,
    width: number,
    height: number,
    tileSize: number,
  ): void {
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x0f1418, 0.58);

    for (let x = 0; x <= width; x += 1) {
      graphics.lineBetween(originX + x * tileSize, originY, originX + x * tileSize, originY + height * tileSize);
    }

    for (let y = 0; y <= height; y += 1) {
      graphics.lineBetween(originX, originY + y * tileSize, originX + width * tileSize, originY + y * tileSize);
    }
  }

  private addGolemPreview(originX: number, originY: number, tileSize: number): void {
    const graphics = this.add.graphics();
    graphics.lineStyle(3, 0xd8ccff, 0.92);
    graphics.fillStyle(0xd8ccff, 0.18);

    for (const position of previewGolemMoves(this.session.level, this.session.state)) {
      const x = originX + position.x * tileSize + tileSize / 2;
      const y = originY + position.y * tileSize + tileSize / 2;
      graphics.fillCircle(x, y, tileSize * 0.22);
      graphics.strokeCircle(x, y, tileSize * 0.24);
    }
  }

  private textureKeyForTile(tile: TerrainTile, position: Position): string {
    if (tile.kind === 'pressurePlate') {
      return TILE_TEXTURE_KEYS.redPressurePlate;
    }

    if (tile.kind === 'door') {
      const isOpen = this.session.state.openDoors.some((door) => positionsEqual(door, position));
      return isOpen ? TILE_TEXTURE_KEYS.redDoorOpen : TILE_TEXTURE_KEYS.redDoor;
    }

    if (tile.kind === 'exit') {
      return TILE_TEXTURE_KEYS.exit;
    }

    return tile.kind === 'wall' ? TILE_TEXTURE_KEYS.wall : TILE_TEXTURE_KEYS.floor;
  }

  private goToLevel(index: number): void {
    if (index < 0 || index >= levelCatalog.length) {
      return;
    }

    const nextEntry = getLevelEntry(index);
    if (!this.progress.levels[nextEntry.id]?.unlocked) {
      return;
    }

    this.levelIndex = index;
    this.session = createGameSession(nextEntry.level);
    this.hasRecordedWin = false;
    this.showPreview = false;
    this.renderLevel();
  }

  private recordWinIfNeeded(): void {
    if (!this.session.state.hasWon || this.hasRecordedWin) {
      return;
    }

    this.progress = completeLevel(
      this.progress,
      levelIds(),
      this.session.level.id,
      this.session.state.turnCount,
    );
    saveProgress(getBrowserStorage(), this.progress);
    this.hasRecordedWin = true;
  }
}

function directionFromKeyboardEvent(event: KeyboardEvent): Direction | undefined {
  switch (event.key.toLowerCase()) {
    case 'arrowup':
    case 'w':
      return 'up';
    case 'arrowdown':
    case 's':
      return 'down';
    case 'arrowleft':
    case 'a':
      return 'left';
    case 'arrowright':
    case 'd':
      return 'right';
    default:
      return undefined;
  }
}

function levelIds(): string[] {
  return levelCatalog.map((entry) => entry.id);
}

function getBrowserStorage(): StorageLike | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}

function isCompactScreen(width: number, height: number): boolean {
  return width < 720 || height < 620;
}
