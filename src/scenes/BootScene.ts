import Phaser from 'phaser';
import { assetManifest } from '../assets/assetManifest';

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
      this.scene.start('LevelScene');
      return;
    }

    for (const asset of availableAssets) {
      this.load.image(asset.key, asset.path);
    }

    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.createMissingPlaceholders();
      this.scene.start('LevelScene');
    });
    this.load.start();
  }

  private createMissingPlaceholders(): void {
    for (const asset of assetManifest) {
      if (this.textures.exists(asset.key)) {
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
}

async function assetExists(path: string): Promise<boolean> {
  try {
    const response = await fetch(path, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}
