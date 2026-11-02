import Phaser from 'phaser';
import { C, CSS } from '../config';
import { DIALOGUES } from '../data/dialogues';
import { CHARACTERS, portraitKey } from '../data/characters';
import { DialogueRunner, type Visible } from '../systems/DialogueRunner';
import { runEffects, type WorldApi } from '../systems/Effects';
import { Settings } from '../systems/Settings';
import { Audio2 } from '../systems/Audio';
import { bus } from '../systems/events';
import { Overlay } from '../systems/Overlay';
import { Button, drawPanel, txt } from '../ui/widgets';
import type { Emo } from '../data/types';

interface Data {
  id: string;
  api: WorldApi;
  onDone: () => void;
}

export class DialogueScene extends Phaser.Scene {
  private runner!: DialogueRunner;
  private d!: Data;
  private root!: Phaser.GameObjects.Container;
  private box!: Phaser.GameObjects.Graphics;
  private nameTag!: Phaser.GameObjects.Container;
  private nameText!: Phaser.GameObjects.Text;
  private nameBg!: Phaser.GameObjects.Graphics;
  private body!: Phaser.GameObjects.Text;
  private arrow!: Phaser.GameObjects.Text;
  private portrait: Phaser.GameObjects.Image | null = null;
  private choices: Button[] = [];
  private full = '';
  private shown = 0;
  private typing = false;
  private typeTimer?: Phaser.Time.TimerEvent;
  private waitingTap = false;
  private busyEffects = false;
  private currentWho: string | undefined;
  private offs: (() => void)[] = [];

  constructor() {
    super('Dialogue');
  }

  init(d: Data) {
    this.d = d;
    this.choices = [];
    this.portrait = null;
    this.currentWho = undefined;
    this.waitingTap = false;
    this.busyEffects = false;
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    this.runner = new DialogueRunner(DIALOGUES[this.d.id] ?? []);
    this.root = this.add.container(0, 0);

    const bh = 190;
    const bx = 40;
    const by = H - bh - 24;
    const bw = W - 80;
    this.box = this.add.graphics({ x: bx, y: by });
    drawPanel(this.box, bw, bh, { fill: C.night2, alpha: 0.95, radius: 24 });

    this.nameTag = this.add.container(bx + 34, by - 4);
    this.nameBg = this.add.graphics();
    this.nameText = txt(this, 20, 0, '', 22, CSS.night, { fontStyle: '800' }).setOrigin(0, 0.5);
    this.nameTag.add([this.nameBg, this.nameText]);

    this.body = txt(this, bx + 36, by + 40, '', 25, CSS.text, { wordWrap: { width: bw - 80, useAdvancedWrap: true }, lineSpacing: 8, fontStyle: '600' });
    this.arrow = txt(this, bx + bw - 44, by + bh - 40, '▼', 20, CSS.pink).setAlpha(0);
    this.tweens.add({ targets: this.arrow, y: '+=6', yoyo: true, repeat: -1, duration: 420 });

    const tapZone = this.add.zone(0, 0, W, H).setOrigin(0).setInteractive();
    tapZone.on('pointerdown', () => this.advance());
    this.root.add([tapZone, this.box, this.nameTag, this.body, this.arrow]);

    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (['Space', 'Enter', 'KeyE'].includes(e.code)) this.advance();
    });

    this.root.setAlpha(0);
    this.tweens.add({ targets: this.root, alpha: 1, duration: 140 });
    Overlay.push('Dialogue', () => this.advance());
    this.offs.push(bus.on('dialogue-visible', (v: boolean) => this.root.setVisible(v)));
    this.events.once('shutdown', () => {
      Overlay.remove('Dialogue');
      this.offs.forEach((f) => f());
      this.offs = [];
    });
    this.step();
  }

  private async step(): Promise<void> {
    this.clearChoices();
    const s = this.runner.next();
    if (!s) return this.finish();
    if ('say' in s) return this.showLine(s.say, s.who, s.emo);
    if ('choice' in s) return this.showChoices(s);
    if ('do' in s) {
      this.busyEffects = true;
      this.root.setVisible(false);
      const ok = await runEffects(s.do, this.d.api);
      this.busyEffects = false;
      if (!this.sys.isActive()) return;
      if (!ok) return this.finish();
      this.root.setVisible(true);
      return this.step();
    }
  }

  private showLine(text: string, who?: string, emo?: Emo) {
    const ch = who ? CHARACTERS[who] : undefined;
    // имя
    if (ch) {
      this.nameTag.setVisible(true);
      this.nameText.setText(ch.name);
      const w = this.nameText.width + 40;
      this.nameBg.clear();
      this.nameBg.fillStyle(Phaser.Display.Color.HexStringToColor(ch.color).color, 1);
      this.nameBg.fillRoundedRect(0, -20, w, 40, 20);
      this.nameBg.lineStyle(2, 0xffffff, 0.5);
      this.nameBg.strokeRoundedRect(0, -20, w, 40, 20);
    } else this.nameTag.setVisible(false);

    this.setPortrait(who, emo);
    this.body.setStyle({ fontStyle: who ? '600' : 'italic 600', color: who ? CSS.text : CSS.dim });

    this.full = text;
    this.shown = 0;
    this.body.setText('');
    this.arrow.setAlpha(0);
    this.typing = true;
    this.waitingTap = true;
    const delay = Settings.charDelay();
    this.typeTimer?.remove();
    if (delay === 0) return this.finishTyping();
    this.typeTimer = this.time.addEvent({
      delay,
      loop: true,
      callback: () => {
        this.shown++;
        this.body.setText(this.full.slice(0, this.shown));
        if (this.shown % 3 === 0 && who) Audio2.sfx('text');
        if (this.shown >= this.full.length) this.finishTyping();
      },
    });
  }

  private setPortrait(who?: string, emo?: Emo) {
    const W = this.scale.width;
    const H = this.scale.height;
    const key = who ? portraitKey(who, emo) : null;
    if (!key || !this.textures.exists(key)) {
      if (this.portrait) {
        const p = this.portrait;
        this.portrait = null;
        this.tweens.add({ targets: p, alpha: 0, duration: 120, onComplete: () => p.destroy() });
      }
      this.currentWho = undefined;
      this.body.setX(76);
      this.body.setWordWrapWidth(W - 160);
      return;
    }
    const isHero = who === 'hana';
    const maxH = 330;
    const x = isHero ? W - 190 : 190;
    const y = H - 214;
    if (this.portrait && this.currentWho === who) {
      this.portrait.setTexture(key);
    } else {
      this.portrait?.destroy();
      this.portrait = this.add.image(x, y, key).setOrigin(0.5, 1);
      this.root.addAt(this.portrait, 1);
      this.portrait.setAlpha(0);
      this.portrait.x += isHero ? 30 : -30;
      this.tweens.add({ targets: this.portrait, alpha: 1, x, duration: 200, ease: 'Sine.Out' });
    }
    const p = this.portrait;
    const s = Math.min(maxH / p.height, 280 / p.width);
    p.setScale(s);
    this.currentWho = who;
    this.body.setX(76);
    this.body.setWordWrapWidth(W - 160);
  }

  private finishTyping() {
    this.typeTimer?.remove();
    this.typing = false;
    this.body.setText(this.full);
    this.arrow.setAlpha(1);
  }

  private advance() {
    if (this.busyEffects || this.choices.length) return;
    if (this.typing) return this.finishTyping();
    if (!this.waitingTap) return;
    this.waitingTap = false;
    Audio2.sfx('click');
    this.step();
  }

  private showChoices(s: Extract<Visible, { choice: unknown }>) {
    const W = this.scale.width;
    const H = this.scale.height;
    const opts = s.choice;
    const bw = Math.min(520, W * 0.42);
    const startY = H - 260 - opts.length * 70;
    this.arrow.setAlpha(0);
    opts.forEach((o, i) => {
      const b = new Button(this, W - bw / 2 - 60, startY + i * 70, bw, 58, o.text, () => {
        this.clearChoices();
        this.runner.choose(o.goto);
        this.step();
      }, { size: 22, align: 'left' });
      b.setAlpha(0);
      this.tweens.add({ targets: b, alpha: 1, x: b.x - 10, duration: 160, delay: i * 50 });
      this.choices.push(b);
      this.root.add(b);
    });
  }

  private clearChoices() {
    this.choices.forEach((b) => b.destroy());
    this.choices = [];
  }

  private finish() {
    this.typeTimer?.remove();
    this.tweens.add({
      targets: this.root,
      alpha: 0,
      duration: 120,
      onComplete: () => {
        const done = this.d.onDone;
        this.scene.stop();
        done();
      },
    });
  }
}
