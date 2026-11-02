import Phaser from 'phaser';
import { C, CSS } from '../config';
import { SHOPS } from '../data/shops';
import { ITEMS } from '../data/items';
import { State } from '../systems/GameState';
import { Audio2 } from '../systems/Audio';
import { Overlay } from '../systems/Overlay';
import { giveItem } from '../systems/Effects';
import { Button, ListView, dim, drawPanel, itemIcon, rowBg, txt } from '../ui/widgets';

export class ShopScene extends Phaser.Scene {
  private shopId = 'konbini';
  private onClose!: () => void;
  private selected: string | null = null;
  private layer!: Phaser.GameObjects.Container;
  private qty = 1;

  constructor() {
    super('Shop');
  }

  init(d: { id: string; onClose: () => void }) {
    this.shopId = d.id;
    this.onClose = d.onClose;
    this.selected = null;
    this.qty = 1;
  }

  create() {
    dim(this, 0.55);
    this.layer = this.add.container(0, 0);
    Overlay.push('Shop', () => this.close());
    this.events.once('shutdown', () => Overlay.remove('Shop'));
    this.render();
  }

  private close() {
    Audio2.sfx('cancel');
    this.scene.stop();
    this.onClose();
  }

  private render() {
    this.layer.removeAll(true);
    const W = this.scale.width;
    const H = this.scale.height;
    const shop = SHOPS[this.shopId];
    const x = 60;
    const w = W - 120;
    const g = this.add.graphics({ x, y: 30 });
    drawPanel(g, w, H - 60, { radius: 26 });
    this.layer.add(g);
    this.layer.add(txt(this, x + 32, 52, shop.name, 28, CSS.pink, { fontStyle: '800' }));
    this.layer.add(txt(this, x + 32, 92, shop.greeting, 18, CSS.dim, { fontStyle: 'italic 600' }));
    this.layer.add(txt(this, x + w - 110, 56, `¥ ${State.data.money.toLocaleString('ru-RU')}`, 26, CSS.gold, { fontStyle: '800' }).setOrigin(1, 0));
    this.layer.add(new Button(this, x + w - 46, 70, 60, 54, '✕', () => this.close(), { size: 24 }));

    if (!this.selected) this.selected = shop.items[0];
    const listW = Math.min(560, w * 0.55);
    const list = new ListView(this, x + 24, 136, listW, H - 196, 66);
    list.setRows(
      shop.items.map((id) => {
        const d = ITEMS[id];
        return {
          render: (c, rw, h) => {
            c.add(rowBg(this, rw, h, id === this.selected));
            c.add(itemIcon(this, 32, h / 2, d.icon, 40));
            c.add(txt(this, 64, h / 2, d.name, 20, CSS.text).setOrigin(0, 0.5));
            c.add(txt(this, rw - 16, h / 2, `¥${d.price}`, 19, State.data.money >= (d.price ?? 0) ? CSS.gold : CSS.red).setOrigin(1, 0.5));
          },
          onTap: () => {
            this.selected = id;
            this.qty = 1;
            this.render();
          },
        };
      }),
    );
    this.layer.add(list);

    const d = ITEMS[this.selected];
    const dx = x + listW + 50;
    const dw = w - listW - 74;
    const pg = this.add.graphics({ x: dx, y: 136 });
    drawPanel(pg, dw, H - 196, { fill: C.plum, alpha: 0.6, radius: 18, shadow: false });
    this.layer.add(pg);
    this.layer.add(itemIcon(this, dx + dw / 2, 196, d.icon, 72));
    this.layer.add(txt(this, dx + dw / 2, 246, d.name, 22, CSS.pink, { fontStyle: '800', align: 'center', wordWrap: { width: dw - 30 } }).setOrigin(0.5, 0));
    this.layer.add(txt(this, dx + 20, 290, d.desc, 18, CSS.text, { wordWrap: { width: dw - 40 }, lineSpacing: 5, fontStyle: '600' }));
    this.layer.add(txt(this, dx + 20, H - 196, `В сумке: ${State.count(d.id)}`, 17, CSS.dim));

    const price = (d.price ?? 0) * this.qty;
    const can = State.data.money >= price;
    const qy = H - 150;
    const unique = d.kind === 'equip' || d.kind === 'key';
    if (!unique) {
      this.layer.add(new Button(this, dx + 40, qy, 54, 48, '−', () => this.setQty(this.qty - 1), { size: 26 }));
      this.layer.add(txt(this, dx + dw / 2 - 40, qy, `×${this.qty}`, 24, CSS.text).setOrigin(0.5));
      this.layer.add(new Button(this, dx + dw / 2 + 20 - 40 + 60, qy, 54, 48, '+', () => this.setQty(this.qty + 1), { size: 26 }));
    }
    this.layer.add(
      new Button(this, dx + dw - 110, qy, 180, 54, `Купить ¥${price}`, () => this.buy(), { size: 19 }).setEnabled(can),
    );
  }

  private setQty(n: number) {
    this.qty = Phaser.Math.Clamp(n, 1, 9);
    this.render();
  }

  private buy() {
    const d = ITEMS[this.selected!];
    const price = (d.price ?? 0) * this.qty;
    if (State.data.money < price) {
      Audio2.sfx('locked');
      return;
    }
    State.data.money -= price;
    giveItem(d.id, this.qty, true);
    Audio2.sfx('pickup');
    this.qty = 1;
    this.render();
  }
}
