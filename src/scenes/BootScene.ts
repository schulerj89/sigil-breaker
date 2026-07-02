import Phaser from 'phaser';
import { TILE_TEXTURE_KEYS, assetManifest } from '../assets/assetManifest';

const PLACEHOLDER_SIZE = 64;

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    void this.prepareAssets();
  }

  private async prepareAssets(): Promise<void> {
    const availableAssets = (
      await Promise.all(
        assetManifest.map(async (asset) => ({
          asset,
          exists: await assetExists(asset.path),
        })),
      )
    )
      .filter(({ exists }) => exists)
      .map(({ asset }) => asset);

    if (availableAssets.length === 0) {
      this.createMissingPlaceholders();
      this.scene.start('TitleScene');
      return;
    }

    for (const asset of availableAssets) {
      this.load.image(asset.key, asset.path);
    }

    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.createMissingPlaceholders();
      this.scene.start('TitleScene');
    });
    this.load.start();
  }

  private createMissingPlaceholders(): void {
    for (const asset of assetManifest) {
      if (this.textures.exists(asset.key)) {
        continue;
      }

      if (asset.key === TILE_TEXTURE_KEYS.golem) {
        this.createGolemPlaceholder();
        continue;
      }

      const graphics = this.make.graphics({ x: 0, y: 0 }, false);
      graphics.fillStyle(asset.placeholderColor, 1);
      graphics.fillRect(0, 0, PLACEHOLDER_SIZE, PLACEHOLDER_SIZE);
      graphics.lineStyle(4, 0x101418, 0.7);
      graphics.strokeRect(2, 2, PLACEHOLDER_SIZE - 4, PLACEHOLDER_SIZE - 4);
      graphics.generateTexture(asset.key, PLACEHOLDER_SIZE, PLACEHOLDER_SIZE);
      graphics.destroy();
    }
  }

  private createGolemPlaceholder(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);

    graphics.fillStyle(0x2d3439, 1);
    graphics.fillRoundedRect(14, 28, 36, 28, 5);
    graphics.fillStyle(0x6f7782, 1);
    graphics.fillRoundedRect(18, 12, 28, 22, 5);
    graphics.fillRoundedRect(10, 30, 12, 20, 4);
    graphics.fillRoundedRect(42, 30, 12, 20, 4);
    graphics.fillRoundedRect(18, 50, 10, 8, 3);
    graphics.fillRoundedRect(36, 50, 10, 8, 3);

    graphics.lineStyle(3, 0x171d23, 0.85);
    graphics.strokeRoundedRect(18, 12, 28, 22, 5);
    graphics.strokeRoundedRect(14, 28, 36, 28, 5);

    graphics.lineStyle(2, 0x3d464e, 0.9);
    graphics.lineBetween(25, 15, 32, 21);
    graphics.lineBetween(38, 35, 30, 42);
    graphics.lineBetween(22, 44, 27, 50);

    graphics.fillStyle(0xd8ccff, 1);
    graphics.fillCircle(27, 24, 2.5);
    graphics.fillCircle(37, 24, 2.5);

    graphics.generateTexture(TILE_TEXTURE_KEYS.golem, PLACEHOLDER_SIZE, PLACEHOLDER_SIZE);
    graphics.destroy();
  }
}

async function assetExists(path: string): Promise<boolean> {
  try {
    const response = await fetch(path, { method: 'HEAD' });
    return response.ok && response.headers.get('content-type')?.startsWith('image/') === true;
  } catch {
    return false;
  }
}
