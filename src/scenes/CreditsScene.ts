import Phaser from 'phaser';
import { makeTextButton } from '../ui/textButton';

const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  color: '#f4efe7',
  fontFamily: 'Inter, Arial, sans-serif',
  fontSize: '18px',
};

export class CreditsScene extends Phaser.Scene {
  constructor() {
    super('CreditsScene');
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
    const margin = compact ? 16 : 24;

    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x101418).setOrigin(0);
    this.add.text(margin, compact ? 18 : 24, 'Credits', {
      ...TEXT_STYLE,
      fontSize: compact ? '24px' : '30px',
    });
    this.add.text(
      margin,
      compact ? 74 : 92,
      [
        'Sigilbreaker prototype by Josh Schuler.',
        '',
        'Visual style is prepared for the Kenney Sokoban asset pack.',
        'Kenney assets are CC0 and should be placed manually under:',
        'public/assets/kenney/sokoban/',
        '',
        'If those files are absent, Sigilbreaker uses built-in placeholder graphics.',
      ],
      {
        ...TEXT_STYLE,
        color: '#b8c0ca',
        fontSize: compact ? '14px' : '18px',
        lineSpacing: compact ? 7 : 10,
        wordWrap: { width: this.scale.width - margin * 2 },
      },
    );

    makeTextButton(this, margin, this.scale.height - (compact ? 46 : 58), 'Back', () => {
      this.scene.start('TitleScene');
    }, compact ? 64 : 70);
  }
}
