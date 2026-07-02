import Phaser from 'phaser';
import { levelCatalog } from '../content/levelCatalog';
import {
  loadProgress,
  resetProgress,
  saveProgress,
  type ProgressState,
  type StorageLike,
} from '../systems/progress';
import { makeTextButton } from '../ui/textButton';

const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  color: '#f4efe7',
  fontFamily: 'Inter, Arial, sans-serif',
  fontSize: '16px',
};

export class LevelSelectScene extends Phaser.Scene {
  private progress!: ProgressState;

  constructor() {
    super('LevelSelectScene');
  }

  create(): void {
    this.progress = loadProgress(getBrowserStorage(), levelIds());
    this.render();
  }

  private render(): void {
    this.children.removeAll(true);
    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x101418).setOrigin(0);
    this.add.text(24, 24, 'Level Select', {
      ...TEXT_STYLE,
      fontSize: '30px',
    });

    makeTextButton(this, this.scale.width - 104, 24, 'Menu', () => {
      this.scene.start('TitleScene');
    });

    const startX = Math.max(24, this.scale.width / 2 - 340);
    const startY = 94;
    const cellWidth = 330;
    const cellHeight = 92;

    levelCatalog.forEach((entry, index) => {
      const progress = this.progress.levels[entry.id];
      const unlocked = Boolean(progress?.unlocked);
      const completed = Boolean(progress?.completed);
      const x = startX + (index % 2) * cellWidth;
      const y = startY + Math.floor(index / 2) * cellHeight;
      const backgroundColor = unlocked ? 0x29313a : 0x171d23;
      const borderColor = completed ? 0x62c997 : unlocked ? 0xf0d078 : 0x59626d;
      const panel = this.add
        .rectangle(x, y, cellWidth - 18, cellHeight - 16, backgroundColor)
        .setOrigin(0)
        .setStrokeStyle(2, borderColor, 0.9);

      if (unlocked) {
        panel.setInteractive({ useHandCursor: true });
        panel.on('pointerdown', () => {
          this.scene.start('LevelScene', { levelIndex: index });
        });
      }

      this.add.text(x + 14, y + 12, `${entry.order.toString().padStart(2, '0')} ${entry.title}`, {
        ...TEXT_STYLE,
        color: unlocked ? '#f4efe7' : '#77818d',
        fontSize: '18px',
      });
      this.add.text(x + 14, y + 40, unlocked ? entry.lesson : 'Locked', {
        ...TEXT_STYLE,
        color: '#b8c0ca',
        fontSize: '14px',
      });
      this.add.text(x + 14, y + 62, completed ? `Completed  Best ${progress?.bestTurns}` : 'Not solved', {
        ...TEXT_STYLE,
        color: completed ? '#62c997' : '#8f9aa6',
        fontSize: '14px',
      });
    });

    makeTextButton(this, 24, this.scale.height - 58, 'Reset Progress', () => {
      if (!window.confirm('Reset all Sigilbreaker progress?')) {
        return;
      }

      this.progress = resetProgress(getBrowserStorage(), levelIds());
      saveProgress(getBrowserStorage(), this.progress);
      this.render();
    }, 150);
  }
}

function levelIds(): string[] {
  return levelCatalog.map((entry) => entry.id);
}

function getBrowserStorage(): StorageLike | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}
