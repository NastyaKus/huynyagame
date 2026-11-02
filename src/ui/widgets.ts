import Phaser from 'phaser';
import { C, CSS, FONT } from '../config';
import { Audio2 } from '../systems/Audio';

export function txt(scene: Phaser.Scene, x: number, y: number, s: string, size = 22, color: string = CSS.text, opts: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {}) {
  const t = scene.add.text(x, y, s, {
    fontFamily: FONT,
    fontSize: `${size}px`,
    color,
    fontStyle: opts.fontStyle ?? '700',
    ...opts,
  });
  t.setResolution(Math.min(2, window.devicePixelRatio || 1));
  return t;
}

export interface PanelOpts {
  fill?: number;
  alpha?: number;
  radius?: number;
  stroke?: number;
  strokeAlpha?: number;
  shadow?: boolean;
  lineWidth?: number;
}

/** Мягкая скруглённая панель (рисуется от 0,0 до w,h в локальных координатах). */
export function drawPanel(g: Phaser.GameObjects.Graphics, w: number, h: number, o: PanelOpts = {}) {
  const r = o.radius ?? 18;
  g.clear();
  if (o.shadow !== false) {
    g.fillStyle(C.shadow, 0.35);
    g.fillRoundedRect(4, 6, w, h, r);
  }
  g.fillStyle(o.fill ?? C.night2, o.alpha ?? 0.94);
  g.fillRoundedRect(0, 0, w, h, r);
  // мягкий блик сверху
  g.fillStyle(0xffffff, 0.04);
  g.fillRoundedRect(3, 3, w - 6, Math.min(h / 2, 40), { tl: r - 3, tr: r - 3, bl: 6, br: 6 });
  g.lineStyle(o.lineWidth ?? 2, o.stroke ?? C.pink, o.strokeAlpha ?? 0.55);
  g.strokeRoundedRect(0, 0, w, h, r);
}

export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, o: PanelOpts = {}) {
  const g = scene.add.graphics({ x, y });
  drawPanel(g, w, h, o);
  return g;
}

export interface ButtonOpts {
  size?: number;
  fill?: number;
  stroke?: number;
  color?: string;
  radius?: number;
  sfx?: boolean;
  align?: 'center' | 'left';
}

/** Кнопка: контейнер с центром в (x, y). */
export class Button extends Phaser.GameObjects.Container {
  bg: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  zone: Phaser.GameObjects.Zone;
  enabled = true;
  private o: ButtonOpts;
  selected = false;

  constructor(scene: Phaser.Scene, x: number, y: number, public w: number, public h: number, text: string, onClick: () => void, o: ButtonOpts = {}) {
    super(scene, x, y);
    this.o = o;
    this.bg = scene.add.graphics();
    const left = o.align === 'left';
    this.label = txt(scene, left ? -w / 2 + 18 : 0, 0, text, o.size ?? 24, o.color ?? CSS.text).setOrigin(left ? 0 : 0.5, 0.5);
    this.zone = scene.add.zone(0, 0, w, h).setInteractive({ useHandCursor: true });
    this.add([this.bg, this.label, this.zone]);
    this.redraw(false);
    this.zone.on('pointerdown', () => {
      if (!this.enabled) return;
      this.redraw(true);
      scene.tweens.add({ targets: this, scale: 0.96, duration: 60 });
    });
    const release = () => {
      this.redraw(false);
      scene.tweens.add({ targets: this, scale: 1, duration: 80 });
    };
    this.zone.on('pointerout', release);
    this.zone.on('pointerup', () => {
      release();
      if (!this.enabled) return;
      if (o.sfx !== false) Audio2.sfx('click');
      onClick();
    });
    scene.add.existing(this);
  }

  redraw(pressed: boolean) {
    const { w, h } = this;
    const r = this.o.radius ?? Math.min(18, h / 2);
    const g = this.bg;
    g.clear();
    g.fillStyle(C.shadow, 0.3);
    g.fillRoundedRect(-w / 2 + 2, -h / 2 + 4, w, h, r);
    const fill = !this.enabled ? 0x3a2f48 : pressed ? C.rose : this.selected ? C.violet : this.o.fill ?? C.plum;
    g.fillStyle(fill, 0.96);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
    g.fillStyle(0xffffff, pressed ? 0.02 : 0.07);
    g.fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h / 2 - 3, { tl: r - 3, tr: r - 3, bl: 4, br: 4 });
    g.lineStyle(2, this.selected ? C.hotpink : this.o.stroke ?? C.pink, this.enabled ? 0.7 : 0.25);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
    this.label.setAlpha(this.enabled ? 1 : 0.45);
  }

  setEnabled(v: boolean) {
    this.enabled = v;
    this.redraw(false);
    return this;
  }
  setSelected(v: boolean) {
    this.selected = v;
    this.redraw(false);
    return this;
  }
  setText(s: string) {
    this.label.setText(s);
    return this;
  }
}

export interface ListRow {
  /** нарисовать содержимое строки в контейнер (локальные координаты 0..w, 0..rowH) */
  render: (c: Phaser.GameObjects.Container, w: number, h: number) => void;
  onTap?: () => void;
}

/** Прокручиваемый список с маской: тап по строке и перетаскивание пальцем. */
export class ListView extends Phaser.GameObjects.Container {
  private content: Phaser.GameObjects.Container;
  private rows: ListRow[] = [];
  private scrollY = 0;
  private maxScroll = 0;
  private dragStart: { y: number; s: number; moved: boolean } | null = null;
  private maskG: Phaser.GameObjects.Graphics;
  private bar: Phaser.GameObjects.Graphics;
  selectedIndex = -1;

  constructor(scene: Phaser.Scene, x: number, y: number, public w: number, public h: number, public rowH = 64) {
    super(scene, x, y);
    this.content = scene.add.container(0, 0);
    this.maskG = scene.make.graphics({});
    this.maskG.fillStyle(0xffffff);
    this.updateMask();
    this.content.setMask(this.maskG.createGeometryMask());
    this.bar = scene.add.graphics();
    const zone = scene.add.zone(0, 0, w, h).setOrigin(0).setInteractive();
    this.add([this.content, this.bar, zone]);
    scene.add.existing(this);

    zone.on('pointerdown', (p: Phaser.Input.Pointer) => (this.dragStart = { y: p.y, s: this.scrollY, moved: false }));
    zone.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.dragStart || !p.isDown) return;
      const dy = p.y - this.dragStart.y;
      if (Math.abs(dy) > 8) this.dragStart.moved = true;
      if (this.dragStart.moved) this.setScroll(this.dragStart.s - dy);
    });
    zone.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.dragStart && !this.dragStart.moved) {
        const local = p.y - this.getWorldTransformMatrix().ty;
        const idx = Math.floor((local + this.scrollY) / this.rowH);
        const row = this.rows[idx];
        if (row?.onTap) {
          Audio2.sfx('click');
          row.onTap();
        }
      }
      this.dragStart = null;
    });
    zone.on('pointerout', () => (this.dragStart = null));
    zone.on('wheel', (_p: unknown, _dx: number, dy: number) => this.setScroll(this.scrollY + dy * 0.6));
    this.on('destroy', () => this.maskG.destroy());
  }

  private updateMask() {
    const m = this.getWorldTransformMatrix();
    this.maskG.clear();
    this.maskG.fillStyle(0xffffff);
    this.maskG.fillRect(m.tx, m.ty, this.w, this.h);
  }

  setRows(rows: ListRow[], keepScroll = false) {
    this.rows = rows;
    this.content.removeAll(true);
    rows.forEach((r, i) => {
      const c = this.scene.add.container(0, i * this.rowH);
      r.render(c, this.w - 10, this.rowH);
      this.content.add(c);
    });
    this.maxScroll = Math.max(0, rows.length * this.rowH - this.h);
    this.setScroll(keepScroll ? this.scrollY : 0);
    this.updateMask();
  }

  setScroll(v: number) {
    this.scrollY = Phaser.Math.Clamp(v, 0, this.maxScroll);
    this.content.y = -this.scrollY;
    this.bar.clear();
    if (this.maxScroll > 0) {
      const bh = Math.max(30, (this.h * this.h) / (this.h + this.maxScroll));
      const by = (this.scrollY / this.maxScroll) * (this.h - bh);
      this.bar.fillStyle(C.pink, 0.5);
      this.bar.fillRoundedRect(this.w - 5, by, 4, bh, 2);
    }
  }
}

/** Плашка-подсветка строки списка. */
export function rowBg(scene: Phaser.Scene, w: number, h: number, selected = false, fill: number = C.plum) {
  const g = scene.add.graphics();
  g.fillStyle(selected ? C.violet : fill, selected ? 0.95 : 0.55);
  g.fillRoundedRect(0, 4, w, h - 8, 12);
  if (selected) {
    g.lineStyle(2, C.hotpink, 0.8);
    g.strokeRoundedRect(0, 4, w, h - 8, 12);
  }
  return g;
}

/** Полоска HP/SP. */
export function bar(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, frac: number, color: number, back: number = 0x1a1226) {
  g.fillStyle(back, 0.9);
  g.fillRoundedRect(x, y, w, h, h / 2);
  const fw = Math.max(0, Math.min(1, frac)) * w;
  if (fw > 1) {
    g.fillStyle(color, 1);
    g.fillRoundedRect(x, y, Math.max(h, fw), h, h / 2);
    g.fillStyle(0xffffff, 0.25);
    g.fillRoundedRect(x + 2, y + 1, Math.max(h, fw) - 4, h / 3, h / 6);
  }
}

/** Иконка предмета (текстура icon_<name>) вписанная в size. */
export function itemIcon(scene: Phaser.Scene, x: number, y: number, icon: string, size = 40) {
  const key = scene.textures.exists(`icon_${icon}`) ? `icon_${icon}` : 'icon_memo';
  const img = scene.add.image(x, y, key);
  const s = size / Math.max(img.width, img.height);
  img.setScale(s);
  return img;
}

/** Затемнение фона для оверлеев. */
export function dim(scene: Phaser.Scene, alpha = 0.55) {
  const { width, height } = scene.scale;
  return scene.add.rectangle(0, 0, width, height, C.shadow, alpha).setOrigin(0).setInteractive();
}

/** Портрет с мягкой рамкой. Возвращает контейнер с центром снизу. */
export function portraitCard(scene: Phaser.Scene, x: number, y: number, key: string, maxW: number, maxH: number) {
  const c = scene.add.container(x, y);
  if (!scene.textures.exists(key)) return c;
  const img = scene.add.image(0, 0, key).setOrigin(0.5, 1);
  const s = Math.min(maxW / img.width, maxH / img.height);
  img.setScale(s);
  const w = img.width * s;
  const h = img.height * s;
  const g = scene.add.graphics();
  g.fillStyle(C.shadow, 0.35);
  g.fillRoundedRect(-w / 2 + 4, -h + 6, w, h, 16);
  const mask = scene.make.graphics({});
  c.add([g, img]);
  const frame = scene.add.graphics();
  frame.lineStyle(3, C.pink, 0.8);
  frame.strokeRoundedRect(-w / 2, -h, w, h, 16);
  c.add(frame);
  const updateMask = () => {
    const m = c.getWorldTransformMatrix();
    mask.clear();
    mask.fillStyle(0xffffff);
    mask.fillRoundedRect(m.tx - (w / 2) * m.scaleX, m.ty - h * m.scaleY, w * m.scaleX, h * m.scaleY, 16);
  };
  updateMask();
  img.setMask(mask.createGeometryMask());
  (c as any).updateMask = updateMask;
  c.on('destroy', () => mask.destroy());
  return c;
}
