import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { CreditsScene } from './scenes/CreditsScene';
import { LevelScene } from './scenes/LevelScene';
import { LevelSelectScene } from './scenes/LevelSelectScene';
import { TitleScene } from './scenes/TitleScene';
import { initializeCacheBuster } from './systems/cacheBuster';
import './style.css';

initializeCacheBuster();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#101418',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  scene: [BootScene, TitleScene, LevelSelectScene, CreditsScene, LevelScene],
};

new Phaser.Game(config);
