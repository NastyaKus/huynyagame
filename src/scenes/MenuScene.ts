import Phaser from 'phaser';
import { C, CSS } from '../config';
import { Button, txt, portraitCard } from '../ui/widgets';
import { Saves } from '../systems/SaveSystem';
import { State } from '../systems/GameState';
import { Audio2 } from '../systems/Audio';
import { bus } from '../systems/events';
import { Overlay } from '../systems/Overlay';
import type { SaveData } from '../data/types';

export class MenuScene extends Phaser.Scene {
  private offBack?: () => void;

  constructor() {
    super('Menu');
  }

  create() {
    const { width: W, height: H } = this.scale;
    this.cameras.main.fadeIn(600, 29, 20, 40);

    // фон: размытая крыша на закате + параллакс-город
    const bg = this.add.image(W / 2, H / 2, 'bgb_rooftop');
    bg.setScale(Math.max(W / bg.width, H / bg.height));
    this.add.rectangle(0, 0, W, H, C.night, 0.35).setOrigin(0);
    const far = this.add.tileSprite(0, H - 300, W, 300, 'city_far').setOrigin(0).setAlpha(0.85);
    const near = this.add.tileSprite(0, H - 260, W, 260, 'city_near').setOrigin(0);
    this.events.on('update', (_t: number, dt: number) => {
      far.tilePositionX += dt * 0.006;
      near.tilePositionX += dt * 0.014;
    });
    // лепестки
    this.add.particles(0, -10, 'petal', {
      x: { min: 0, max: W },
      lifespan: 9000,
      speedY: { min: 30, max: 60 },
      speedX: { min: -30, max: 10 },
      rotate: { min: 0, max: 360 },
      scale: { min: 0.8, max: 1.6 },
      alpha: { start: 0.9, end: 0 },
      frequency: 350,
    });

    // героиня
    if (this.textures.exists('portrait_hana_smile')) {
      const card = portraitCard(this, W - 250, H - 60, 'portrait_hana_neutral', 300, 420);
      card.setAlpha(0);
      this.tweens.add({ targets: card, alpha: 1, duration: 900, delay: 300 });
    }

    // заголовок
    const title = txt(this, 90, 110, 'Ночные кассеты', 76, CSS.text, { fontStyle: '800' });
    title.setShadow(0, 0, '#ff8fc0', 18, true, true);
    txt(this, 96, 200, 'night cassettes · глава 1', 24, CSS.pink, { fontStyle: '700' });

    const btns: Button[] = [];
    const mk = (label: string, y: number, fn: () => void) => {
      const b = new Button(this, 250, y, 320, 62, label, fn, { size: 26 });
      btns.push(b);
      return b;
    };
    const cont = mk('Продолжить', 300, () => this.continueGame());
    cont.setEnabled(false);
    mk('Новая игра', 378, () => this.newGame());
    const load = mk('Загрузить', 456, () => this.openLoad());
    load.setEnabled(false);
    mk('Настройки', 534, () => {
      this.scene.launch('Settings');
      this.scene.bringToTop('Settings');
    });
    btns.forEach((b, i) => {
      b.setAlpha(0);
      b.x -= 30;
      this.tweens.add({ targets: b, alpha: 1, x: b.x + 30, duration: 400, delay: 200 + i * 80, ease: 'Sine.Out' });
    });

    Saves.latest().then((l) => {
      cont.setEnabled(!!l);
      load.setEnabled(!!l);
    });

    txt(this, 24, H - 36, 'v0.1 · сделано с любовью к ночным прогулкам', 16, CSS.dim, { fontStyle: '400' });

    // звук запускается с первого касания
    const unlock = () => {
      Audio2.unlock();
      Audio2.play('menu');
    };
    this.input.once('pointerdown', unlock);
    this.input.keyboard?.once('keydown', unlock);
    Audio2.play('menu');

    this.offBack = bus.on('back-base', () => bus.emit('exit-app'));
    this.events.once('shutdown', () => this.offBack?.());
  }

  private start(data: SaveData | null) {
    Audio2.unlock();
    if (data) State.load(data);
    else State.reset();
    Overlay.remove('Settings');
    this.cameras.main.fadeOut(500, 29, 20, 40);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.stop('Settings');
      this.scene.stop('SaveLoad');
      this.scene.start('World', { fromSave: !!data });
    });
  }

  private async continueGame() {
    const l = await Saves.latest();
    if (l?.data) this.start(l.data);
  }

  private async newGame() {
    const l = await Saves.latest();
    if (l && !(await this.confirm('Начать заново? Сохранения останутся в слотах, но автосейв перезапишется.'))) return;
    this.start(null);
  }

  private openLoad() {
    this.scene.launch('SaveLoad', {
      mode: 'load',
      onLoad: (d: SaveData) => this.start(d),
    });
    this.scene.bringToTop('SaveLoad');
  }

  private confirm(text: string): Promise<boolean> {
    return new Promise((resolve) => {
      const { width: W, height: H } = this.scale;
      const layer = this.add.container(0, 0).setDepth(100);
      const shade = this.add.rectangle(0, 0, W, H, C.shadow, 0.6).setOrigin(0).setInteractive();
      const g = this.add.graphics();
      g.fillStyle(C.night2, 0.97);
      g.fillRoundedRect(W / 2 - 300, H / 2 - 120, 600, 240, 22);
      g.lineStyle(2, C.pink, 0.7);
      g.strokeRoundedRect(W / 2 - 300, H / 2 - 120, 600, 240, 22);
      const t = txt(this, W / 2, H / 2 - 50, text, 22, CSS.text, { wordWrap: { width: 520 }, align: 'center' }).setOrigin(0.5);
      const done = (v: boolean) => {
        layer.destroy();
        Overlay.remove('confirm');
        resolve(v);
      };
      const yes = new Button(this, W / 2 - 120, H / 2 + 60, 200, 56, 'Да', () => done(true));
      const no = new Button(this, W / 2 + 120, H / 2 + 60, 200, 56, 'Нет', () => done(false));
      layer.add([shade, g, t, yes, no]);
      Overlay.push('confirm', () => done(false));
    });
  }
}
