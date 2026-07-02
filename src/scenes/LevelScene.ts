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
const HUD_HEIGHT = 100;
const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  color: '#f4efe7',
  fontFamily: 'Inter, Arial, sans-serif',
  fontSize: '16px',
};

interface LevelSceneData {
  levelIndex?: number;
}

export class LevelScene extends Phaser.Scene {
  private levelIndex = 0;
  private session!: GameSession;
  private progress!: ProgressState;
  private showGrid = true;
  private showPreview = false;
  private hasRecordedWin = false;

  constructor() {
    super('LevelScene');
  }

  create(data: LevelSceneData): void {
    this.levelIndex = Phaser.Math.Clamp(data.levelIndex ?? 0, 0, levelCatalog.length - 1);
    this.progress = loadProgress(getBrowserStorage(), levelIds());
    this.session = createGameSession(getLevelEntry(this.levelIndex).level);

    this.input.keyboard?.on('keydown', this.handleKeyDown);
    this.scale.on('resize', this.renderLevel, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown', this.handleKeyDown);
      this.scale.off('resize', this.renderLevel, this);
    });

    this.renderLevel();
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key.toLowerCase() === 'z' || event.key === 'Backspace') {
      event.preventDefault();
      this.session = undoSession(this.session);
      this.hasRecordedWin = this.session.state.hasWon;
      this.renderLevel();
      return;
    }

    if (event.key.toLowerCase() === 'r') {
      event.preventDefault();
      this.session = restartSession(this.session);
      this.hasRecordedWin = false;
      this.renderLevel();
      return;
    }

    if (event.key.toLowerCase() === 'g') {
      event.preventDefault();
      this.showGrid = !this.showGrid;
      this.renderLevel();
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      this.showPreview = !this.showPreview;
      this.renderLevel();
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
    const nextSession = applySessionMove(this.session, direction);
    if (nextSession !== this.session) {
      this.session = nextSession;
      this.recordWinIfNeeded();
      this.renderLevel();
    }
  };

  private renderLevel(): void {
    this.children.removeAll(true);

    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x101418).setOrigin(0);
    this.renderHud();

    const { width, height } = this.session.level;
    const availableWidth = Math.max(1, this.scale.width - LEVEL_PADDING * 2);
    const availableHeight = Math.max(1, this.scale.height - HUD_HEIGHT - LEVEL_PADDING * 2);
    const tileSize = Math.floor(Math.min(availableWidth / width, availableHeight / height));
    const boardWidth = tileSize * width;
    const boardHeight = tileSize * height;
    const originX = Math.floor((this.scale.width - boardWidth) / 2);
    const originY = Math.floor(HUD_HEIGHT + (this.scale.height - HUD_HEIGHT - boardHeight) / 2);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        this.addTile(this.session.level.tiles[y][x], originX, originY, x, y, tileSize);
      }
    }

    for (const crate of this.session.state.crates) {
      this.addEntity(TILE_TEXTURE_KEYS.crate, originX, originY, crate.x, crate.y, tileSize, 0.82);
    }

    for (const golem of this.session.state.golems) {
      this.addEntity(TILE_TEXTURE_KEYS.golem, originX, originY, golem.x, golem.y, tileSize, 0.88);
    }

    this.addEntity(
      TILE_TEXTURE_KEYS.player,
      originX,
      originY,
      this.session.state.player.x,
      this.session.state.player.y,
      tileSize,
      0.72,
    );

    if (this.showGrid) {
      this.addGridOverlay(originX, originY, width, height, tileSize);
    }

    if (this.showPreview) {
      this.addGolemPreview(originX, originY, tileSize);
    }
  }

  private renderHud(): void {
    const entry = getLevelEntry(this.levelIndex);
    const progress = this.progress.levels[entry.id];
    const bestTurns = progress?.bestTurns === undefined ? '--' : String(progress.bestTurns);

    this.add.text(18, 12, `${entry.order.toString().padStart(2, '0')} ${entry.title}`, {
      ...TEXT_STYLE,
      fontSize: '20px',
    });
    this.add.text(18, 40, `Turns ${this.session.state.turnCount}   Best ${bestTurns}`, TEXT_STYLE);
    this.add.text(18, 66, 'Undo Z/Backspace   Restart R   Grid G   Preview Tab', {
      ...TEXT_STYLE,
      color: '#b8c0ca',
      fontSize: '14px',
    });

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

    if (this.session.state.hasWon) {
      this.add
        .text(this.scale.width / 2, 36, 'Solved! Press N for next', {
          ...TEXT_STYLE,
          color: '#62c997',
          fontSize: '22px',
        })
        .setOrigin(0.5, 0);
    }

    if (this.session.state.isCaught) {
      this.add
        .text(this.scale.width / 2, 36, 'Caught! Undo or restart', {
          ...TEXT_STYLE,
          color: '#e26d6d',
          fontSize: '22px',
        })
        .setOrigin(0.5, 0);
    }
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
