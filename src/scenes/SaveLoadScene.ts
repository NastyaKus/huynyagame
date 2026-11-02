import Phaser from 'phaser';
import { CSS } from '../config';
import { MAPS } from '../data/maps';
import type { SaveData } from '../data/types';
import { Saves, SLOTS, type Slot, type SlotInfo } from '../systems/SaveSystem';
import { State } from '../systems/GameState';
import { Audio2 } from '../systems/Audio';
import { Overlay } from '../systems/Overlay';
import { bus } from '../systems/events';
import { Button, dim, drawPanel, txt } from '../ui/widgets';

interface Data {
  mode: 'save' | 'load';
  onClose?: () => void;
  onLoad?: (d: SaveData) => void;
}

export class SaveLoadScene extends Phaser.Scene {
  private d!: Data;
  private layer!: Phaser.GameObjects.Container;

  constructor() {
    super('SaveLoad');
  }

  init(d: Data) {
    this.d = d;
  }

  create() {
    dim(this, 0.6);
    this.layer = this.add.container(0, 0);
    Overlay.push('SaveLoad', () => this.close());
    this.events.once('shutdown', () => Overlay.remove('SaveLoad'));
    this.refresh();
  }

  private close() {
    Audio2.sfx('cancel');
    this.scene.stop();
    this.d.onClose?.();
  }

  private async refresh() {
    const list = await Saves.list();
    if (!this.sys.isActive()) return;
    this.render(list);
  }

  private render(list: SlotInfo[]) {
    this.layer.removeAll(true);
    const W = this.scale.width;
    const H = this.scale.height;
    const w = Math.min(860, W - 100);
    const x = W / 2 - w / 2;
    const g = this.add.graphics({ x, y: 40 });
    drawPanel(g, w, H - 80, { radius: 26 });
    this.layer.add(g);
    this.layer.add(txt(this, x + 32, 62, this.d.mode === 'save' ? 'Сохранить игру' : 'Загрузить игру', 28, CSS.pink, { fontStyle: '800' }));
    this.layer.add(new Button(this, x + w - 50, 82, 60, 54, '✕', () => this.close(), { size: 24 }));

    const slots = this.d.mode === 'save' ? SLOTS.filter((s) => s !== 'auto') : SLOTS;
    const rowH = Math.min(120, (H - 200) / slots.length);
    slots.forEach((slot, i) => {
      const info = list.find((l) => l.slot === slot)!;
      const y = 130 + i * rowH;
      const enabled = this.d.mode === 'save' || !!info.data;
      const b = new Button(this, W / 2, y + rowH / 2 - 6, w - 64, rowH - 16, '', () => this.pick(slot, info), { radius: 18 });
      b.setEnabled(enabled);
      this.layer.add(b);
      const lx = x + 56;
      const title = slot === 'auto' ? 'Автосохранение' : `Слот ${slot}`;
      this.layer.add(txt(this, lx, y + 14, title, 22, slot === 'auto' ? CSS.mint : CSS.pink, { fontStyle: '800' }));
      if (info.data) {
        const d = info.data;
        const mins = Math.floor(d.playTime / 60);
        const date = new Date(d.savedAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        const lv = d.party[0]?.level ?? 1;
        const cas = Object.keys(d.inv).filter((k) => k.startsWith('cassette_') && d.inv[k] > 0).length;
        this.layer.add(txt(this, lx, y + 46, `${MAPS[d.map]?.name ?? d.map}  ·  ур. ${lv}  ·  📼 ${cas}/6`, 18, CSS.text, { fontStyle: '600' }));
        this.layer.add(txt(this, x + w - 56, y + 16, `${date}\n⏱ ${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`, 16, CSS.dim, { align: 'right' }).setOrigin(1, 0));
      } else {
        this.layer.add(txt(this, lx, y + 46, 'пусто', 18, CSS.dim));
      }
    });
  }

  private async pick(slot: Slot, info: SlotInfo) {
    if (this.d.mode === 'save') {
      await Saves.save(slot, State.data);
      Audio2.sfx('confirm');
      bus.emit('toast', `Сохранено в слот ${slot}`, 'quest');
      this.refresh();
      this.cameras.main.flash(200, 247, 183, 210);
      return;
    }
    if (!info.data) return;
    Audio2.sfx('confirm');
    const data = info.data;
    this.scene.stop();
    this.d.onLoad?.(data);
  }
}

