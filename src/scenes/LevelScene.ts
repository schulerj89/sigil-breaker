import Phaser from 'phaser';
import { TILE_TEXTURE_KEYS } from '../assets/assetManifest';
import type { Direction } from '../core/direction';
import { positionsEqual, type Position } from '../core/grid';
import { parseLevel } from '../core/levelParser';
import type { LevelDefinition, TerrainTile } from '../core/levelTypes';
import type { GameSession } from '../systems/gameEngine';
import {
  applySessionMove,
  createGameSession,
  restartSession,
  undoSession,
} from '../systems/gameEngine';
import tutorialLevel from '../content/levels/tutorial-01.json';
import tutorialLevelTwo from '../content/levels/tutorial-02.json';
import tutorialLevelThree from '../content/levels/tutorial-03.json';

const LEVEL_PADDING = 18;
const HUD_HEIGHT = 72;
const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  color: '#f4efe7',
  fontFamily: 'Inter, Arial, sans-serif',
  fontSize: '18px',
};

export class LevelScene extends Phaser.Scene {
  private levels = [
    parseLevel(tutorialLevel as LevelDefinition),
    parseLevel(tutorialLevelTwo as LevelDefinition),
    parseLevel(tutorialLevelThree as LevelDefinition),
  ];
  private levelIndex = 0;
  private session!: GameSession;

  constructor() {
    super('LevelScene');
  }

  create(): void {
    this.session = createGameSession(this.levels[this.levelIndex]);

    this.input.keyboard?.on('keydown', this.handleKeyDown);
    this.scale.on('resize', this.renderLevel, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown', this.handleKeyDown);
      this.scale.off('resize', this.renderLevel, this);
    });

    this.renderLevel();
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    const levelIndex = levelIndexFromKeyboardEvent(event);
    if (levelIndex !== undefined) {
      event.preventDefault();
      this.loadLevel(levelIndex);
      return;
    }

    if (event.key.toLowerCase() === 'z' || event.key === 'Backspace') {
      event.preventDefault();
      this.session = undoSession(this.session);
      this.renderLevel();
      return;
    }

    if (event.key.toLowerCase() === 'r') {
      event.preventDefault();
      this.session = restartSession(this.session);
      this.renderLevel();
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
      this.renderLevel();
    }
  };

  private renderLevel(): void {
    this.children.removeAll(true);

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

    this.addEntity(
      TILE_TEXTURE_KEYS.player,
      originX,
      originY,
      this.session.state.player.x,
      this.session.state.player.y,
      tileSize,
      0.72,
    );
  }

  private renderHud(): void {
    this.add.text(18, 14, this.session.level.name, {
      ...TEXT_STYLE,
      fontSize: '20px',
    });

    this.add.text(18, 42, `Turns ${this.session.state.turnCount}`, TEXT_STYLE);

    if (this.session.state.hasWon) {
      this.add
        .text(this.scale.width / 2, 26, 'Solved!', {
          ...TEXT_STYLE,
          color: '#62c997',
          fontSize: '24px',
        })
        .setOrigin(0.5, 0);
    }

    this.levels.forEach((_level, index) => {
      const label = String(index + 1).padStart(2, '0');
      const isActive = index === this.levelIndex;
      const text = this.add
        .text(this.scale.width - 130 + index * 38, 24, label, {
          ...TEXT_STYLE,
          color: isActive ? '#f0d078' : '#8f9aa6',
        })
        .setInteractive({ useHandCursor: true });

      text.on('pointerdown', () => {
        this.loadLevel(index);
      });
    });
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
    this.add
      .image(
        originX + x * tileSize + tileSize / 2,
        originY + y * tileSize + tileSize / 2,
        textureKey,
      )
      .setDisplaySize(size, size);
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

  private loadLevel(index: number): void {
    this.levelIndex = Phaser.Math.Clamp(index, 0, this.levels.length - 1);
    this.session = createGameSession(this.levels[this.levelIndex]);
    this.renderLevel();
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

function levelIndexFromKeyboardEvent(event: KeyboardEvent): number | undefined {
  if (!/^[1-3]$/.test(event.key)) {
    return undefined;
  }

  return Number(event.key) - 1;
}
