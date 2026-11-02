import Phaser from 'phaser';
import { C, CSS } from '../config';
import { Controls } from '../systems/Controls';
import { Settings } from '../systems/Settings';
import { Quests } from '../systems/QuestSystem';
import { State } from '../systems/GameState';
import { bus } from '../systems/events';
import { Audio2 } from '../systems/Audio';
import { MEMBERS } from '../data/party';
import { SKILLS } from '../data/skills';
import { txt } from '../ui/widgets';
import type { QuestUpdate } from '../systems/QuestSystem';

/** HUD поверх мира: джойстик, кнопки, название локации, цель квеста, всплывашки. */
export class HudScene extends Phaser.Scene {
  private controls!: Phaser.GameObjects.Container;
  private base!: Phaser.GameObjects.Graphics;
  private knob!: Phaser.GameObjects.Graphics;
  private stickPointer: number | null = null;
  private stickHome = { x: 0, y: 0 };
  private stickOrigin = { x: 0, y: 0 };
  private runPointer: number | null = null;
  private aBtn!: Phaser.GameObjects.Container;
  private runBtn!: Phaser.GameObjects.Container;
  private tracker!: Phaser.GameObjects.Container;
  private trackerText!: Phaser.GameObjects.Text;
  private trackerBg!: Phaser.GameObjects.Graphics;
  private toastY = 0;
  private offs: (() => void)[] = [];
  private visibleState = true;
  private R = 92;

  constructor() {
    super('Hud');
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    const sc = Settings.data.touchScale;
    this.R = 92 * sc;
    this.input.addPointer(3);

    // ── трекер квеста ──
    this.tracker = this.add.container(20, 18);
    this.trackerBg = this.add.graphics();
    const qIcon = txt(this, 18, 14, '✦', 18, CSS.hotpink);
    this.trackerText = txt(this, 44, 12, '', 18, CSS.text, { wordWrap: { width: 430 }, fontStyle: '700' });
    this.tracker.add([this.trackerBg, qIcon, this.trackerText]);
    this.updateTracker();

    // ── управление ──
    this.controls = this.add.container(0, 0).setAlpha(Settings.data.touchAlpha);
    this.stickHome = { x: 170 * sc + 10, y: H - 160 * sc };
    this.base = this.add.graphics();
    this.knob = this.add.graphics();
    this.drawStick(this.stickHome.x, this.stickHome.y, 0, 0);
    this.controls.add([this.base, this.knob]);

    this.aBtn = this.makeRoundButton(W - 140 * sc, H - 150 * sc, 66 * sc, '◉', 'говорить', () => {
      Controls.pressInteract();
      Audio2.unlock();
    });
    this.runBtn = this.makeRoundButton(W - 290 * sc, H - 90 * sc, 50 * sc, '»', 'бег', () => {});
    const menuBtn = this.makeRoundButton(W - 64, 58, 36, '☰', '', () => Controls.pressMenu());
    this.controls.add([this.aBtn, this.runBtn]);
    this.add.existing(menuBtn);

    // зона джойстика: левая половина экрана
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      Audio2.unlock();
      if (!this.visibleState) return;
      if (p.x < W * 0.45 && p.y > 140 && this.stickPointer === null) {
        this.stickPointer = p.id;
        this.stickOrigin = { x: p.x, y: p.y };
        this.drawStick(p.x, p.y, 0, 0);
      }
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.id !== this.stickPointer) return;
      let dx = p.x - this.stickOrigin.x;
      let dy = p.y - this.stickOrigin.y;
      const d = Math.hypot(dx, dy);
      const max = this.R * 0.75;
      if (d > max) {
        // база тянется за пальцем — удобно при длинных свайпах
        this.stickOrigin.x += (dx / d) * (d - max);
        this.stickOrigin.y += (dy / d) * (d - max);
        dx = p.x - this.stickOrigin.x;
        dy = p.y - this.stickOrigin.y;
      }
      const nd = Math.min(1, Math.hypot(dx, dy) / max);
      const dead = 0.12;
      const k = nd < dead ? 0 : (nd - dead) / (1 - dead);
      const a = Math.atan2(dy, dx);
      Controls.stickX = Math.cos(a) * k;
      Controls.stickY = Math.sin(a) * k;
      this.drawStick(this.stickOrigin.x, this.stickOrigin.y, dx, dy);
    });
    const up = (p: Phaser.Input.Pointer) => {
      if (p.id === this.stickPointer) {
        this.stickPointer = null;
        Controls.stickX = Controls.stickY = 0;
        this.drawStick(this.stickHome.x, this.stickHome.y, 0, 0);
      }
      if (p.id === this.runPointer) {
        this.runPointer = null;
        Controls.run = false;
        this.runBtn.setScale(1);
      }
    };
    this.input.on('pointerup', up);
    this.input.on('pointerupoutside', up);
    (this.runBtn.getData('zone') as Phaser.GameObjects.Zone).on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.runPointer = p.id;
      Controls.run = true;
      this.runBtn.setScale(0.92);
    });

    this.setupKeyboard();
    this.controls.setVisible(Settings.data.showTouch);

    // ── события ──
    this.offs.push(
      bus.on('hud-visible', (v: boolean) => this.setHudVisible(v)),
      bus.on('location', (name: string) => this.showLocation(name)),
      bus.on('interact-hint', (v: boolean) => this.aBtn.setData('hint', v)),
      bus.on('toast', (t: string, kind?: string) => this.toast(t, kind)),
      bus.on('quest', (u: QuestUpdate) => this.onQuest(u)),
      bus.on('levelup', (id: string, lv: number, learned: string[]) => {
        this.toast(`${MEMBERS[id].name}: уровень ${lv}!`, 'level');
        learned?.forEach((s) => this.toast(`${MEMBERS[id].name} выучил(а) «${SKILLS[s].name}»`, 'level'));
      }),
      bus.on('settings-changed', () => this.scene.restart()),
    );
    this.events.once('shutdown', () => {
      this.offs.forEach((f) => f());
      this.offs = [];
      Controls.reset();
    });
  }

  update(t: number) {
    // пульс кнопки, когда рядом есть с чем взаимодействовать
    const hint = this.aBtn.getData('hint');
    const ring = this.aBtn.getData('ring') as Phaser.GameObjects.Graphics;
    ring.setAlpha(hint ? 0.5 + Math.sin(t / 160) * 0.4 : 0);
  }

  private drawStick(x: number, y: number, dx: number, dy: number) {
    const R = this.R;
    this.base.clear();
    this.base.fillStyle(C.night2, 0.45);
    this.base.fillCircle(x, y, R);
    this.base.lineStyle(3, C.pink, 0.55);
    this.base.strokeCircle(x, y, R);
    this.base.lineStyle(2, C.pink, 0.2);
    this.base.strokeCircle(x, y, R * 0.55);
    this.knob.clear();
    this.knob.fillStyle(C.shadow, 0.3);
    this.knob.fillCircle(x + dx, y + dy + 4, R * 0.42);
    this.knob.fillStyle(C.pink, 0.9);
    this.knob.fillCircle(x + dx, y + dy, R * 0.42);
    this.knob.fillStyle(0xffffff, 0.35);
    this.knob.fillCircle(x + dx - R * 0.12, y + dy - R * 0.14, R * 0.16);
  }

  private makeRoundButton(x: number, y: number, r: number, glyph: string, label: string, onDown: () => void) {
    const c = this.add.container(x, y);
    const ring = this.add.graphics();
    ring.lineStyle(5, C.hotpink, 1);
    ring.strokeCircle(0, 0, r + 8);
    ring.setAlpha(0);
    const g = this.add.graphics();
    g.fillStyle(C.shadow, 0.3);
    g.fillCircle(0, 5, r);
    g.fillStyle(C.plum, 0.85);
    g.fillCircle(0, 0, r);
    g.fillStyle(0xffffff, 0.08);
    g.fillCircle(-r * 0.2, -r * 0.25, r * 0.6);
    g.lineStyle(3, C.pink, 0.8);
    g.strokeCircle(0, 0, r);
    const t = txt(this, 0, label ? -6 : 0, glyph, r * 0.8, CSS.pink, { fontStyle: '800' }).setOrigin(0.5);
    const parts: Phaser.GameObjects.GameObject[] = [ring, g, t];
    if (label) parts.push(txt(this, 0, r * 0.45, label, Math.max(12, r * 0.26), CSS.dim).setOrigin(0.5));
    const zone = this.add.zone(0, 0, r * 2.4, r * 2.4).setInteractive();
    zone.on('pointerdown', () => {
      c.setScale(0.92);
      onDown();
    });
    zone.on('pointerup', () => c.setScale(1));
    zone.on('pointerout', () => c.setScale(1));
    parts.push(zone);
    c.add(parts);
    c.setData('zone', zone);
    c.setData('ring', ring);
    return c;
  }

  private setupKeyboard() {
    const kb = this.input.keyboard;
    if (!kb) return;
    const keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT,SPACE,E,ENTER,M,TAB') as Record<string, Phaser.Input.Keyboard.Key>;
    const recalc = () => {
      Controls.keyX = (keys.D.isDown || keys.RIGHT.isDown ? 1 : 0) - (keys.A.isDown || keys.LEFT.isDown ? 1 : 0);
      Controls.keyY = (keys.S.isDown || keys.DOWN.isDown ? 1 : 0) - (keys.W.isDown || keys.UP.isDown ? 1 : 0);
      Controls.keyRun = keys.SHIFT.isDown;
    };
    kb.on('keydown', (e: KeyboardEvent) => {
      recalc();
      Audio2.unlock();
      if (['Space', 'KeyE', 'Enter'].includes(e.code) && this.visibleState) Controls.pressInteract();
      if (['KeyM', 'Tab'].includes(e.code)) {
        e.preventDefault?.();
        Controls.pressMenu();
      }
    });
    kb.on('keyup', recalc);
  }

  private setHudVisible(v: boolean) {
    this.visibleState = v;
    if (!v) {
      this.stickPointer = null;
      this.runPointer = null;
      Controls.stickX = Controls.stickY = 0;
      Controls.run = false;
      this.drawStick(this.stickHome.x, this.stickHome.y, 0, 0);
    }
    this.tweens.add({ targets: this.controls, alpha: v ? Settings.data.touchAlpha : 0, duration: 160 });
    this.tweens.add({ targets: this.tracker, alpha: v ? 1 : 0, duration: 160 });
    this.children.list.forEach((o) => {
      if (o !== this.controls && o !== this.tracker && (o as any).getData?.('zone')) (o as any).setVisible(v);
    });
    if (v) this.updateTracker();
  }

  private updateTracker() {
    const main = State.data.quests.main;
    const text = main && !main.done ? Quests.currentText('main') : this.firstSideQuest();
    this.trackerText.setText(text || 'Ночь свободна. Гуляй, сколько хочешь.');
    const h = this.trackerText.height + 26;
    const w = Math.min(500, this.trackerText.width + 64);
    this.trackerBg.clear();
    this.trackerBg.fillStyle(C.night2, 0.78);
    this.trackerBg.fillRoundedRect(0, 0, w, h, 16);
    this.trackerBg.lineStyle(2, C.pink, 0.35);
    this.trackerBg.strokeRoundedRect(0, 0, w, h, 16);
  }

  private firstSideQuest(): string {
    const id = Object.keys(State.data.quests).find((q) => Quests.isActive(q));
    return id ? Quests.currentText(id) : '';
  }

  private showLocation(name: string) {
    const W = this.scale.width;
    const c = this.add.container(W / 2, 90).setAlpha(0);
    const t = txt(this, 0, 0, name, 30, CSS.text, { fontStyle: '800' }).setOrigin(0.5);
    t.setShadow(0, 0, CSS.hotpink, 14, true, true);
    const line = this.add.graphics();
    line.fillStyle(C.pink, 0.8);
    line.fillRoundedRect(-t.width / 2, 24, t.width, 3, 1.5);
    c.add([t, line]);
    this.tweens.add({ targets: c, alpha: 1, y: 100, duration: 500, ease: 'Sine.Out', hold: 1600, yoyo: true, onComplete: () => c.destroy() });
  }

  private onQuest(u: QuestUpdate) {
    const head = u.kind === 'start' ? 'Новый квест' : u.kind === 'complete' ? 'Квест выполнен' : 'Квест обновлён';
    this.toast(`${head}: «${u.title}»`, 'quest');
    if (u.kind === 'complete') Audio2.sfx('levelup');
    this.updateTracker();
  }

  private toast(text: string, kind = 'item') {
    const W = this.scale.width;
    const colors: Record<string, number> = { item: C.caramel, cassette: C.hotpink, quest: C.lilac, level: C.mint, money: C.gold, party: C.pink };
    const c = this.add.container(W + 10, 150 + this.toastY);
    this.toastY += 58;
    const t = txt(this, 0, 0, text, 19, CSS.text).setOrigin(1, 0.5);
    const w = t.width + 40;
    const g = this.add.graphics();
    g.fillStyle(C.night2, 0.92);
    g.fillRoundedRect(-w + 10, -22, w, 44, 22);
    g.fillStyle(colors[kind] ?? C.pink, 1);
    g.fillCircle(-w + 30, 0, 6);
    g.lineStyle(2, colors[kind] ?? C.pink, 0.6);
    g.strokeRoundedRect(-w + 10, -22, w, 44, 22);
    t.x = -6;
    c.add([g, t]);
    this.tweens.add({
      targets: c,
      x: W - 20,
      duration: 300,
      ease: 'Back.Out',
      hold: 2400,
      yoyo: true,
      onComplete: () => {
        c.destroy();
        this.toastY = Math.max(0, this.toastY - 58);
      },
    });
  }
}
