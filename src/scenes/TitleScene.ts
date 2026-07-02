import Phaser from 'phaser';
import { levelCatalog } from '../content/levelCatalog';
import { getContinueLevelIndex, loadProgress, type StorageLike } from '../systems/progress';
import { makeTextButton } from '../ui/textButton';

const TITLE_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  color: '#f4efe7',
  fontFamily: 'Inter, Arial, sans-serif',
  fontSize: '48px',
};

const BODY_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  color: '#b8c0ca',
  fontFamily: 'Inter, Arial, sans-serif',
  fontSize: '16px',
};

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create(): void {
    this.scale.on('resize', this.render, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.render, this);
    });
    this.render();
  }

  private render(): void {
    this.children.removeAll(true);
    const compact = this.scale.width < 720;
    const titleY = compact ? 84 : 92;
    const buttonY = compact ? 204 : 210;

    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x101418).setOrigin(0);
    this.add.text(this.scale.width / 2, titleY, 'Sigilbreaker', {
      ...TITLE_STYLE,
      fontSize: compact ? '38px' : '48px',
    }).setOrigin(0.5);
    this.add
      .text(this.scale.width / 2, compact ? 132 : 142, 'Small deterministic dungeon puzzles', {
        ...BODY_STYLE,
        fontSize: compact ? '14px' : '16px',
      })
      .setOrigin(0.5);

    const centerX = this.scale.width / 2 - 90;
    makeTextButton(this, centerX, buttonY, 'Continue', () => {
      const progress = loadProgress(getBrowserStorage(), levelIds());
      this.scene.start('LevelScene', {
        levelIndex: getContinueLevelIndex(progress, levelIds()),
      });
    }, 180);
    makeTextButton(this, centerX, buttonY + 48, 'Level Select', () => {
      this.scene.start('LevelSelectScene');
    }, 180);
    makeTextButton(this, centerX, buttonY + 96, 'Credits', () => {
      this.scene.start('CreditsScene');
    }, 180);
  }
}

function levelIds(): string[] {
  return levelCatalog.map((entry) => entry.id);
}

function getBrowserStorage(): StorageLike | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}
