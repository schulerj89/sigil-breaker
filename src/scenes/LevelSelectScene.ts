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
    this.scale.on('resize', this.render, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.render, this);
    });
    this.render();
  }

  private render(): void {
    this.children.removeAll(true);
    const compact = this.scale.width < 720;
    const margin = compact ? 12 : 24;
    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x101418).setOrigin(0);
    this.add.text(margin, compact ? 18 : 24, 'Level Select', {
      ...TEXT_STYLE,
      fontSize: compact ? '24px' : '30px',
    });

    makeTextButton(this, this.scale.width - (compact ? 70 : 104), compact ? 18 : 24, 'Menu', () => {
      this.scene.start('TitleScene');
    }, compact ? 58 : 70);

    const columns = 2;
    const gap = compact ? 8 : 0;
    const startX = compact ? margin : Math.max(24, this.scale.width / 2 - 340);
    const startY = compact ? 72 : 94;
    const cellWidth = compact ? Math.floor((this.scale.width - margin * 2 - gap) / columns) : 330;
    const availableRowsHeight = Math.max(1, this.scale.height - startY - (compact ? 72 : 88));
    const cellHeight = compact ? Phaser.Math.Clamp(Math.floor(availableRowsHeight / 6), 54, 76) : 92;

    levelCatalog.forEach((entry, index) => {
      const progress = this.progress.levels[entry.id];
      const unlocked = Boolean(progress?.unlocked);
      const completed = Boolean(progress?.completed);
      const x = startX + (index % columns) * (cellWidth + gap);
      const y = startY + Math.floor(index / 2) * cellHeight;
      const backgroundColor = unlocked ? 0x29313a : 0x171d23;
      const borderColor = completed ? 0x62c997 : unlocked ? 0xf0d078 : 0x59626d;
      const panel = this.add
        .rectangle(x, y, compact ? cellWidth : cellWidth - 18, cellHeight - (compact ? 8 : 16), backgroundColor)
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
        fontSize: compact ? '13px' : '18px',
        wordWrap: { width: cellWidth - 24 },
      });
      if (!compact) {
        this.add.text(x + 14, y + 40, unlocked ? entry.lesson : 'Locked', {
          ...TEXT_STYLE,
          color: '#b8c0ca',
          fontSize: '14px',
        });
      }

      this.add.text(x + 14, y + (compact ? cellHeight - 30 : 62), statusText(unlocked, completed, progress?.bestTurns), {
        ...TEXT_STYLE,
        color: completed ? '#62c997' : '#8f9aa6',
        fontSize: compact ? '12px' : '14px',
      });
    });

    makeTextButton(this, margin, this.scale.height - (compact ? 46 : 58), 'Reset Progress', () => {
      if (!window.confirm('Reset all Sigilbreaker progress?')) {
        return;
      }

      this.progress = resetProgress(getBrowserStorage(), levelIds());
      saveProgress(getBrowserStorage(), this.progress);
      this.render();
    }, compact ? 134 : 150);
  }
}

function levelIds(): string[] {
  return levelCatalog.map((entry) => entry.id);
}

function getBrowserStorage(): StorageLike | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}

function statusText(unlocked: boolean, completed: boolean, bestTurns: number | undefined): string {
  if (!unlocked) {
    return 'Locked';
  }

  if (completed) {
    return bestTurns === undefined ? 'Done' : `Best ${bestTurns}`;
  }

  return 'Open';
}
