import Phaser from 'phaser';
import { Settings } from '../systems/Settings';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  async create() {
    await Settings.load();
    try {
      await Promise.all([document.fonts.load('700 22px Nunito'), document.fonts.load('800 22px Nunito'), document.fonts.load('400 22px Nunito')]);
    } catch {
      /* шрифт подгрузится позже */
    }
    document.getElementById('boot')?.remove();
    this.scene.start('Preload');
  }
}
