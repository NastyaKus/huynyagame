import Phaser from 'phaser';
import { C, CSS, MOOD_INFO } from '../config';
import { ITEMS, CASSETTE_IDS } from '../data/items';
import { MEMBERS, expToNext } from '../data/party';
import { SKILLS } from '../data/skills';
import { QUESTS, QUEST_ORDER } from '../data/quests';
import { TRACKS } from '../data/tracks';
import { DIALOGUES } from '../data/dialogues';
import { MAPS } from '../data/maps';
import type { ItemDef, MemberState } from '../data/types';
import { State, memberStats, memberSkills } from '../systems/GameState';
import { Quests } from '../systems/QuestSystem';
import { Audio2 } from '../systems/Audio';
import { bus } from '../systems/events';
import { Overlay } from '../systems/Overlay';
import { Button, ListView, bar, dim, drawPanel, itemIcon, rowBg, txt, panel } from '../ui/widgets';
import type { WorldScene } from './WorldScene';

type Tab = 'items' | 'cassettes' | 'quests' | 'party';

const TABS: { id: Tab | 'save' | 'settings' | 'exit'; label: string }[] = [
  { id: 'items', label: 'Предметы' },
  { id: 'cassettes', label: 'Кассеты' },
  { id: 'quests', label: 'Квесты' },
  { id: 'party', label: 'Отряд' },
  { id: 'save', label: 'Сохранить' },
  { id: 'settings', label: 'Настройки' },
  { id: 'exit', label: 'В главное меню' },
];

export class GameMenuScene extends Phaser.Scene {
  private world!: WorldScene;
  private onClose!: () => void;
  private tab: Tab = 'items';
  private tabBtns: Partial<Record<string, Button>> = {};
  private content!: Phaser.GameObjects.Container;
  private modal: Phaser.GameObjects.Container | null = null;
  private selected: string | null = null;
  private header!: Phaser.GameObjects.Text;
  private cx = 0;
  private cw = 0;
  private ch = 0;

  constructor() {
    super('GameMenu');
  }

  init(d: { tab?: Tab; world: WorldScene; onClose: () => void }) {
    this.world = d.world;
    this.onClose = d.onClose;
    this.tab = d.tab ?? 'items';
    this.selected = null;
    this.modal = null;
    this.tabBtns = {};
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    dim(this, 0.6);
    const left = panel(this, 24, 24, 250, H - 48, { radius: 24 });
    left.setAlpha(0.98);
    txt(this, 48, 44, 'Меню', 30, CSS.pink, { fontStyle: '800' });
    TABS.forEach((t, i) => {
      const b = new Button(this, 149, 120 + i * 66, 210, 54, t.label, () => this.onTab(t.id), { size: 21, align: 'left' });
      this.tabBtns[t.id] = b;
    });
    this.cx = 300;
    this.cw = W - this.cx - 24;
    this.ch = H - 48;
    const cp = panel(this, this.cx, 24, this.cw, this.ch, { radius: 24 });
    cp.setAlpha(0.98);
    this.header = txt(this, this.cx + 28, 42, '', 26, CSS.text, { fontStyle: '800' });
    const money = txt(this, W - 110, 44, '', 22, CSS.gold, { fontStyle: '800' }).setOrigin(1, 0);
    const time = Math.floor(State.data.playTime / 60);
    money.setText(`¥ ${State.data.money.toLocaleString('ru-RU')}   ⏱ ${Math.floor(time / 60)}:${String(time % 60).padStart(2, '0')}`);
    this.content = this.add.container(0, 0);
    new Button(this, W - 60, 60, 60, 54, '✕', () => this.close(), { size: 24 });

    Overlay.push('GameMenu', () => (this.modal ? this.closeModal() : this.close()));
    this.events.once('shutdown', () => Overlay.remove('GameMenu'));
    this.input.keyboard?.on('keydown-M', () => this.close());
    this.render();
  }

  private onTab(id: string) {
    if (id === 'save') {
      this.world.syncPosition();
      this.scene.launch('SaveLoad', { mode: 'save', onClose: () => {} });
      this.scene.bringToTop('SaveLoad');
      return;
    }
    if (id === 'settings') {
      this.scene.launch('Settings');
      this.scene.bringToTop('Settings');
      return;
    }
    if (id === 'exit') {
      this.confirm('Выйти в главное меню? Прогресс сохранится в автосейв.', () => {
        this.world.autosave();
        this.scene.stop();
        this.world.quitToMenu();
      });
      return;
    }
    this.tab = id as Tab;
    this.selected = null;
    this.render();
  }

  close() {
    Audio2.sfx('cancel');
    this.scene.stop();
    this.onClose();
  }

  private render() {
    this.content.removeAll(true);
    Object.entries(this.tabBtns).forEach(([id, b]) => b?.setSelected(id === this.tab));
    const titles: Record<Tab, string> = { items: 'Предметы', cassettes: 'Кассеты', quests: 'Журнал квестов', party: 'Отряд' };
    this.header.setText(titles[this.tab]);
    if (this.tab === 'items') this.renderItems();
    if (this.tab === 'cassettes') this.renderCassettes();
    if (this.tab === 'quests') this.renderQuests();
    if (this.tab === 'party') this.renderParty();
  }

  // ───────────── предметы ─────────────
  private renderItems() {
    const listW = Math.min(520, this.cw * 0.52);
    const list = new ListView(this, this.cx + 20, 96, listW, this.ch - 92, 66);
    const items = State.items().filter((e) => e.def.kind !== 'cassette');
    if (!this.selected && items.length) this.selected = items[0].def.id;
    list.setRows(
      items.map(({ def, n }) => ({
        render: (c, w, h) => {
          c.add(rowBg(this, w, h, def.id === this.selected));
          c.add(itemIcon(this, 32, h / 2, def.icon, 40));
          c.add(txt(this, 64, h / 2, def.name, 20, CSS.text).setOrigin(0, 0.5));
          const worn = State.data.party.some((m) => m.equip.accessory === def.id || m.equip.armor === def.id);
          c.add(txt(this, w - 16, h / 2, worn ? `E ×${n}` : `×${n}`, 19, worn ? CSS.mint : CSS.dim).setOrigin(1, 0.5));
        },
        onTap: () => {
          this.selected = def.id;
          this.render();
        },
      })),
    );
    this.content.add(list);
    if (!items.length) this.content.add(txt(this, this.cx + 40, 120, 'Карманы пусты.', 22, CSS.dim));

    const def = this.selected ? ITEMS[this.selected] : null;
    if (!def) return;
    const dx = this.cx + listW + 44;
    const dw = this.cw - listW - 64;
    const g = this.add.graphics({ x: dx, y: 96 });
    drawPanel(g, dw, this.ch - 92, { fill: C.plum, alpha: 0.6, radius: 18, shadow: false });
    this.content.add(g);
    this.content.add(itemIcon(this, dx + dw / 2, 160, def.icon, 80));
    this.content.add(txt(this, dx + dw / 2, 220, def.name, 24, CSS.pink, { fontStyle: '800', align: 'center', wordWrap: { width: dw - 30 } }).setOrigin(0.5, 0));
    const kindName: Record<string, string> = { consumable: 'расходник', key: 'ключевой предмет', note: 'записка', equip: def.slot === 'armor' ? 'одежда' : 'аксессуар', cassette: 'кассета' };
    this.content.add(txt(this, dx + dw / 2, 256, kindName[def.kind], 16, CSS.dim).setOrigin(0.5, 0));
    this.content.add(txt(this, dx + 22, 296, def.desc, 19, CSS.text, { wordWrap: { width: dw - 44 }, lineSpacing: 6, fontStyle: '600' }));

    const by = this.ch - 20;
    if (def.kind === 'consumable' && def.field) this.content.add(new Button(this, dx + dw / 2, by, dw - 40, 56, 'Использовать', () => this.useItem(def)));
    if (def.kind === 'note') this.content.add(new Button(this, dx + dw / 2, by, dw - 40, 56, 'Читать', () => this.readNote(def)));
    if (def.kind === 'equip') this.content.add(new Button(this, dx + dw / 2, by, dw - 40, 56, 'Надеть', () => this.equipItem(def)));
  }

  private useItem(def: ItemDef) {
    const e = def.effect!;
    const apply = (m: MemberState) => {
      const s = memberStats(m);
      if (e.revive) m.hp = Math.max(m.hp, Math.round(s.maxHp * e.revive));
      m.hp = Math.min(s.maxHp, m.hp + (e.hp ?? 0) + Math.round((e.hpPct ?? 0) * s.maxHp));
      m.sp = Math.min(s.maxSp, m.sp + (e.sp ?? 0));
    };
    const finish = () => {
      State.remove(def.id);
      Audio2.sfx('heal');
      if (!State.has(def.id)) this.selected = null;
      this.closeModal();
      this.render();
    };
    if (e.all) {
      State.data.party.forEach(apply);
      finish();
      return;
    }
    this.pickMember(`Кому: ${def.name}?`, (m) => {
      apply(m);
      finish();
    });
  }

  private equipItem(def: ItemDef) {
    this.pickMember(`Кто наденет «${def.name}»?`, (m) => {
      const slot = def.slot!;
      if (State.freeCount(def.id) <= 0) {
        // снять с другого члена отряда
        const other = State.data.party.find((p) => p.equip[slot] === def.id);
        if (other) State.equip(other.id, null, slot);
      }
      State.equip(m.id, def.id, slot);
      Audio2.sfx('buff');
      this.closeModal();
      this.render();
    });
  }

  private readNote(def: ItemDef) {
    const W = this.scale.width;
    const H = this.scale.height;
    this.openModal((m) => {
      const w = Math.min(760, W - 120);
      const h = H - 140;
      const g = this.add.graphics({ x: W / 2 - w / 2, y: 70 });
      drawPanel(g, w, h, { fill: 0xf6e7ee, alpha: 0.98, stroke: C.rose, radius: 20 });
      m.add(g);
      m.add(txt(this, W / 2, 100, def.name, 26, '#5b3a6e', { fontStyle: '800' }).setOrigin(0.5, 0));
      m.add(txt(this, W / 2 - w / 2 + 40, 160, def.text ?? '', 21, '#3d2850', { wordWrap: { width: w - 80 }, lineSpacing: 10, fontStyle: '600' }));
      m.add(new Button(this, W / 2, 70 + h - 50, 220, 54, 'Закрыть', () => this.closeModal()));
    });
  }

  // ───────────── кассеты ─────────────
  private renderCassettes() {
    const hasPlayer = State.has('walkman');
    const listW = this.cw - 40;
    const playing = State.data.track;
    const top = 150;
    this.content.add(
      txt(this, this.cx + 28, 96, hasPlayer ? `Найдено ${State.cassettes().length} из ${CASSETTE_IDS.length}. Нажми, чтобы слушать.` : 'Нужен плеер. Он лежит на столе в квартире.', 19, CSS.dim, { fontStyle: '600' }),
    );
    const list = new ListView(this, this.cx + 20, top, listW, this.ch - top - 30, 74);
    list.setRows(
      CASSETTE_IDS.map((id, i) => {
        const def = ITEMS[id];
        const got = State.has(id);
        const isPlaying = playing === def.track;
        return {
          render: (c, w, h) => {
            c.add(rowBg(this, w, h, isPlaying));
            c.add(txt(this, 20, h / 2, `${String(i + 1).padStart(2, '0')}`, 20, CSS.dim).setOrigin(0, 0.5));
            if (got) c.add(itemIcon(this, 80, h / 2, def.icon, 46));
            c.add(txt(this, 120, h / 2 - 12, got ? def.name : '— не найдена —', 21, got ? CSS.text : CSS.dim).setOrigin(0, 0.5));
            c.add(txt(this, 120, h / 2 + 14, got ? def.desc : 'Где-то в районе…', 15, CSS.dim, { fontStyle: '600' }).setOrigin(0, 0.5));
            if (isPlaying) {
              const note = txt(this, w - 30, h / 2, '♪', 30, CSS.hotpink).setOrigin(0.5);
              c.add(note);
              this.tweens.add({ targets: note, y: h / 2 - 6, yoyo: true, repeat: -1, duration: 300 });
            }
          },
          onTap: got && hasPlayer ? () => this.playCassette(id) : undefined,
        };
      }),
    );
    this.content.add(list);
    if (playing) this.content.add(new Button(this, this.cx + this.cw - 150, 104, 240, 50, '■ Выключить плеер', () => this.stopCassette(), { size: 19 }));
  }

  private playCassette(id: string) {
    const def = ITEMS[id];
    State.data.track = def.track!;
    Audio2.sfx('cassette');
    bus.emit('music-changed');
    Audio2.play(def.track!);
    bus.emit('toast', `♪ ${TRACKS[def.track!]?.title ?? def.name}`, 'cassette');
    Quests.notify({ type: 'listen', cassette: id });
    const reaction = `listen_${id}`;
    if (DIALOGUES[reaction] && !State.flag(`heard_${id}`)) {
      State.setFlag(`heard_${id}`);
      bus.emit('queue-dialogue', reaction);
      this.close();
      return;
    }
    this.render();
  }

  private stopCassette() {
    State.data.track = null;
    Audio2.play(MAPS[State.data.map]?.music ?? null);
    this.render();
  }

  // ───────────── квесты ─────────────
  private renderQuests() {
    const ids = QUEST_ORDER.filter((id) => State.data.quests[id]).sort((a, b) => Number(State.data.quests[a].done) - Number(State.data.quests[b].done));
    if (!this.selected && ids.length) this.selected = ids[0];
    const listW = Math.min(440, this.cw * 0.45);
    const list = new ListView(this, this.cx + 20, 96, listW, this.ch - 92, 70);
    list.setRows(
      ids.map((id) => {
        const q = QUESTS[id];
        const st = State.data.quests[id];
        return {
          render: (c, w, h) => {
            c.add(rowBg(this, w, h, id === this.selected));
            c.add(txt(this, 18, h / 2, st.done ? '✓' : q.main ? '★' : '◇', 22, st.done ? CSS.mint : q.main ? CSS.gold : CSS.pink).setOrigin(0, 0.5));
            c.add(txt(this, 52, h / 2, q.title, 20, st.done ? CSS.dim : CSS.text).setOrigin(0, 0.5));
          },
          onTap: () => {
            this.selected = id;
            this.render();
          },
        };
      }),
    );
    this.content.add(list);
    const id = this.selected;
    if (!id || !QUESTS[id]) return;
    const q = QUESTS[id];
    const st = State.data.quests[id];
    const dx = this.cx + listW + 44;
    const dw = this.cw - listW - 64;
    const g = this.add.graphics({ x: dx, y: 96 });
    drawPanel(g, dw, this.ch - 92, { fill: C.plum, alpha: 0.6, radius: 18, shadow: false });
    this.content.add(g);
    this.content.add(txt(this, dx + 24, 118, q.title, 26, CSS.pink, { fontStyle: '800' }));
    this.content.add(txt(this, dx + 24, 156, q.main ? 'основной сюжет' : `побочный · ${q.giver ?? ''}`, 16, CSS.dim));
    let y = 196;
    q.stages.forEach((s, i) => {
      if (i > st.stage) return;
      const done = st.done || i < st.stage;
      const t = txt(this, dx + 52, y, s.text, 18, done ? CSS.dim : CSS.text, { wordWrap: { width: dw - 80 }, lineSpacing: 4, fontStyle: '600' });
      this.content.add(txt(this, dx + 24, y, done ? '✓' : '•', 18, done ? CSS.mint : CSS.hotpink));
      this.content.add(t);
      y += t.height + 14;
    });
    if (st.done) this.content.add(txt(this, dx + 24, y + 6, 'Выполнено ♡', 20, CSS.mint, { fontStyle: '800' }));
  }

  // ───────────── отряд ─────────────
  private renderParty() {
    const party = State.data.party;
    const cardW = Math.min(330, (this.cw - 40 - (party.length - 1) * 16) / Math.max(party.length, 2));
    party.forEach((m, i) => {
      const x = this.cx + 20 + i * (cardW + 16);
      this.memberCard(m, x, 96, cardW, this.ch - 92);
    });
  }

  private memberCard(m: MemberState, x: number, y: number, w: number, h: number) {
    const s = memberStats(m);
    const def = MEMBERS[m.id];
    const g = this.add.graphics({ x, y });
    drawPanel(g, w, h, { fill: C.plum, alpha: 0.6, radius: 18, shadow: false });
    this.content.add(g);
    const pk = `portrait_${m.id}_neutral`;
    if (this.textures.exists(pk)) {
      const img = this.add.image(x + 54, y + 60, pk);
      img.setScale(84 / Math.max(img.width, img.height));
      const mask = this.make.graphics({});
      mask.fillStyle(0xffffff).fillCircle(x + 54, y + 60, 40);
      img.setMask(mask.createGeometryMask());
      img.once('destroy', () => mask.destroy());
      this.content.add(img);
      const ring = this.add.graphics();
      ring.lineStyle(3, C.pink, 0.9).strokeCircle(x + 54, y + 60, 41);
      this.content.add(ring);
    }
    this.content.add(txt(this, x + 108, y + 30, def.name, 26, CSS.text, { fontStyle: '800' }));
    this.content.add(txt(this, x + 108, y + 66, `ур. ${m.level}  ·  до след. ${expToNext(m.level) - m.exp}`, 15, CSS.dim));
    const bars = this.add.graphics();
    bar(bars, x + 20, y + 132, w - 40, 12, m.hp / s.maxHp, C.hotpink);
    bar(bars, x + 20, y + 168, w - 40, 12, m.sp / s.maxSp, 0x8fb3ff);
    this.content.add(bars);
    this.content.add(txt(this, x + 20, y + 110, `HP ${m.hp}/${s.maxHp}`, 15, CSS.pink));
    this.content.add(txt(this, x + 20, y + 146, `SP ${m.sp}/${s.maxSp}`, 15, '#a9c1ff'));
    const stats = [
      ['ATK', s.atk],
      ['DEF', s.def],
      ['MAG', s.mag],
      ['SPD', s.spd],
    ];
    stats.forEach(([k, v], i) => {
      this.content.add(txt(this, x + 20 + (i % 2) * ((w - 40) / 2), y + 192 + Math.floor(i / 2) * 26, `${k} ${v}`, 17, CSS.text));
    });
    // снаряжение
    let yy = y + 270;
    for (const slot of ['accessory', 'armor'] as const) {
      const id = m.equip[slot];
      const label = id ? ITEMS[id].name : slot === 'accessory' ? '— аксессуар —' : '— одежда —';
      const b = new Button(this, x + w / 2, yy, w - 30, 42, label, () => this.chooseEquip(m, slot), { size: 16, align: 'left' });
      this.content.add(b);
      yy += 50;
    }
    // навыки
    yy += 4;
    this.content.add(txt(this, x + 20, yy, 'Навыки', 16, CSS.dim));
    yy += 24;
    for (const sk of memberSkills(m)) {
      const sd = SKILLS[sk];
      const mood = sd.mood ? MOOD_INFO[sd.mood] : null;
      if (yy > y + h - 26) break;
      this.content.add(txt(this, x + 20, yy, `${mood ? mood.glyph : '✚'} ${sd.name}`, 16, mood ? mood.css : CSS.mint, { fontStyle: '700' }));
      this.content.add(txt(this, x + w - 20, yy, `${sd.sp} SP`, 15, CSS.dim).setOrigin(1, 0));
      yy += 24;
    }
  }

  private chooseEquip(m: MemberState, slot: 'accessory' | 'armor') {
    const options = State.items('equip').filter((e) => e.def.slot === slot);
    const W = this.scale.width;
    const H = this.scale.height;
    this.openModal((md) => {
      const w = 520;
      const h = Math.min(H - 120, 180 + (options.length + 1) * 60);
      const g = this.add.graphics({ x: W / 2 - w / 2, y: H / 2 - h / 2 });
      drawPanel(g, w, h, { radius: 22 });
      md.add(g);
      md.add(txt(this, W / 2, H / 2 - h / 2 + 24, `${MEMBERS[m.id].name}: ${slot === 'accessory' ? 'аксессуар' : 'одежда'}`, 22, CSS.pink, { fontStyle: '800' }).setOrigin(0.5, 0));
      let y = H / 2 - h / 2 + 96;
      md.add(
        new Button(this, W / 2, y, w - 60, 50, 'Снять', () => {
          State.equip(m.id, null, slot);
          this.closeModal();
          this.render();
        }, { size: 18 }),
      );
      for (const o of options) {
        y += 60;
        const free = State.freeCount(o.def.id) > 0 || m.equip[slot] === o.def.id;
        const stats = Object.entries(o.def.stats ?? {}).map(([k, v]) => `${k === 'maxHp' ? 'HP' : k === 'maxSp' ? 'SP' : k.toUpperCase()}+${v}`).join(' ');
        md.add(
          new Button(this, W / 2, y, w - 60, 50, `${o.def.name}  ${stats}`, () => {
            if (!free) {
              const other = State.data.party.find((p) => p.equip[slot] === o.def.id);
              if (other) State.equip(other.id, null, slot);
            }
            State.equip(m.id, o.def.id, slot);
            Audio2.sfx('buff');
            this.closeModal();
            this.render();
          }, { size: 17, align: 'left' }),
        );
      }
      md.add(new Button(this, W / 2, H / 2 + h / 2 - 40, 200, 50, 'Отмена', () => this.closeModal(), { size: 18 }));
    });
  }

  // ───────────── модалки ─────────────
  private openModal(build: (c: Phaser.GameObjects.Container) => void) {
    this.closeModal();
    const c = this.add.container(0, 0).setDepth(100);
    c.add(dim(this, 0.5));
    build(c);
    this.modal = c;
  }

  private closeModal() {
    this.modal?.destroy();
    this.modal = null;
  }

  private pickMember(title: string, cb: (m: MemberState) => void) {
    const W = this.scale.width;
    const H = this.scale.height;
    this.openModal((md) => {
      const party = State.data.party;
      const w = 480;
      const h = 150 + party.length * 66 + 60;
      const g = this.add.graphics({ x: W / 2 - w / 2, y: H / 2 - h / 2 });
      drawPanel(g, w, h, { radius: 22 });
      md.add(g);
      md.add(txt(this, W / 2, H / 2 - h / 2 + 26, title, 21, CSS.pink, { fontStyle: '800', wordWrap: { width: w - 40 }, align: 'center' }).setOrigin(0.5, 0));
      party.forEach((m, i) => {
        const s = memberStats(m);
        md.add(new Button(this, W / 2, H / 2 - h / 2 + 110 + i * 66, w - 60, 54, `${MEMBERS[m.id].name}   HP ${m.hp}/${s.maxHp}  SP ${m.sp}/${s.maxSp}`, () => cb(m), { size: 18, align: 'left' }));
      });
      md.add(new Button(this, W / 2, H / 2 + h / 2 - 44, 200, 50, 'Отмена', () => this.closeModal(), { size: 18 }));
    });
  }

  private confirm(text: string, yes: () => void) {
    const W = this.scale.width;
    const H = this.scale.height;
    this.openModal((md) => {
      const g = this.add.graphics({ x: W / 2 - 300, y: H / 2 - 120 });
      drawPanel(g, 600, 240, { radius: 22 });
      md.add(g);
      md.add(txt(this, W / 2, H / 2 - 60, text, 21, CSS.text, { wordWrap: { width: 520 }, align: 'center' }).setOrigin(0.5));
      md.add(new Button(this, W / 2 - 120, H / 2 + 60, 200, 54, 'Да', yes));
      md.add(new Button(this, W / 2 + 120, H / 2 + 60, 200, 54, 'Нет', () => this.closeModal()));
    });
  }
}
