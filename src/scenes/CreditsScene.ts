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
    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x101418).setOrigin(0);
    this.add.text(24, 24, 'Credits', {
      ...TEXT_STYLE,
      fontSize: '30px',
    });
    this.add.text(
      24,
      92,
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
        lineSpacing: 10,
      },
    );

    makeTextButton(this, 24, this.scale.height - 58, 'Back', () => {
      this.scene.start('TitleScene');
    });
  }
}
