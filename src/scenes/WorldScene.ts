import Phaser from 'phaser';
import { C, CSS, TILE } from '../config';
import { MAPS } from '../data/maps';
import { DIALOGUES } from '../data/dialogues';
import { TILE_INDEX, TILE_LIST, SOLID_INDICES } from '../data/tiles';
import type { Dir, MapDef, MapObject, SaveData } from '../data/types';
import { Player } from '../entities/Player';
import { Npc } from '../entities/Npc';
import { FieldEnemy } from '../entities/FieldEnemy';
import { State } from '../systems/GameState';
import { Saves } from '../systems/SaveSystem';
import { Quests } from '../systems/QuestSystem';
import { check } from '../systems/conditions';
import { Controls } from '../systems/Controls';
import { Audio2 } from '../systems/Audio';
import { bus } from '../systems/events';
import { giveItem, type BattleResult, type WorldApi } from '../systems/Effects';
import { BIG_PROPS, bigProp } from '../art/Procedural';

const ZOOM = 1.5;

interface Interactable {
  kind: 'npc' | 'examine' | 'pickup';
  x: number;
  y: number;
  obj: MapObject;
  npc?: Npc;
  sprite?: Phaser.GameObjects.GameObject & { setVisible(v: boolean): unknown; destroy(): void };
}

type DoorObj = Extract<MapObject, { type: 'door' }>;

const px = (t: number) => (t + 0.5) * TILE;

export class WorldScene extends Phaser.Scene implements WorldApi {
  map!: MapDef;
  player!: Player;
  private npcs: { npc: Npc; obj: Extract<MapObject, { type: 'npc' }> }[] = [];
  private enemies: FieldEnemy[] = [];
  private interactables: Interactable[] = [];
  private doors: { obj: DoorObj; rect: Phaser.Geom.Rectangle }[] = [];
  private lastDoor: DoorObj | null = null;
  private busy = 0;
  private queue: string[] = [];
  private bubble!: Phaser.GameObjects.Container;
  private focus: Interactable | null = null;
  private wallLayer!: Phaser.Tilemaps.TilemapLayer;
  private initData: { map?: string; spawn?: string; fromSave?: boolean } = {};
  private offs: (() => void)[] = [];

  constructor() {
    super('World');
  }

  init(data: { map?: string; spawn?: string; fromSave?: boolean }) {
    this.initData = data ?? {};
    this.npcs = [];
    this.enemies = [];
    this.interactables = [];
    this.doors = [];
    this.lastDoor = null;
    this.busy = 0;
    this.queue = [];
    this.focus = null;
  }

  create() {
    const d = this.initData;
    const mapId = d.map ?? State.data.map ?? 'apartment';
    this.map = MAPS[mapId] ?? MAPS.apartment;
    State.data.map = this.map.id;
    Controls.reset();

    this.buildTiles();
    this.buildObjects();
    this.placePlayer(d);
    this.buildAtmosphere();

    // камера
    const mw = this.map.rows[0].length * TILE;
    const mh = this.map.rows.length * TILE;
    const cam = this.cameras.main;
    cam.setZoom(ZOOM);
    const vw = this.scale.width / ZOOM;
    const vh = this.scale.height / ZOOM;
    cam.setBounds(Math.min(0, (mw - vw) / 2), Math.min(0, (mh - vh) / 2), Math.max(mw, vw), Math.max(mh, vh));
    cam.startFollow(this.player, true, 0.12, 0.12, 0, 20);
    cam.setBackgroundColor(C.night);
    cam.fadeIn(350, 29, 20, 40);
    this.physics.world.setBounds(0, 0, mw, mh);

    // HUD
    if (!this.scene.isActive('Hud')) this.scene.launch('Hud');
    this.scene.bringToTop('Hud');
    bus.emit('hud-visible', true);
    bus.emit('location', this.map.name);

    this.playMusic();

    this.offs.push(bus.on('back-base', () => this.busy === 0 && this.openMenu()));
    this.offs.push(bus.on('autosave', () => this.autosave()));
    this.offs.push(bus.on('queue-dialogue', (id: string) => this.queue.push(id)));
    this.offs.push(bus.on('music-changed', () => this.playMusic()));
    this.events.once('shutdown', () => {
      this.offs.forEach((f) => f());
      this.offs = [];
    });

    Quests.notify({ type: 'enter', map: this.map.id });
    if (!d.fromSave) this.autosave();
    if (this.map.onEnter && check(this.map.onEnter.cond)) {
      this.busy++;
      this.time.delayedCall(450, () => {
        this.busy--;
        this.runDialogue(this.map.onEnter!.dialogue);
      });
    }
  }

  playMusic() {
    Audio2.play(State.data.track ?? this.map.music);
  }

  // ─────────────────────────── построение карты ───────────────────────────
  private buildTiles() {
    const m = this.map;
    const floorIdx = TILE_INDEX[m.floor];
    const ground: number[][] = [];
    const objs: number[][] = [];
    m.rows.forEach((row) => {
      const g: number[] = [];
      const o: number[] = [];
      for (const ch of row) {
        const i = TILE_INDEX[ch] ?? 0;
        if (TILE_LIST[i].solid) {
          g.push(floorIdx);
          o.push(i);
        } else {
          g.push(i);
          o.push(-1);
        }
      }
      ground.push(g);
      objs.push(o);
    });
    const gm = this.make.tilemap({ data: ground, tileWidth: TILE, tileHeight: TILE });
    const gts = gm.addTilesetImage('tileset', 'tileset', TILE, TILE, 0, 0)!;
    gm.createLayer(0, gts, 0, 0)!.setDepth(-10);
    const om = this.make.tilemap({ data: objs, tileWidth: TILE, tileHeight: TILE });
    const ots = om.addTilesetImage('tileset', 'tileset', TILE, TILE, 0, 0)!;
    this.wallLayer = om.createLayer(0, ots, 0, 0)!.setDepth(-5);
    this.wallLayer.setCollision(SOLID_INDICES);

    // составная мебель: одна картинка на прямоугольную область одинаковых символов
    const seen = new Set<string>();
    m.rows.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (!BIG_PROPS.has(ch) || seen.has(`${x},${y}`)) return;
        let w = 0;
        while (row[x + w] === ch) w++;
        let h = 0;
        while (m.rows[y + h] && [...m.rows[y + h].slice(x, x + w)].every((c) => c === ch)) h++;
        for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) seen.add(`${x + xx},${y + yy}`);
        const key = bigProp(this, ch, w, h);
        this.add.image(x * TILE, y * TILE - 16, key).setOrigin(0).setDepth((y + h) * TILE - 8);
      }),
    );

    // высокие объекты и окна домов
    const rnd = new Phaser.Math.RandomDataGenerator([m.id]);
    const win = this.add.graphics().setDepth(-4);
    let vend = 0;
    m.rows.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        const bx = px(x);
        const by = (y + 1) * TILE;
        if (ch === 'L') this.add.image(bx, by - 2, 'prop_lamp').setOrigin(0.5, 1).setDepth(by - 2);
        if (ch === 'V') this.add.image(bx, by - 2, vend++ % 2 ? 'prop_vending2' : 'prop_vending').setOrigin(0.5, 1).setDepth(by - 2);
        if (ch === 'T') this.add.image(bx, by - 2, 'prop_sakura').setOrigin(0.5, 1).setDepth(by - 2);
        if (ch === 'H' && y > 0 && rnd.frac() < 0.35) {
          const c = rnd.pick([0xffd98a, 0xff8fc0, 0xfff3dc, 0x8fd3c7]);
          win.fillStyle(c, 0.85);
          win.fillRoundedRect(x * TILE + 12, y * TILE + 10, 24, 18, 3);
          win.fillStyle(0x3a2b4d, 1);
          win.fillRect(x * TILE + 23, y * TILE + 10, 2, 18);
        }
        const light = TILE_LIST[TILE_INDEX[ch]]?.light;
        if (light && (ch !== 'O' || rnd.frac() < 0.6)) this.addLight(bx, y * TILE + TILE / 2 + (light.dy ?? 0), light.r, light.color, light.alpha ?? 0.4);
      }),
    );
  }

  private buildObjects() {
    for (const o of this.map.objects) {
      switch (o.type) {
        case 'door': {
          const w = (o.w ?? 1) * TILE;
          const h = (o.h ?? 1) * TILE;
          this.doors.push({ obj: o, rect: new Phaser.Geom.Rectangle(o.x * TILE, o.y * TILE, w, h) });
          break;
        }
        case 'npc': {
          const npc = new Npc(this, px(o.x), (o.y + 1) * TILE - 4, o.sprite, o.facing, o.wander, o.scale ?? 1, o.glow);
          this.npcs.push({ npc, obj: o });
          this.interactables.push({ kind: 'npc', x: npc.x, y: npc.y - 20, obj: o, npc });
          break;
        }
        case 'examine':
          this.interactables.push({ kind: 'examine', x: px(o.x), y: px(o.y), obj: o });
          break;
        case 'pickup': {
          const s = this.add.container(px(o.x), px(o.y));
          const glow = this.add.image(0, 0, 'glow').setTint(0xffd98a).setBlendMode(Phaser.BlendModes.ADD).setScale(0.5).setAlpha(0.7);
          const sp = this.add.image(0, 0, 'sparkle').setScale(0.9);
          s.add([glow, sp]);
          s.setDepth(px(o.y));
          this.tweens.add({ targets: sp, angle: 90, scale: 0.6, yoyo: true, repeat: -1, duration: 700 });
          this.tweens.add({ targets: glow, alpha: 0.3, yoyo: true, repeat: -1, duration: 900 });
          this.interactables.push({ kind: 'pickup', x: s.x, y: s.y, obj: o, sprite: s });
          break;
        }
        case 'enemy': {
          if (State.isCleared(o.id) || !check(o.cond)) break;
          const e = new FieldEnemy(this, px(o.x), (o.y + 1) * TILE - 6, o.kind, o.id, o.group, o.radius);
          this.enemies.push(e);
          break;
        }
        case 'sign': {
          const t = this.add
            .text(px(o.x), o.y * TILE, o.text, { fontFamily: 'Nunito', fontSize: `${o.size ?? 18}px`, fontStyle: '800', color: o.color ?? CSS.pink })
            .setOrigin(0.5)
            .setDepth(20003)
            .setResolution(2);
          t.setShadow(0, 0, o.color ?? CSS.pink, 12, true, true);
          this.tweens.add({ targets: t, alpha: 0.75, yoyo: true, repeat: -1, duration: 1600 + Math.random() * 800, ease: 'Sine.InOut' });
          break;
        }
        case 'light':
          this.addLight(px(o.x), px(o.y), o.r ?? 120, o.color ?? 0xffc98a, o.alpha ?? 0.4);
          break;
      }
    }
    this.refreshObjects();
  }

  /** Перепроверить условия появления объектов (после диалогов и событий). */
  refreshObjects() {
    for (const { npc, obj } of this.npcs) {
      const on = check(obj.cond);
      npc.setVisible(on).setActive(on);
      npc.body.enable = on;
    }
    for (const it of this.interactables) {
      if (it.kind === 'pickup' && it.obj.type === 'pickup') {
        const on = !State.flag(`got_${it.obj.id}`) && check(it.obj.cond);
        it.sprite?.setVisible(on);
      }
    }
    for (const e of [...this.enemies]) {
      if (State.isCleared(e.id)) {
        e.destroy();
        this.enemies.splice(this.enemies.indexOf(e), 1);
      }
    }
  }

  private isAvailable(it: Interactable): boolean {
    if (it.kind === 'npc') return !!it.npc?.active;
    if (it.kind === 'pickup' && it.obj.type === 'pickup') return !State.flag(`got_${it.obj.id}`) && check(it.obj.cond);
    if (it.obj.type === 'examine') return check(it.obj.cond);
    return true;
  }

  private placePlayer(d: { spawn?: string; fromSave?: boolean }) {
    let x = px(4);
    let y = px(4);
    let facing: Dir = 'down';
    const spawnId = d.spawn ?? (State.data.x < 0 ? 'start' : undefined);
    const sp = spawnId ? this.map.objects.find((o) => o.type === 'spawn' && o.id === spawnId) : undefined;
    if (sp && sp.type === 'spawn') {
      x = px(sp.x);
      y = (sp.y + 1) * TILE - 6;
      facing = sp.facing ?? 'down';
    } else if (State.data.x >= 0) {
      x = State.data.x;
      y = State.data.y;
      facing = State.data.facing;
    }
    this.player = new Player(this, x, y);
    this.player.face(facing);
    this.physics.add.collider(this.player, this.wallLayer);
    for (const { npc } of this.npcs) {
      this.physics.add.collider(this.player, npc);
      this.physics.add.collider(npc, this.wallLayer);
    }
    for (const e of this.enemies) this.physics.add.collider(e, this.wallLayer);

    this.bubble = this.add.container(0, 0).setDepth(30000).setVisible(false);
    const bg = this.add.graphics();
    bg.fillStyle(C.cream, 0.95);
    bg.fillRoundedRect(-18, -16, 36, 28, 12);
    bg.fillTriangle(-5, 11, 5, 11, 0, 18);
    const dots = this.add.text(0, -3, '…', { fontFamily: 'Nunito', fontSize: '22px', color: '#5b3a6e', fontStyle: '800' }).setOrigin(0.5).setResolution(2);
    this.bubble.add([bg, dots]);
    this.tweens.add({ targets: [bg, dots], y: '-=5', yoyo: true, repeat: -1, duration: 500, ease: 'Sine.InOut' });
  }

  // ─────────────────────────── атмосфера ───────────────────────────
  private lightLayer: Phaser.GameObjects.Image[] = [];

  private addLight(x: number, y: number, r: number, color: number, alpha: number) {
    const l = this.add.image(x, y, 'glow').setTint(color).setBlendMode(Phaser.BlendModes.ADD).setScale((r * 2) / 128).setAlpha(alpha).setDepth(20002);
    this.lightLayer.push(l);
    this.tweens.add({ targets: l, alpha: alpha * 0.8, yoyo: true, repeat: -1, duration: 1800 + Math.random() * 1500, ease: 'Sine.InOut' });
  }

  private buildAtmosphere() {
    const m = this.map;
    const mw = m.rows[0].length * TILE;
    const mh = m.rows.length * TILE;
    // ночное затемнение поверх мира, свет — поверх затемнения
    this.add.rectangle(-400, -400, mw + 800, mh + 800, m.ambient.color, m.ambient.alpha).setOrigin(0).setDepth(20000);
    const p = m.particles;
    if (p === 'petals') {
      this.add.particles(0, 0, 'petal', {
        x: { min: 0, max: mw },
        y: { min: -20, max: mh * 0.3 },
        lifespan: 8000,
        speedY: { min: 25, max: 50 },
        speedX: { min: -40, max: -10 },
        rotate: { min: 0, max: 360 },
        scale: { min: 0.8, max: 1.5 },
        alpha: { start: 0.9, end: 0 },
        frequency: 260,
      }).setDepth(20001);
    } else if (p === 'dust' || p === 'fireflies') {
      this.add.particles(0, 0, 'dot', {
        x: { min: 0, max: mw },
        y: { min: 0, max: mh },
        lifespan: 5000,
        speed: { min: 4, max: 14 },
        scale: { min: 0.2, max: p === 'fireflies' ? 0.7 : 0.4 },
        alpha: { start: 0, end: 0, ease: 'Sine.InOut', steps: 0 } as any,
        tint: p === 'fireflies' ? [0xff8fc0, 0xb06bff, 0xffd98a] : [0xfff3dc],
        blendMode: 'ADD',
        frequency: p === 'fireflies' ? 120 : 260,
        emitCallback: (pt: Phaser.GameObjects.Particles.Particle) => {
          this.tweens.add({ targets: pt, alpha: p === 'fireflies' ? 0.9 : 0.4, yoyo: true, duration: 2400 });
        },
      } as any).setDepth(20001);
    } else if (p === 'stars') {
      const g = this.add.graphics().setDepth(-4);
      const r = new Phaser.Math.RandomDataGenerator(['stars']);
      m.rows.forEach((row, y) =>
        [...row].forEach((ch, x) => {
          if (ch !== '~') return;
          for (let i = 0; i < 2; i++) {
            g.fillStyle(r.pick([0xffd98a, 0xff8fc0, 0xfff3dc]), 0.8);
            g.fillRect(x * TILE + r.between(2, 44), y * TILE + r.between(2, 44), 2, 2);
          }
        }),
      );
      this.tweens.add({ targets: g, alpha: 0.6, yoyo: true, repeat: -1, duration: 1300 });
    }
  }

  // ─────────────────────────── цикл ───────────────────────────
  update(_t: number, dtMs: number) {
    const dt = Math.min(dtMs, 50) / 1000;
    if (!this.player) return;
    State.data.playTime += dtMs / 1000;
    const frozen = this.busy > 0;

    if (frozen) {
      this.player.halt();
      Controls.consumeInteract();
      Controls.consumeMenu();
    } else {
      this.player.move(Controls.vector(), Controls.isRunning(), dt);
      if (Controls.consumeMenu()) this.openMenu();
    }
    this.player.shadow.setPosition(this.player.x, this.player.y - 2).setDepth(this.player.y - 1);

    for (const { npc } of this.npcs) if (npc.active) npc.update(dtMs, frozen);
    for (const e of this.enemies) e.update(dtMs, this.player.x, this.player.y, frozen);

    if (!frozen) {
      this.updateFocus();
      if (Controls.consumeInteract() && this.focus) this.interact(this.focus);
      this.checkDoors();
      this.checkEnemies();
      if (this.queue.length) this.runDialogue(this.queue.shift()!);
    } else {
      this.bubble.setVisible(false);
    }

  }

  private updateFocus() {
    const fp = this.player.frontPoint(30);
    let best: Interactable | null = null;
    let bestD = 62;
    for (const it of this.interactables) {
      if (!this.isAvailable(it)) continue;
      const tx = it.npc ? it.npc.x : it.x;
      const ty = it.npc ? it.npc.y - 16 : it.y;
      const d = Phaser.Math.Distance.Between(fp.x, fp.y, tx, ty);
      const reach = it.kind === 'examine' ? 56 : 62;
      if (d < bestD && d < reach) {
        best = it;
        bestD = d;
      }
    }
    // особый случай: продавщица за прилавком (дальше обычного)
    this.focus = best;
    bus.emit('interact-hint', !!best);
    if (best) {
      const bx = best.npc ? best.npc.x : best.x;
      const by = best.npc ? best.npc.y - (best.npc.isSheet ? 84 : 86) : best.y - 40;
      this.bubble.setVisible(true);
      this.bubble.setPosition(bx, by);
    } else this.bubble.setVisible(false);
  }

  private interact(it: Interactable) {
    if (it.kind === 'npc' && it.npc && it.obj.type === 'npc') {
      const n = it.npc;
      n.faceToward(this.player.x, this.player.y);
      n.bounce();
      this.facePlayerTo(n.x, n.y);
      Audio2.sfx('click');
      this.runDialogue(it.obj.dialogue);
    } else if (it.kind === 'examine' && it.obj.type === 'examine') {
      Audio2.sfx('click');
      this.runDialogue(it.obj.dialogue);
    } else if (it.kind === 'pickup' && it.obj.type === 'pickup') {
      const o = it.obj;
      State.setFlag(`got_${o.id}`);
      if (it.sprite) {
        const s = it.sprite as unknown as Phaser.GameObjects.Container;
        this.tweens.add({ targets: s, y: s.y - 20, alpha: 0, duration: 300, onComplete: () => s.setVisible(false).setAlpha(1).setY(it.y) });
      }
      giveItem(o.item, o.n ?? 1);
      if (o.startQuest && !State.data.quests[o.startQuest]) Quests.start(o.startQuest);
      if (o.dialogue) this.runDialogue(o.dialogue);
      this.refreshObjects();
    }
  }

  private facePlayerTo(x: number, y: number) {
    const dx = x - this.player.x;
    const dy = y - this.player.y;
    this.player.face(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down');
  }

  private checkDoors() {
    const fx = this.player.x;
    const fy = this.player.y - 6;
    const hit = this.doors.find((d) => d.rect.contains(fx, fy));
    if (!hit) {
      this.lastDoor = null;
      return;
    }
    if (this.lastDoor === hit.obj) return;
    this.lastDoor = hit.obj;
    const o = hit.obj;
    if (!check(o.cond)) {
      Audio2.sfx('locked');
      // отталкиваем от двери
      const cx = hit.rect.centerX;
      const cy = hit.rect.centerY;
      const v = new Phaser.Math.Vector2(this.player.x - cx, this.player.y - cy).normalize().scale(18);
      this.player.setPosition(this.player.x + v.x, this.player.y + v.y);
      if (o.locked) this.runDialogue(o.locked);
      return;
    }
    this.goTo(o.to, o.spawn, o.sfx);
  }

  goTo(map: string, spawn: string, sfx?: string) {
    this.busy++;
    Audio2.sfx((sfx as any) ?? 'door');
    bus.emit('interact-hint', false);
    this.cameras.main.fadeOut(260, 29, 20, 40);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      State.data.x = -1;
      this.scene.restart({ map, spawn });
    });
  }

  private checkEnemies() {
    if (this.time.now < this.player.invulnUntil) return;
    for (const e of this.enemies) {
      if (this.time.now < e.stunnedUntil) continue;
      if (Phaser.Math.Distance.Between(e.x, e.y, this.player.x, this.player.y) < 38) {
        this.encounter(e);
        return;
      }
    }
  }

  private async encounter(e: FieldEnemy) {
    this.busy++;
    const res = await this.battle(e.group, { bg: this.map.battleBg });
    this.busy--;
    if (res === 'win') {
      State.clear(e.id);
      this.tweens.add({ targets: e, alpha: 0, scale: 1.4, duration: 300, onComplete: () => this.refreshObjects() });
      this.autosave();
    } else if (res === 'fled') {
      e.stun(2600);
      this.player.invulnUntil = this.time.now + 1800;
    } else {
      this.gameOver();
    }
  }

  // ─────────────────────────── диалоги и оверлеи ───────────────────────────
  runDialogue(id: string): Promise<void> {
    if (!DIALOGUES[id]) {
      console.warn('Нет диалога', id);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.busy++;
      bus.emit('hud-visible', false);
      this.scene.launch('Dialogue', {
        id,
        api: this,
        onDone: () => {
          this.busy--;
          if (this.busy === 0) bus.emit('hud-visible', true);
          this.refreshObjects();
          resolve();
        },
      });
      this.scene.bringToTop('Dialogue');
    });
  }

  openMenu(tab?: string): Promise<void> {
    return new Promise((resolve) => {
      this.busy++;
      bus.emit('hud-visible', false);
      Audio2.sfx('confirm');
      this.scene.launch('GameMenu', {
        tab,
        world: this,
        onClose: () => {
          this.busy--;
          if (this.busy === 0) bus.emit('hud-visible', true);
          this.refreshObjects();
          resolve();
        },
      });
      this.scene.bringToTop('GameMenu');
    });
  }

  // ─────────────────────────── WorldApi ───────────────────────────
  battle(group: string[], opts: { bg?: string; boss?: boolean; music?: string; noFlee?: boolean }): Promise<BattleResult> {
    return new Promise((resolve) => {
      this.busy++;
      bus.emit('hud-visible', false);
      bus.emit('dialogue-visible', false);
      Audio2.sfx('encounter');
      this.cameras.main.shake(300, 0.006);
      this.cameras.main.flash(250, 255, 143, 192);
      this.time.delayedCall(380, () => {
        this.scene.launch('Battle', {
          group,
          bg: opts.bg ?? this.map.battleBg,
          boss: opts.boss,
          music: opts.music ?? (opts.boss ? 'boss' : 'battle'),
          noFlee: opts.noFlee,
          onEnd: (r: BattleResult) => {
            this.scene.resume();
            this.busy--;
            bus.emit('dialogue-visible', true);
            if (this.busy === 0) bus.emit('hud-visible', true);
            if (r !== 'lose') this.playMusic();
            Quests.notify({ type: 'win', tag: group.join('+') });
            resolve(r);
          },
        });
        this.scene.bringToTop('Battle');
        this.scene.pause();
      });
    });
  }

  shop(id: string): Promise<void> {
    return this.overlay('Shop', { id });
  }

  cassettePlayer(): Promise<void> {
    return this.openMenu('cassettes');
  }

  save(): Promise<void> {
    this.syncPosition();
    return this.overlay('SaveLoad', { mode: 'save' });
  }

  ending(): Promise<void> {
    return this.overlay('Ending', {});
  }

  private overlay(key: string, data: object): Promise<void> {
    return new Promise((resolve) => {
      this.busy++;
      bus.emit('hud-visible', false);
      this.scene.launch(key, {
        ...data,
        onClose: () => {
          this.busy--;
          if (this.busy === 0) bus.emit('hud-visible', true);
          this.refreshObjects();
          resolve();
        },
      });
      this.scene.bringToTop(key);
    });
  }

  async sleep(): Promise<void> {
    this.busy++;
    const cam = this.cameras.main;
    cam.fadeOut(600, 10, 6, 18);
    await this.wait(900);
    State.healAll();
    // шумы возвращаются
    const respawn = new Set(Object.values(MAPS).flatMap((m) => m.objects.filter((o) => o.type === 'enemy' && o.respawn).map((o) => (o as { id: string }).id)));
    State.data.cleared = State.data.cleared.filter((id) => !respawn.has(id));
    Audio2.sfx('heal');
    cam.fadeIn(800, 10, 6, 18);
    await this.wait(400);
    this.autosave();
    this.busy--;
  }

  wait(ms: number): Promise<void> {
    return new Promise((r) => this.time.delayedCall(ms, r));
  }

  gameOver() {
    this.busy++;
    this.scene.launch('GameOver');
    this.scene.bringToTop('GameOver');
  }

  syncPosition() {
    if (!this.player) return;
    State.data.map = this.map.id;
    State.data.x = Math.round(this.player.x);
    State.data.y = Math.round(this.player.y);
    State.data.facing = this.player.facing;
  }

  autosave() {
    if (!this.player) return;
    this.syncPosition();
    const snapshot: SaveData = JSON.parse(JSON.stringify(State.data));
    Saves.save('auto', snapshot).catch((e) => console.warn('autosave', e));
  }

  /** Выйти в главное меню. */
  quitToMenu() {
    this.scene.stop('Hud');
    this.scene.stop('Dialogue');
    this.scene.start('Menu');
  }
}
