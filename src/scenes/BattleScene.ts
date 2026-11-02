import Phaser from 'phaser';
import { C, CSS, MOOD_INFO } from '../config';
import { ITEMS } from '../data/items';
import { SKILLS } from '../data/skills';
import { ENEMIES } from '../data/enemies';
import { MEMBERS } from '../data/party';
import type { Mood } from '../data/types';
import { BattleEngine, enemyCombatants, partyCombatant, type Action, type BEvent, type Combatant } from '../systems/BattleEngine';
import { State, addExp } from '../systems/GameState';
import { Audio2 } from '../systems/Audio';
import { Overlay } from '../systems/Overlay';
import { Button, ListView, bar, drawPanel, itemIcon, rowBg, txt } from '../ui/widgets';
import type { BattleResult } from '../systems/Effects';

interface Data {
  group: string[];
  bg: string;
  boss?: boolean;
  music?: string;
  noFlee?: boolean;
  onEnd: (r: BattleResult) => void;
}

interface EnemyView {
  c: Combatant;
  root: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Image;
  bars: Phaser.GameObjects.Graphics;
  weakText: Phaser.GameObjects.Text;
  arrow: Phaser.GameObjects.Text;
  baseY: number;
  hitZone: Phaser.GameObjects.Zone;
}

interface CardView {
  c: Combatant;
  root: Phaser.GameObjects.Container;
  bars: Phaser.GameObjects.Graphics;
  hpText: Phaser.GameObjects.Text;
  spText: Phaser.GameObjects.Text;
  frame: Phaser.GameObjects.Graphics;
  arrow: Phaser.GameObjects.Text;
  baseY: number;
  w: number;
  h: number;
}

export class BattleScene extends Phaser.Scene {
  private d!: Data;
  private engine!: BattleEngine;
  private enemyViews: EnemyView[] = [];
  private cards: CardView[] = [];
  private menu!: Phaser.GameObjects.Container;
  private sub: Phaser.GameObjects.Container | null = null;
  private banner!: Phaser.GameObjects.Container;
  private bannerText!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private resolveAction: ((a: Action | null) => void) | null = null;
  private targeting: { kind: 'enemy' | 'ally' | 'allyAny'; done: (uid: string | null) => void } | null = null;
  private currentFx = 'slash';
  private ended = false;

  constructor() {
    super('Battle');
  }

  init(d: Data) {
    this.d = d;
    this.enemyViews = [];
    this.cards = [];
    this.sub = null;
    this.resolveAction = null;
    this.targeting = null;
    this.ended = false;
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    Audio2.play(this.d.music ?? 'battle');

    const bgKey = this.textures.exists(`bgb_${this.d.bg}`) ? `bgb_${this.d.bg}` : 'bgb_street';
    const bg = this.add.image(W / 2, H / 2, bgKey);
    bg.setScale(Math.max(W / bg.width, H / bg.height) * 1.05);
    this.tweens.add({ targets: bg, scale: bg.scale * 1.03, x: W / 2 + 10, yoyo: true, repeat: -1, duration: 7000, ease: 'Sine.InOut' });
    // пол-сцена под врагами
    const floor = this.add.graphics();
    floor.fillStyle(C.night, 0.18);
    floor.fillEllipse(W / 2, 420, W * 0.7, 90);
    floor.fillStyle(C.night, 0.14);
    floor.fillEllipse(W / 2, 420, W * 0.45, 60);
    this.add.particles(0, 0, 'dot', {
      x: { min: 0, max: W },
      y: { min: 0, max: H },
      lifespan: 4000,
      speedY: { min: -20, max: -6 },
      scale: { min: 0.2, max: 0.6 },
      alpha: { start: 0.6, end: 0 },
      tint: [0xff8fc0, 0xb79ad6, 0xffd98a],
      blendMode: 'ADD',
      frequency: 140,
    });

    this.engine = new BattleEngine(
      State.data.party.map((m) => partyCombatant(m)),
      enemyCombatants(this.d.group),
      { noFlee: this.d.noFlee },
    );
    // павшие начинают бой с 1 HP (как в сохранении)
    this.engine.party.forEach((c) => (c.hp = Math.max(1, c.hp)));

    this.buildEnemies();
    this.buildCards();
    this.menu = this.add.container(0, 0);

    this.banner = this.add.container(W / 2, 64).setDepth(50).setAlpha(0);
    const bb = this.add.graphics();
    this.bannerText = txt(this, 0, 0, '', 26, CSS.text, { fontStyle: '800' }).setOrigin(0.5);
    this.banner.add([bb, this.bannerText]);
    this.banner.setData('bg', bb);
    this.hint = txt(this, W / 2, H - 250, '', 22, CSS.pink, { fontStyle: '800' }).setOrigin(0.5).setDepth(40);
    this.hint.setShadow(0, 2, '#1d1428', 6, true, true);

    Overlay.push('Battle', () => this.back());
    this.events.once('shutdown', () => Overlay.remove('Battle'));

    // вход
    this.cameras.main.fadeIn(300, 255, 143, 192);
    const names = [...new Set(this.engine.enemies.map((e) => ENEMIES[e.defId].name))].join(', ');
    this.time.delayedCall(350, async () => {
      await this.say(this.d.boss ? `${names} преграждает путь!` : `Шумы: ${names}!`, 900);
      await this.play(this.engine.start());
      this.loop();
    });
  }

  // ───────────────────────── построение ─────────────────────────
  private buildEnemies() {
    const W = this.scale.width;
    const n = this.engine.enemies.length;
    const spread = Math.min(320, (W - 200) / Math.max(1, n));
    this.engine.enemies.forEach((c, i) => {
      const def = ENEMIES[c.defId];
      const x = W / 2 + (i - (n - 1) / 2) * spread;
      const baseY = def.boss ? 440 : 410;
      const root = this.add.container(x, baseY);
      const shadow = this.add.image(0, 4, 'shadow').setScale(def.boss ? 5 : 2.6, 2);
      const aura = this.add.image(0, def.boss ? -200 : -110, 'glow').setTint(def.boss ? 0xe6d3ff : 0xb06bff).setBlendMode(Phaser.BlendModes.ADD).setScale(def.boss ? 4 : 2.2).setAlpha(0.35);
      const key = this.textures.exists(`enemy_${def.art}`) ? `enemy_${def.art}` : 'fx_dark';
      const sprite = this.add.image(0, 0, key).setOrigin(0.5, 1);
      const targetH = def.boss ? 400 : 220;
      sprite.setScale(Math.min(targetH / sprite.height, (spread * 0.9) / sprite.width) * (def.scale ?? 1));
      const bars = this.add.graphics();
      const name = txt(this, 0, 26, c.name, 18, CSS.text).setOrigin(0.5, 0);
      const weakText = txt(this, 0, 74, '', 16, CSS.dim).setOrigin(0.5, 0);
      const arrow = txt(this, 0, -sprite.displayHeight - 30, '▼', 30, CSS.hotpink, { fontStyle: '800' }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: arrow, y: arrow.y + 8, yoyo: true, repeat: -1, duration: 350 });
      const hitZone = this.add.zone(0, -sprite.displayHeight / 2, Math.max(140, sprite.displayWidth), sprite.displayHeight + 40).setInteractive();
      hitZone.on('pointerdown', () => this.pickTarget(c.uid));
      root.add([shadow, aura, sprite, bars, name, weakText, arrow, hitZone]);
      this.tweens.add({ targets: sprite, y: -10, yoyo: true, repeat: -1, duration: 1100 + i * 130, ease: 'Sine.InOut' });
      this.tweens.add({ targets: aura, alpha: 0.15, yoyo: true, repeat: -1, duration: 900 });
      root.setAlpha(0);
      root.y -= 30;
      this.tweens.add({ targets: root, alpha: 1, y: baseY, duration: 400, delay: i * 120, ease: 'Back.Out' });
      const v: EnemyView = { c, root, sprite, bars, weakText, arrow, baseY, hitZone };
      this.enemyViews.push(v);
      this.drawEnemy(v);
    });
  }

  private drawEnemy(v: EnemyView) {
    v.bars.clear();
    bar(v.bars, -80, 56, 160, 10, v.c.hp / v.c.stats.maxHp, C.hotpink);
    const def = ENEMIES[v.c.defId];
    const known = def.boss ? v.c.weak : v.c.weak.filter((m) => State.knowsWeak(v.c.defId, m));
    const unknown = def.boss ? 0 : v.c.weak.length - known.length;
    const parts = known.map((m) => `${MOOD_INFO[m].glyph} ${MOOD_INFO[m].name}`);
    if (unknown) parts.push('?');
    v.weakText.setText(parts.length ? `слабость: ${parts.join(' · ')}` : 'слабостей нет');
    if (known.length === 1) v.weakText.setColor(MOOD_INFO[known[0]].css);
    else v.weakText.setColor(CSS.dim);
  }

  private buildCards() {
    const W = this.scale.width;
    const H = this.scale.height;
    const n = this.engine.party.length;
    const w = Math.min(270, (W - 340) / n - 12);
    const h = 120;
    this.engine.party.forEach((c, i) => {
      const x = W - 20 - (n - i) * (w + 12);
      const baseY = H - h - 20;
      const root = this.add.container(x, baseY);
      const frame = this.add.graphics();
      const pk = `portrait_${c.defId}_neutral`;
      const parts: Phaser.GameObjects.GameObject[] = [frame];
      if (this.textures.exists(pk)) {
        const img = this.add.image(46, 46, pk);
        img.setScale(76 / Math.max(img.width, img.height) * 1.15);
        const mask = this.make.graphics({});
        mask.fillStyle(0xffffff).fillCircle(x + 46, baseY + 46, 34);
        img.setMask(mask.createGeometryMask());
        img.setData('mask', mask);
        root.setData('img', img);
        parts.push(img);
        const ring = this.add.graphics();
        ring.lineStyle(3, C.pink, 0.9).strokeCircle(46, 46, 35);
        parts.push(ring);
      }
      parts.push(txt(this, 92, 14, MEMBERS[c.defId].name, 21, CSS.text, { fontStyle: '800' }));
      const bars = this.add.graphics();
      const hpText = txt(this, w - 14, 46, '', 15, CSS.pink).setOrigin(1, 0);
      const spText = txt(this, w - 14, 82, '', 15, '#a9c1ff').setOrigin(1, 0);
      parts.push(bars, hpText, spText, txt(this, 92, 46, 'HP', 14, CSS.dim), txt(this, 92, 82, 'SP', 14, CSS.dim));
      const arrow = txt(this, w / 2, -26, '▼', 28, CSS.mint, { fontStyle: '800' }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: arrow, y: -18, yoyo: true, repeat: -1, duration: 350 });
      parts.push(arrow);
      const zone = this.add.zone(w / 2, h / 2, w, h).setInteractive();
      zone.on('pointerdown', () => this.pickTarget(c.uid));
      parts.push(zone);
      root.add(parts);
      const v: CardView = { c, root, bars, hpText, spText, frame, arrow, baseY, w, h };
      this.cards.push(v);
      this.drawCard(v, false);
    });
  }

  private drawCard(v: CardView, active: boolean) {
    const { w, h, c } = v;
    drawPanel(v.frame, w, h, { fill: active ? C.violet : C.night2, alpha: 0.94, radius: 18, stroke: active ? C.hotpink : C.pink, strokeAlpha: active ? 1 : 0.5, lineWidth: active ? 3 : 2 });
    v.bars.clear();
    bar(v.bars, 92, 66, w - 106, 10, c.hp / c.stats.maxHp, C.hotpink);
    bar(v.bars, 92, 102, w - 106, 10, c.sp / c.stats.maxSp, 0x8fb3ff);
    v.hpText.setText(`${c.hp}/${c.stats.maxHp}`);
    v.spText.setText(`${c.sp}/${c.stats.maxSp}`);
    v.root.setAlpha(c.hp <= 0 ? 0.5 : 1);
    const ty = active ? v.baseY - 14 : v.baseY;
    this.tweens.add({ targets: v.root, y: ty, duration: 150 });
    const img = v.root.getData('img') as Phaser.GameObjects.Image | undefined;
    if (img) {
      const mask = img.getData('mask') as Phaser.GameObjects.Graphics;
      mask.clear();
      mask.fillStyle(0xffffff).fillCircle(v.root.x + 46, ty + 46, 34);
      img.setTint(c.hp <= 0 ? 0x555566 : 0xffffff);
    }
  }

  private refreshAll() {
    const cur = this.engine.current;
    this.cards.forEach((v) => this.drawCard(v, cur?.uid === v.c.uid && !this.engine.outcome));
    this.enemyViews.forEach((v) => this.drawEnemy(v));
  }

  // ───────────────────────── игровой цикл ─────────────────────────
  private async loop() {
    while (!this.engine.outcome && !this.ended) {
      const actor = this.engine.current!;
      this.refreshAll();
      let events: BEvent[];
      let usedItem: string | null = null;
      if (actor.side === 'party') {
        const a = await this.chooseAction(actor);
        if (!a || this.ended) return;
        if (a.type === 'item') usedItem = a.item;
        events = this.engine.act(a);
      } else {
        await this.delay(380);
        events = this.engine.enemyTurn();
      }
      if (usedItem && events.length) State.remove(usedItem);
      await this.play(events);
      if (this.engine.outcome) break;
      await this.play(this.engine.next());
    }
    this.refreshAll();
    await this.finish();
  }

  private chooseAction(actor: Combatant): Promise<Action | null> {
    return new Promise((resolve) => {
      this.resolveAction = resolve;
      this.showMenu(actor);
    });
  }

  private submit(a: Action) {
    const r = this.resolveAction;
    this.resolveAction = null;
    this.clearMenu();
    r?.(a);
  }

  private clearMenu() {
    this.menu.removeAll(true);
    this.sub?.destroy();
    this.sub = null;
    this.hint.setText('');
    this.setTargeting(null);
  }

  private showMenu(actor: Combatant) {
    this.clearMenu();
    const H = this.scale.height;
    const x = 24;
    const bw = 250;
    const items: [string, () => void, boolean][] = [
      ['⚔  Атака', () => this.target('enemy', (uid) => uid && this.submit({ type: 'attack', target: uid })), true],
      ['✦  Навык', () => this.showSkills(actor), actor.skills.length > 0],
      ['✚  Предмет', () => this.showItems(), State.items('consumable').some((e) => e.def.battle)],
      ['◈  Защита', () => this.submit({ type: 'defend' }), true],
      ['»  Побег', () => this.submit({ type: 'flee' }), this.engine.canFlee],
    ];
    const top = H - 24 - items.length * 62;
    const g = this.add.graphics({ x: x - 10, y: top - 58 });
    drawPanel(g, bw + 20, items.length * 62 + 66, { radius: 22, alpha: 0.9 });
    this.menu.add(g);
    this.menu.add(txt(this, x + 8, top - 44, `Ход: ${actor.name}`, 20, CSS.pink, { fontStyle: '800' }));
    items.forEach(([label, fn, en], i) => {
      const b = new Button(this, x + bw / 2, top + i * 62 + 22, bw, 54, label, fn, { size: 21, align: 'left' }).setEnabled(en);
      this.menu.add(b);
    });
    if (this.engine.allOutReady()) {
      const W = this.scale.width;
      const b = new Button(this, W / 2, 200, 380, 70, '★ ФИНАЛЬНЫЙ АККОРД ★', () => this.submit({ type: 'allout' }), { size: 24, fill: C.rose, stroke: C.gold });
      this.tweens.add({ targets: b, scale: 1.05, yoyo: true, repeat: -1, duration: 400 });
      this.menu.add(b);
      this.hint.setText('Все шумы растеряны!');
    }
  }

  private subPanel(title: string, rows: { render: (c: Phaser.GameObjects.Container, w: number, h: number) => void; onTap?: () => void }[]) {
    this.sub?.destroy();
    const H = this.scale.height;
    const x = 290;
    const w = 420;
    const h = Math.min(400, rows.length * 62 + 80);
    const y = H - 24 - h;
    const c = this.add.container(0, 0);
    const g = this.add.graphics({ x, y });
    drawPanel(g, w, h, { radius: 20, alpha: 0.95 });
    c.add(g);
    c.add(txt(this, x + 20, y + 14, title, 19, CSS.pink, { fontStyle: '800' }));
    c.add(new Button(this, x + w - 40, y + 26, 52, 40, '✕', () => (this.sub?.destroy(), (this.sub = null)), { size: 18 }));
    const list = new ListView(this, x + 12, y + 56, w - 24, h - 66, 62);
    list.setRows(rows);
    c.add(list);
    this.sub = c;
  }

  private showSkills(actor: Combatant) {
    this.subPanel(
      'Навыки',
      actor.skills.map((id) => {
        const s = SKILLS[id];
        const can = actor.sp >= s.sp;
        const mood = s.mood ? MOOD_INFO[s.mood] : null;
        return {
          render: (c, w, h) => {
            c.add(rowBg(this, w, h));
            c.add(txt(this, 16, h / 2, mood ? mood.glyph : '✚', 22, mood ? mood.css : CSS.mint).setOrigin(0, 0.5));
            c.add(txt(this, 48, h / 2 - 10, s.name, 19, can ? CSS.text : CSS.dim).setOrigin(0, 0.5));
            c.add(txt(this, 48, h / 2 + 13, s.desc, 13, CSS.dim, { fontStyle: '600' }).setOrigin(0, 0.5));
            c.add(txt(this, w - 14, h / 2, `${s.sp} SP`, 17, can ? '#a9c1ff' : CSS.red).setOrigin(1, 0.5));
          },
          onTap: () => {
            if (!can) {
              Audio2.sfx('locked');
              return;
            }
            const go = (uid?: string) => this.submit({ type: 'skill', skill: id, target: uid });
            if (s.target === 'enemy') this.target('enemy', (uid) => uid && go(uid));
            else if (s.target === 'ally') this.target('ally', (uid) => uid && go(uid));
            else go();
          },
        };
      }),
    );
  }

  private showItems() {
    const items = State.items('consumable').filter((e) => e.def.battle);
    this.subPanel(
      'Предметы',
      items.map(({ def, n }) => ({
        render: (c, w, h) => {
          c.add(rowBg(this, w, h));
          c.add(itemIcon(this, 28, h / 2, def.icon, 36));
          c.add(txt(this, 56, h / 2, def.name, 18, CSS.text).setOrigin(0, 0.5));
          c.add(txt(this, w - 14, h / 2, `×${n}`, 17, CSS.dim).setOrigin(1, 0.5));
        },
        onTap: () => {
          const e = def.effect!;
          const go = (uid?: string) => this.submit({ type: 'item', item: def.id, target: uid });
          if (e.all) go();
          else this.target(e.revive ? 'allyAny' : 'ally', (uid) => uid && go(uid));
        },
      })),
    );
  }

  private target(kind: 'enemy' | 'ally' | 'allyAny', done: (uid: string | null) => void) {
    this.sub?.setVisible(false);
    this.menu.setVisible(false);
    this.hint.setText(kind === 'enemy' ? 'Выбери цель' : 'Выбери союзника');
    const back = new Button(this, 150, this.scale.height - 60, 220, 56, '← Назад', () => {
      back.destroy();
      this.setTargeting(null);
      this.sub?.setVisible(true);
      this.menu.setVisible(true);
      this.hint.setText('');
    }, { size: 20 });
    this.setTargeting({
      kind,
      done: (uid) => {
        back.destroy();
        this.menu.setVisible(true);
        done(uid);
      },
    });
  }

  private setTargeting(t: BattleScene['targeting']) {
    this.targeting = t;
    this.enemyViews.forEach((v) => v.arrow.setAlpha(t?.kind === 'enemy' && v.c.hp > 0 ? 1 : 0));
    this.cards.forEach((v) => v.arrow.setAlpha(t && t.kind !== 'enemy' && (t.kind === 'allyAny' || v.c.hp > 0) ? 1 : 0));
  }

  private pickTarget(uid: string) {
    const t = this.targeting;
    if (!t) return;
    const c = this.engine.get(uid);
    if (t.kind === 'enemy' && (c.side !== 'enemy' || c.hp <= 0)) return;
    if (t.kind === 'ally' && (c.side !== 'party' || c.hp <= 0)) return;
    if (t.kind === 'allyAny' && c.side !== 'party') return;
    Audio2.sfx('confirm');
    this.setTargeting(null);
    t.done(uid);
  }

  private back() {
    if (this.targeting) {
      this.setTargeting(null);
      this.menu.setVisible(true);
      this.sub?.setVisible(true);
      this.hint.setText('');
      this.children.list.filter((o) => o instanceof Button && (o as Button).label.text === '← Назад').forEach((o) => o.destroy());
      return;
    }
    if (this.sub) {
      this.sub.destroy();
      this.sub = null;
    }
  }

  // ───────────────────────── анимации событий ─────────────────────────
  private viewOf(uid: string): { x: number; y: number; obj: Phaser.GameObjects.Container; enemy?: EnemyView; card?: CardView } {
    const e = this.enemyViews.find((v) => v.c.uid === uid);
    if (e) return { x: e.root.x, y: e.root.y - e.sprite.displayHeight / 2, obj: e.root, enemy: e };
    const c = this.cards.find((v) => v.c.uid === uid)!;
    return { x: c.root.x + c.w / 2, y: c.root.y + 20, obj: c.root, card: c };
  }

  private async play(events: BEvent[]) {
    for (const ev of events) {
      if (this.ended) return;
      await this.playOne(ev);
    }
    this.refreshAll();
  }

  private async playOne(ev: BEvent) {
    switch (ev.t) {
      case 'act': {
        const a = this.engine.get(ev.actor);
        this.currentFx = ev.fx ?? 'slash';
        const label = ev.kind === 'attack' ? 'Атака' : ev.kind === 'defend' ? 'Защита' : ev.kind === 'flee' ? 'Побег' : ev.name ?? '';
        const moodTag = ev.mood ? ` ${MOOD_INFO[ev.mood].glyph}` : '';
        if (ev.kind === 'allout') {
          await this.allOutCutIn();
          return;
        }
        this.say(`${a.name}: ${label}${moodTag}`, 700);
        const v = this.viewOf(ev.actor);
        if (v.enemy) {
          this.tweens.add({ targets: v.enemy.sprite, scale: v.enemy.sprite.scale * 1.12, yoyo: true, duration: 140 });
          this.tweens.add({ targets: v.obj, y: v.obj.y + 24, yoyo: true, duration: 160 });
        } else {
          this.tweens.add({ targets: v.obj, y: v.obj.y - 24, yoyo: true, duration: 140 });
        }
        if (ev.kind === 'defend') Audio2.sfx('buff');
        await this.delay(ev.kind === 'defend' ? 450 : 320);
        return;
      }
      case 'hit': {
        const v = this.viewOf(ev.target);
        this.fx(v.x, v.y, this.currentFx);
        Audio2.sfx(ev.weak || ev.crit ? 'weak' : 'hit');
        this.cameras.main.shake(ev.weak || ev.crit ? 220 : 120, ev.weak || ev.crit ? 0.012 : 0.005);
        if (v.enemy) {
          v.enemy.sprite.setTintFill(0xffffff);
          this.time.delayedCall(90, () => v.enemy!.sprite.clearTint());
          this.tweens.add({ targets: v.enemy.sprite, x: { from: -10, to: 0 }, duration: 200, ease: 'Bounce.Out' });
        } else if (v.card) {
          this.tweens.add({ targets: v.obj, x: { from: v.obj.x - 10, to: v.obj.x }, duration: 220, ease: 'Bounce.Out' });
        }
        const color = ev.weak ? CSS.gold : ev.resist ? CSS.dim : v.enemy ? CSS.text : CSS.red;
        this.popNumber(v.x, v.y - 30, `${ev.amount}`, color, ev.weak || ev.crit ? 46 : 36);
        if (ev.weak) {
          this.popNumber(v.x, v.y - 80, 'СЛАБОСТЬ!', CSS.gold, 26);
          const c = this.engine.get(ev.target);
          if (ev.mood) State.learnWeak(c.defId, ev.mood);
        } else if (ev.resist) this.popNumber(v.x, v.y - 80, 'стойкость', CSS.dim, 22);
        else if (ev.crit) this.popNumber(v.x, v.y - 80, 'КРИТ!', CSS.hotpink, 26);
        this.refreshAll();
        await this.delay(420);
        return;
      }
      case 'miss': {
        const v = this.viewOf(ev.target);
        Audio2.sfx('miss');
        this.popNumber(v.x, v.y - 30, 'мимо', CSS.dim, 28);
        this.tweens.add({ targets: v.obj, x: v.obj.x + 26, yoyo: true, duration: 140 });
        await this.delay(380);
        return;
      }
      case 'heal':
      case 'revive': {
        const v = this.viewOf(ev.target);
        this.fx(v.x, v.y, 'heal');
        Audio2.sfx('heal');
        this.popNumber(v.x, v.y - 30, `+${ev.amount}`, CSS.mint, 34);
        if (ev.t === 'revive') this.popNumber(v.x, v.y - 74, 'снова в строю!', CSS.mint, 22);
        this.refreshAll();
        await this.delay(380);
        return;
      }
      case 'sp': {
        const v = this.viewOf(ev.target);
        if (ev.amount > 0) this.popNumber(v.x, v.y - 10, `+${ev.amount} SP`, '#a9c1ff', 24);
        this.refreshAll();
        await this.delay(200);
        return;
      }
      case 'down': {
        const v = this.viewOf(ev.target);
        Audio2.sfx('down');
        if (v.enemy) {
          this.tweens.add({ targets: v.enemy.sprite, angle: 14, duration: 200 });
          v.enemy.sprite.setTint(0xb8a8d8);
        }
        this.popNumber(v.x, v.y - 120, 'растерян!', CSS.lilac, 24);
        await this.delay(280);
        return;
      }
      case 'stand': {
        const v = this.viewOf(ev.target);
        if (v.enemy) {
          this.tweens.add({ targets: v.enemy.sprite, angle: 0, duration: 200 });
          v.enemy.sprite.clearTint();
          await this.say(`${this.engine.get(ev.target).name} приходит в себя`, 600);
        }
        return;
      }
      case 'ko': {
        const v = this.viewOf(ev.target);
        if (v.enemy) {
          this.tweens.add({ targets: v.enemy.root, alpha: 0, scaleX: 1.4, scaleY: 0.2, duration: 450, ease: 'Cubic.In' });
          v.enemy.hitZone.disableInteractive();
          const burst = this.add.particles(v.x, v.y, 'dot', { speed: { min: 80, max: 260 }, lifespan: 600, scale: { start: 0.8, end: 0 }, tint: [0xff8fc0, 0xb79ad6, 0xffffff], blendMode: 'ADD', emitting: false });
          burst.explode(30);
          this.time.delayedCall(800, () => burst.destroy());
        } else {
          await this.say(`${this.engine.get(ev.target).name} без сил…`, 600);
        }
        this.refreshAll();
        await this.delay(300);
        return;
      }
      case 'oneMore': {
        await this.bigBanner('ЕЩЁ РАЗ!', CSS.gold);
        return;
      }
      case 'buff': {
        const v = this.viewOf(ev.target);
        Audio2.sfx('buff');
        this.popNumber(v.x, v.y - 20, ev.stat === 'atk' ? 'ATK ↑' : 'DEF ↑', CSS.gold, 24);
        await this.delay(200);
        return;
      }
      case 'weakShift': {
        const m = MOOD_INFO[ev.mood as Mood];
        await this.say(`Мелодия меняется… слабость: ${m.glyph} ${m.name}`, 1000);
        this.refreshAll();
        return;
      }
      case 'flee':
        Audio2.sfx(ev.ok ? 'confirm' : 'locked');
        await this.say(ev.ok ? 'Удалось уйти!' : 'Не получилось сбежать!', 700);
        return;
      case 'msg':
        await this.say(ev.text, 700);
        return;
    }
  }

  private async allOutCutIn() {
    const W = this.scale.width;
    const H = this.scale.height;
    Audio2.sfx('weak');
    const layer = this.add.container(0, 0).setDepth(60);
    const stripe = this.add.graphics();
    stripe.fillStyle(C.hotpink, 0.9);
    stripe.fillRect(0, H / 2 - 90, W, 180);
    stripe.fillStyle(C.night, 0.9);
    stripe.fillRect(0, H / 2 - 78, W, 156);
    layer.add(stripe);
    this.engine.party
      .filter((c) => c.hp > 0)
      .forEach((c, i, arr) => {
        const pk = `portrait_${c.defId}_${c.defId === 'miyu' ? 'angry' : 'neutral'}`;
        if (!this.textures.exists(pk)) return;
        const img = this.add.image(W / 2 + (i - (arr.length - 1) / 2) * 260, H / 2, pk);
        img.setScale(150 / img.height);
        img.setAlpha(0);
        img.x += 200;
        this.tweens.add({ targets: img, alpha: 1, x: img.x - 200, duration: 220, delay: i * 90, ease: 'Cubic.Out' });
        layer.add(img);
      });
    const t = txt(this, W / 2, H / 2 + 110, 'ФИНАЛЬНЫЙ АККОРД', 52, CSS.gold, { fontStyle: '800' }).setOrigin(0.5);
    t.setShadow(0, 0, CSS.hotpink, 20, true, true);
    layer.add(t);
    layer.setAlpha(0);
    this.tweens.add({ targets: layer, alpha: 1, duration: 120 });
    await this.delay(1000);
    this.tweens.add({ targets: layer, alpha: 0, duration: 200, onComplete: () => layer.destroy() });
    this.cameras.main.flash(300, 255, 217, 138);
    this.currentFx = 'slash';
    this.enemyViews.forEach((v) => this.fx(v.root.x, v.root.y - v.sprite.displayHeight / 2, 'fire'));
  }

  private fx(x: number, y: number, key: string) {
    const k = this.textures.exists(`fx_${key}`) ? `fx_${key}` : 'fx_slash';
    const img = this.add.image(x, y, k).setDepth(30).setBlendMode(Phaser.BlendModes.ADD);
    img.setScale(2.6).setAlpha(0);
    this.tweens.add({ targets: img, alpha: 1, scale: 3.2, duration: 120, yoyo: true, hold: 120, onComplete: () => img.destroy() });
    const small = `fx_${key}_small`;
    if (this.textures.exists(small)) {
      const s = this.add.image(x, y + 20, small).setDepth(31).setBlendMode(Phaser.BlendModes.ADD).setScale(2).setAlpha(0.9);
      this.tweens.add({ targets: s, y: y - 30, alpha: 0, duration: 500, onComplete: () => s.destroy() });
    }
  }

  private popNumber(x: number, y: number, text: string, color: string, size: number) {
    const t = txt(this, x, y, text, size, color, { fontStyle: '800' }).setOrigin(0.5).setDepth(45);
    t.setStroke('#1d1428', 6);
    t.setScale(0.5);
    this.tweens.add({ targets: t, scale: 1, duration: 140, ease: 'Back.Out' });
    this.tweens.add({ targets: t, y: y - 40, alpha: 0, delay: 500, duration: 500, onComplete: () => t.destroy() });
  }

  private say(text: string, ms: number): Promise<void> {
    const bb = this.banner.getData('bg') as Phaser.GameObjects.Graphics;
    this.bannerText.setText(text);
    const w = this.bannerText.width + 60;
    bb.clear();
    bb.fillStyle(C.night2, 0.9);
    bb.fillRoundedRect(-w / 2, -26, w, 52, 26);
    bb.lineStyle(2, C.pink, 0.6);
    bb.strokeRoundedRect(-w / 2, -26, w, 52, 26);
    this.tweens.killTweensOf(this.banner);
    this.banner.setAlpha(1);
    this.tweens.add({ targets: this.banner, alpha: 0, delay: ms, duration: 250 });
    return this.delay(Math.min(ms, 500));
  }

  private async bigBanner(text: string, color: string) {
    const W = this.scale.width;
    const H = this.scale.height;
    Audio2.sfx('weak');
    const t = txt(this, W + 200, H / 2 - 60, text, 72, color, { fontStyle: '800' }).setOrigin(0.5).setDepth(55);
    t.setStroke('#1d1428', 10);
    t.setShadow(0, 0, CSS.hotpink, 20, true, true);
    this.tweens.add({ targets: t, x: W / 2, duration: 180, ease: 'Cubic.Out' });
    await this.delay(650);
    this.tweens.add({ targets: t, x: -300, duration: 180, ease: 'Cubic.In', onComplete: () => t.destroy() });
    await this.delay(150);
  }

  private delay(ms: number) {
    return new Promise<void>((r) => this.time.delayedCall(ms, r));
  }

  // ───────────────────────── итоги ─────────────────────────
  private async finish() {
    const out = this.engine.outcome;
    this.clearMenu();
    this.engine.writeBack(State.data.party);
    if (out === 'win') await this.victory();
    else if (out === 'lose') {
      await this.say('Отряд повержен…', 1200);
      await this.delay(800);
      this.end('lose');
    } else this.end('fled');
  }

  private async victory() {
    const W = this.scale.width;
    const H = this.scale.height;
    Audio2.play(null);
    Audio2.sfx('victory');
    const defs = this.engine.enemies.map((e) => ENEMIES[e.defId]);
    const exp = defs.reduce((s, d) => s + d.exp, 0);
    const money = defs.reduce((s, d) => s + d.money, 0);
    const drops: string[] = [];
    defs.forEach((d) => d.drops?.forEach((dr) => Math.random() < dr.chance && drops.push(dr.item)));
    State.data.money += money;
    drops.forEach((i) => State.add(i));
    const ups: string[] = [];
    for (const m of State.data.party) {
      const r = addExp(m, exp);
      if (r.levels) {
        ups.push(`${MEMBERS[m.id].name} — уровень ${m.level}!`);
        r.learned.forEach((s) => ups.push(`  новый навык: «${SKILLS[s].name}»`));
      }
    }

    const layer = this.add.container(0, 0).setDepth(70);
    const shade = this.add.rectangle(0, 0, W, H, C.shadow, 0.55).setOrigin(0).setInteractive();
    const pw = 560;
    const ph = 260 + ups.length * 30 + (drops.length ? 40 : 0);
    const g = this.add.graphics({ x: W / 2 - pw / 2, y: H / 2 - ph / 2 });
    drawPanel(g, pw, ph, { radius: 26 });
    const title = txt(this, W / 2, H / 2 - ph / 2 + 30, 'ПОБЕДА ♪', 46, CSS.gold, { fontStyle: '800' }).setOrigin(0.5, 0);
    title.setShadow(0, 0, CSS.hotpink, 16, true, true);
    layer.add([shade, g, title]);
    let y = H / 2 - ph / 2 + 110;
    const line = (s: string, c: string = CSS.text) => {
      const t = txt(this, W / 2, y, s, 22, c).setOrigin(0.5, 0).setAlpha(0);
      layer.add(t);
      this.tweens.add({ targets: t, alpha: 1, duration: 300, delay: (y - (H / 2 - ph / 2 + 110)) * 3 });
      y += 34;
    };
    line(`+${exp} EXP     +${money} ¥`, CSS.text);
    if (drops.length) line(`Трофеи: ${drops.map((d) => ITEMS[d].name).join(', ')}`, CSS.caramel);
    ups.forEach((u) => line(u, CSS.mint));
    if (ups.length) this.time.delayedCall(400, () => Audio2.sfx('levelup'));
    const hint = txt(this, W / 2, H / 2 + ph / 2 - 44, 'нажми, чтобы продолжить', 18, CSS.dim).setOrigin(0.5, 0);
    layer.add(hint);
    this.tweens.add({ targets: hint, alpha: 0.4, yoyo: true, repeat: -1, duration: 600 });
    layer.setAlpha(0);
    this.tweens.add({ targets: layer, alpha: 1, duration: 250 });
    await this.delay(600);
    await new Promise<void>((r) => {
      shade.once('pointerdown', () => r());
      this.input.keyboard?.once('keydown', () => r());
      Overlay.push('BattleVictory', () => r());
    });
    Overlay.remove('BattleVictory');
    this.end('win');
  }

  private end(r: BattleResult) {
    if (this.ended) return;
    this.ended = true;
    this.cameras.main.fadeOut(300, 29, 20, 40);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      const cb = this.d.onEnd;
      this.scene.stop();
      cb(r);
    });
  }
}
