import Phaser from 'phaser';
import '@fontsource/nunito/cyrillic-400.css';
import '@fontsource/nunito/cyrillic-700.css';
import '@fontsource/nunito/cyrillic-800.css';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import { BASE_H, BASE_W } from './config';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MenuScene } from './scenes/MenuScene';
import { WorldScene } from './scenes/WorldScene';
import { HudScene } from './scenes/HudScene';
import { DialogueScene } from './scenes/DialogueScene';
import { GameMenuScene } from './scenes/GameMenuScene';
import { ShopScene } from './scenes/ShopScene';
import { SaveLoadScene } from './scenes/SaveLoadScene';
import { SettingsScene } from './scenes/SettingsScene';
import { BattleScene } from './scenes/BattleScene';
import { GameOverScene } from './scenes/GameOverScene';
import { EndingScene } from './scenes/EndingScene';
import { initNative } from './systems/Native';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1d1428',
  scale: {
    mode: Phaser.Scale.EXPAND,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: BASE_W,
    height: BASE_H,
  },
  input: { activePointers: 4 },
  physics: { default: 'arcade', arcade: { debug: false } },
  render: { antialias: true, roundPixels: false },
  fps: { target: 60 },
  scene: [BootScene, PreloadScene, MenuScene, WorldScene, HudScene, DialogueScene, GameMenuScene, ShopScene, SaveLoadScene, SettingsScene, BattleScene, GameOverScene, EndingScene],
});

initNative(game);
(window as any).__game = game;
