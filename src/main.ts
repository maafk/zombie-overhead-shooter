import Phaser from 'phaser';
import { PlayScene } from './scenes/PlayScene';
import { MenuScene } from './scenes/MenuScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#1d1d1d',
  parent: 'game',
  scene: [MenuScene, PlayScene],
  physics: { default: 'arcade' },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

new Phaser.Game(config);