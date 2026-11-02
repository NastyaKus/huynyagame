import Phaser from 'phaser';
import { C, CSS } from '../config';
import { Settings } from '../systems/Settings';
import { Audio2 } from '../systems/Audio';
import { Overlay } from '../systems/Overlay';
import { bus } from '../systems/events';
import { Button, dim, drawPanel, txt } from '../ui/widgets';

export class SettingsScene extends Phaser.Scene {
  private layer!: Phaser.GameObjects.Container;

  constructor() {
    super('Settings');
  }

  create() {
    dim(this, 0.6);
    this.layer = this.add.container(0, 0);
    Overlay.push('Settings', () => this.close());
    this.events.once('shutdown', () => Overlay.remove('Settings'));
    this.render();
  }

  private close() {
    Audio2.sfx('cancel');
    Settings.save();
    bus.emit('settings-changed');
    this.scene.stop();
  }

  private render() {
    this.layer.removeAll(true);
    const W = this.scale.width;
    const H = this.scale.height;
    const w = Math.min(780, W - 100);
    const x = W / 2 - w / 2;
    const g = this.add.graphics({ x, y: 40 });
    drawPanel(g, w, H - 80, { radius: 26 });
    this.layer.add(g);
    this.layer.add(txt(this, x + 32, 62, 'Настройки', 28, CSS.pink, { fontStyle: '800' }));
    this.layer.add(new Button(this, x + w - 50, 82, 60, 54, '✕', () => this.close(), { size: 24 }));

    const s = Settings.data;
    const rows: { label: string; value: string; dec: () => void; inc: () => void }[] = [
      { label: 'Музыка', value: `${Math.round(s.music * 100)}%`, dec: () => (s.music = clamp(s.music - 0.1)), inc: () => (s.music = clamp(s.music + 0.1)) },
      { label: 'Звуки', value: `${Math.round(s.sfx * 100)}%`, dec: () => (s.sfx = clamp(s.sfx - 0.1)), inc: () => (s.sfx = clamp(s.sfx + 0.1)) },
      {
        label: 'Скорость текста',
        value: ['медленно', 'нормально', 'быстро', 'сразу'][s.textSpeed],
        dec: () => (s.textSpeed = Math.max(0, s.textSpeed - 1)),
        inc: () => (s.textSpeed = Math.min(3, s.textSpeed + 1)),
      },
      {
        label: 'Размер кнопок',
        value: `${Math.round(s.touchScale * 100)}%`,
        dec: () => (s.touchScale = Math.max(0.7, +(s.touchScale - 0.1).toFixed(1))),
        inc: () => (s.touchScale = Math.min(1.4, +(s.touchScale + 0.1).toFixed(1))),
      },
      {
        label: 'Прозрачность кнопок',
        value: `${Math.round(s.touchAlpha * 100)}%`,
        dec: () => (s.touchAlpha = Math.max(0.3, +(s.touchAlpha - 0.1).toFixed(1))),
        inc: () => (s.touchAlpha = Math.min(1, +(s.touchAlpha + 0.1).toFixed(1))),
      },
      { label: 'Тач-управление', value: s.showTouch ? 'вкл' : 'выкл', dec: () => (s.showTouch = !s.showTouch), inc: () => (s.showTouch = !s.showTouch) },
    ];
    const rowH = Math.min(84, (H - 220) / rows.length);
    rows.forEach((r, i) => {
      const y = 150 + i * rowH;
      const bg = this.add.graphics();
      bg.fillStyle(C.plum, 0.5);
      bg.fillRoundedRect(x + 30, y - rowH / 2 + 6, w - 60, rowH - 12, 14);
      this.layer.add(bg);
      this.layer.add(txt(this, x + 54, y, r.label, 21, CSS.text).setOrigin(0, 0.5));
      this.layer.add(new Button(this, x + w - 270, y, 54, 48, '‹', () => this.change(r.dec), { size: 28 }));
      this.layer.add(txt(this, x + w - 165, y, r.value, 20, CSS.pink).setOrigin(0.5));
      this.layer.add(new Button(this, x + w - 62, y, 54, 48, '›', () => this.change(r.inc), { size: 28 }));
    });
  }

  private change(fn: () => void) {
    fn();
    Audio2.applyVolume();
    this.render();
  }
}

const clamp = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 10) / 10;
