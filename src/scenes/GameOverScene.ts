import Phaser from 'phaser';
import { C, CSS } from '../config';
import { Saves } from '../systems/SaveSystem';
import { State } from '../systems/GameState';
import { Audio2 } from '../systems/Audio';
import { Overlay } from '../systems/Overlay';
import { Button, txt } from '../ui/widgets';

/** Поражение: мелодия оборвалась. Загрузить автосейв или выйти в меню. */
export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    Audio2.play(null);
    this.add.rectangle(0, 0, W, H, C.shadow, 0.92).setOrigin(0).setInteractive();
    const t = txt(this, W / 2, H / 2 - 90, 'Мелодия оборвалась…', 48, CSS.pink, { fontStyle: '800' }).setOrigin(0.5).setAlpha(0);
    const s = txt(this, W / 2, H / 2 - 30, 'Шумы оказались громче. Но ночь ещё не кончилась.', 22, CSS.dim).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: [t, s], alpha: 1, duration: 900 });
    const load = new Button(this, W / 2, H / 2 + 60, 360, 60, 'Загрузить последнее сохранение', () => this.reload(), { size: 21 });
    const menu = new Button(this, W / 2, H / 2 + 136, 360, 60, 'В главное меню', () => this.toMenu(), { size: 21 });
    [load, menu].forEach((b, i) => {
      b.setAlpha(0);
      this.tweens.add({ targets: b, alpha: 1, duration: 500, delay: 700 + i * 120 });
    });
    Overlay.push('GameOver', () => this.toMenu());
    this.events.once('shutdown', () => Overlay.remove('GameOver'));
  }

  private stopAll() {
    for (const k of ['Battle', 'Dialogue', 'GameMenu', 'Shop', 'SaveLoad', 'Hud']) this.scene.stop(k);
  }

  private async reload() {
    const l = await Saves.latest();
    this.stopAll();
    if (l?.data) {
      State.load(l.data);
      this.scene.stop();
      this.scene.stop('World');
      this.scene.start('World', { fromSave: true });
    } else this.toMenu();
  }

  private toMenu() {
    this.stopAll();
    this.scene.stop('World');
    this.scene.start('Menu');
  }
}
