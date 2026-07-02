import Phaser from 'phaser';

const BUTTON_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  color: '#101418',
  fontFamily: 'Inter, Arial, sans-serif',
  fontSize: '16px',
};

export function makeTextButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  width = 70,
): Phaser.GameObjects.Container {
  const background = scene.add
    .rectangle(0, 0, width, 34, 0xf0d078)
    .setOrigin(0)
    .setStrokeStyle(1, 0x101418, 0.6);
  const text = scene.add
    .text(width / 2, 17, label, BUTTON_STYLE)
    .setOrigin(0.5)
    .setAlign('center');
  const container = scene.add.container(x, y, [background, text]);

  background.setInteractive({ useHandCursor: true });
  background.on('pointerdown', onClick);
  background.on('pointerover', () => background.setFillStyle(0xf4efe7));
  background.on('pointerout', () => background.setFillStyle(0xf0d078));

  return container;
}
