import Phaser from 'phaser';
import { C, CSS } from '../config';
import { Audio2 } from '../systems/Audio';
import { Overlay } from '../systems/Overlay';
import { Quests } from '../systems/QuestSystem';
import { bus } from '../systems/events';
import { txt, Button } from '../ui/widgets';

/** Финал главы: титры поверх ночного города. */
export class EndingScene extends Phaser.Scene {
  private onClose?: () => void;

  constructor() {
    super('Ending');
  }

  init(d: { onClose?: () => void }) {
    this.onClose = d.onClose;
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    Audio2.play('tape6');
    const bg = this.add.image(W / 2, H / 2, 'bgb_club');
    bg.setScale(Math.max(W / bg.width, H / bg.height)).setAlpha(0);
    const shade = this.add.rectangle(0, 0, W, H, C.night, 0.55).setOrigin(0).setInteractive().setAlpha(0);
    this.tweens.add({ targets: [bg, shade], alpha: 1, duration: 1200 });
    this.add.particles(0, -10, 'petal', { x: { min: 0, max: W }, lifespan: 9000, speedY: { min: 30, max: 60 }, speedX: { min: -20, max: 10 }, rotate: { min: 0, max: 360 }, scale: { min: 0.8, max: 1.6 }, alpha: { start: 0.9, end: 0 }, frequency: 200 });

    const lines = [
      ['Глава 1', 28, CSS.dim],
      ['Ночные кассеты', 64, CSS.text],
      ['', 20, CSS.text],
      ['Шесть песен вернулись к своей хозяйке.', 24, CSS.pink],
      ['Город за окном всё так же гудит, но теперь — в тональности ля.', 22, CSS.text],
      ['', 20, CSS.text],
      ['Хана · Рэн · Мию · Юмэ', 24, CSS.gold],
      ['', 20, CSS.text],
      ['музыка: Holizna · Zane Little · omfgdude · MintoDog · Juhani Junkala · Tarush Singhal · cynicmusic', 16, CSS.dim],
      ['звуки: Kenney · всё CC0, спасибо им ♡', 16, CSS.dim],
      ['', 10, CSS.text],
      ['Продолжение следует…', 22, CSS.dim],
    ] as const;
    let y = H / 2 - 250;
    lines.forEach(([t, s, c], i) => {
      const o = txt(this, W / 2, y, t, s, c, { fontStyle: s > 40 ? '800' : '700' }).setOrigin(0.5).setAlpha(0);
      if (s > 40) o.setShadow(0, 0, CSS.hotpink, 20, true, true);
      this.tweens.add({ targets: o, alpha: 1, duration: 900, delay: 800 + i * 500 });
      y += s + 18;
    });
    const b = new Button(this, W / 2, H - 70, 300, 58, 'Продолжить прогулку', () => this.close(), { size: 21 });
    b.setAlpha(0);
    this.tweens.add({ targets: b, alpha: 1, duration: 600, delay: 800 + lines.length * 500 });
    Overlay.push('Ending', () => this.close());
    this.events.once('shutdown', () => Overlay.remove('Ending'));
  }

  private close() {
    Quests.complete('main');
    bus.emit('music-changed');
    this.scene.stop();
    this.onClose?.();
  }
}
