import { describe, it, expect, beforeEach } from 'vitest';
import { State, addExp, memberStats, migrate, newSave } from '../src/systems/GameState';
import { Quests } from '../src/systems/QuestSystem';
import { check } from '../src/systems/conditions';
import { DialogueRunner } from '../src/systems/DialogueRunner';
import { Saves, setStorage, memoryKV } from '../src/systems/SaveSystem';
import { BattleEngine, calcDamage, enemyCombatants, partyCombatant } from '../src/systems/BattleEngine';
import { expToNext } from '../src/data/party';
import { MAPS } from '../src/data/maps';
import { DIALOGUES } from '../src/data/dialogues';
import { TILE_INDEX, TILE_LIST } from '../src/data/tiles';
import { ITEMS } from '../src/data/items';
import { ENEMIES } from '../src/data/enemies';
import { SHOPS } from '../src/data/shops';
import { QUESTS } from '../src/data/quests';
import type { Effect } from '../src/data/types';

const seq = (vals: number[]) => {
  let i = 0;
  return () => vals[i++ % vals.length];
};

beforeEach(() => State.reset());

describe('инвентарь и отряд', () => {
  it('добавляет и убирает предметы', () => {
    State.add('onigiri', 3);
    expect(State.count('onigiri')).toBe(5);
    expect(State.remove('onigiri', 5)).toBe(true);
    expect(State.has('onigiri')).toBe(false);
    expect(State.remove('onigiri')).toBe(false);
  });
  it('считает кассеты', () => {
    State.add('cassette_1');
    State.add('cassette_4');
    expect(State.cassettes()).toEqual(['cassette_1', 'cassette_4']);
  });
  it('повышает уровень и учит навыки', () => {
    const hana = State.member('hana')!;
    const r = addExp(hana, expToNext(1) + expToNext(2));
    expect(hana.level).toBe(3);
    expect(r.levels).toBe(2);
    expect(r.learned).toContain('tape_rustle');
  });
  it('снаряжение меняет статы', () => {
    State.add('denim');
    const hana = State.member('hana')!;
    const before = memberStats(hana).def;
    State.equip('hana', 'denim', 'armor');
    expect(memberStats(hana).def).toBe(before + 4);
  });
  it('компаньон вступает с уровнем не ниже стартового', () => {
    State.join('ren');
    expect(State.member('ren')!.level).toBe(3);
  });
});

describe('квесты', () => {
  it('продвигает главный квест по событиям', () => {
    expect(State.data.quests.main.stage).toBe(0);
    State.add('cassette_1');
    Quests.notify({ type: 'pickup', item: 'cassette_1' });
    expect(State.data.quests.main.stage).toBe(1);
    Quests.notify({ type: 'listen', cassette: 'cassette_1' });
    expect(State.data.quests.main.stage).toBe(2);
  });
  it('догоняет стадию, если предмет уже был', () => {
    State.add('sota_pass');
    Quests.start('pass');
    expect(State.data.quests.pass.stage).toBe(1);
  });
  it('выдаёт награду при завершении', () => {
    const money = State.data.money;
    Quests.start('pass');
    State.add('sota_pass');
    Quests.notify({ type: 'pickup', item: 'sota_pass' });
    State.setFlag('pass_returned');
    Quests.notify({ type: 'flag', key: 'pass_returned' });
    expect(State.data.quests.pass.done).toBe(true);
    expect(State.data.money).toBe(money + 400);
  });
  it('квест страниц завершается, когда собраны все', () => {
    Quests.start('diary');
    for (const p of ['diary_1', 'diary_2', 'diary_3']) {
      State.add(p);
      Quests.notify({ type: 'pickup', item: p });
    }
    expect(State.data.quests.diary.done).toBe(true);
    expect(State.has('studio_phones')).toBe(true);
  });
});

describe('условия и диалоги', () => {
  it('проверяет условия', () => {
    expect(check({ flag: 'x' })).toBe(false);
    State.setFlag('x');
    expect(check({ flag: 'x', notFlag: 'y' })).toBe(true);
    expect(check({ cassettes: 1 })).toBe(false);
    expect(check({ questAt: ['main', 0] })).toBe(true);
    expect(check({ any: [{ flag: 'nope' }, { flag: 'x' }] })).toBe(true);
  });
  it('ветвится по меткам', () => {
    const r = new DialogueRunner([
      { if: { flag: 'seen' }, goto: 'b' },
      { say: 'A' },
      { end: true },
      { label: 'b' },
      { say: 'B' },
    ]);
    expect((r.next() as any).say).toBe('A');
    expect(r.next()).toBeNull();
    State.setFlag('seen');
    const r2 = new DialogueRunner([{ if: { flag: 'seen' }, goto: 'b' }, { say: 'A' }, { label: 'b' }, { say: 'B' }]);
    expect((r2.next() as any).say).toBe('B');
  });
  it('выбор переходит к метке', () => {
    const r = new DialogueRunner([{ choice: [{ text: '1', goto: 'one' }, { text: '2', goto: 'two' }] }, { label: 'one' }, { say: 'one' }, { end: true }, { label: 'two' }, { say: 'two' }]);
    const c = r.next() as any;
    expect(c.choice).toHaveLength(2);
    r.choose('two');
    expect((r.next() as any).say).toBe('two');
  });
});

describe('сохранения', () => {
  it('сохраняет и загружает', async () => {
    setStorage(memoryKV());
    State.add('cassette_2');
    State.setFlag('heard_club');
    await Saves.save('1', State.data);
    State.reset();
    const d = await Saves.load('1');
    expect(d?.inv.cassette_2).toBe(1);
    expect(d?.flags.heard_club).toBe(true);
    const latest = await Saves.latest();
    expect(latest?.slot).toBe('1');
  });
  it('мигрирует неполные сохранения', () => {
    const d = migrate({ map: 'street', money: 5 } as any);
    expect(d.party.length).toBe(1);
    expect(d.cleared).toEqual([]);
    expect(d.money).toBe(5);
  });
});

describe('бой', () => {
  it('слабость наносит больше урона и даёт доп. ход', () => {
    const hana = partyCombatant(newSave().party[0]);
    const [swarm] = enemyCombatants(['swarm']);
    const rng = () => 0.5;
    const neutral = calcDamage(hana, swarm, 30, 'mag', undefined, rng, 0);
    const weak = calcDamage(hana, swarm, 30, 'mag', 'ballad', rng, 0);
    expect(weak.weak).toBe(true);
    expect(weak.amount).toBeGreaterThan(neutral.amount);

    const eng = new BattleEngine([hana], enemyCombatants(['swarm', 'swarm']), { rng: seq([0.99, 0.1, 0.5, 0.5]) });
    eng.start();
    // гарантируем ход Ханы
    (eng as any).currentId = 'hana';
    const ev = eng.act({ type: 'skill', skill: 'quiet_note', target: 'e0' });
    expect(ev.some((e) => e.t === 'oneMore')).toBe(true);
    eng.next();
    expect(eng.current?.uid).toBe('hana');
  });
  it('финальный аккорд доступен, когда все враги упали', () => {
    const hana = partyCombatant(newSave().party[0]);
    const eng = new BattleEngine([hana], enemyCombatants(['swarm']), { rng: () => 0.5 });
    eng.start();
    (eng as any).currentId = 'hana';
    eng.enemies[0].down = true;
    expect(eng.allOutReady()).toBe(true);
    eng.act({ type: 'allout' });
    expect(eng.enemies[0].hp).toBeLessThan(eng.enemies[0].stats.maxHp);
  });
  it('бой заканчивается победой', () => {
    const hana = partyCombatant(newSave().party[0]);
    hana.stats.mag = 999;
    const eng = new BattleEngine([hana], enemyCombatants(['thread']), { rng: () => 0.5 });
    eng.start();
    let guard = 0;
    while (!eng.outcome && guard++ < 50) {
      if (eng.current!.side === 'party') eng.act({ type: 'skill', skill: 'quiet_note', target: 'e0' });
      else eng.enemyTurn();
      eng.next();
    }
    expect(eng.outcome).toBe('win');
  });
  it('босс меняет слабость', () => {
    const [boss] = enemyCombatants(['resonance']);
    const hana = partyCombatant(newSave().party[0]);
    hana.stats.spd = 0;
    const eng = new BattleEngine([hana], [boss], { rng: () => 0.5 });
    const seen = new Set<string>();
    eng.start();
    for (let i = 0; i < 12; i++) {
      seen.add(boss.weak[0]);
      if (eng.current!.side === 'enemy') eng.enemyTurn();
      else eng.act({ type: 'defend' });
      hana.hp = hana.stats.maxHp;
      eng.next();
    }
    expect(seen.size).toBeGreaterThan(1);
    expect(eng.canFlee).toBe(false);
  });
});

describe('данные', () => {
  it('карты корректны', () => {
    for (const m of Object.values(MAPS)) {
      const w = m.rows[0].length;
      m.rows.forEach((r, i) => expect(r.length, `${m.id} row ${i}`).toBe(w));
      for (const r of m.rows) for (const ch of r) expect(TILE_INDEX[ch], `${m.id} '${ch}'`).toBeDefined();
      const solidAt = (x: number, y: number) => TILE_LIST[TILE_INDEX[m.rows[Math.floor(y)]?.[Math.floor(x)] ?? ' ']].solid;
      for (const o of m.objects) {
        if (o.type === 'spawn' || o.type === 'pickup' || o.type === 'enemy') expect(solidAt(o.x, o.y), `${m.id} ${o.type} ${'id' in o ? o.id : ''}`).toBe(false);
        if (o.type === 'npc' && !o.glow && o.scale === undefined) expect(solidAt(o.x, o.y), `${m.id} npc ${o.id}`).toBe(false);
        if (o.type === 'door') {
          expect(MAPS[o.to], `door to ${o.to}`).toBeDefined();
          expect(MAPS[o.to].objects.some((s) => s.type === 'spawn' && s.id === o.spawn), `spawn ${o.spawn}`).toBe(true);
        }
        if ('dialogue' in o && o.dialogue) expect(DIALOGUES[o.dialogue], `dialogue ${o.dialogue}`).toBeDefined();
        if (o.type === 'door' && o.locked) expect(DIALOGUES[o.locked], `locked ${o.locked}`).toBeDefined();
        if (o.type === 'pickup') expect(ITEMS[o.item]).toBeDefined();
        if (o.type === 'enemy') o.group.forEach((g) => expect(ENEMIES[g]).toBeDefined());
      }
      if (m.onEnter) expect(DIALOGUES[m.onEnter.dialogue]).toBeDefined();
    }
  });
  it('диалоги ссылаются на существующие метки и данные', () => {
    const checkEffect = (e: Effect, id: string) => {
      if ('give' in e) expect(ITEMS[e.give], `${id} give ${e.give}`).toBeDefined();
      if ('take' in e) expect(ITEMS[e.take], `${id} take ${e.take}`).toBeDefined();
      if ('shop' in e) expect(SHOPS[e.shop]).toBeDefined();
      if ('quest' in e) expect(QUESTS[e.quest], `${id} quest`).toBeDefined();
      if ('battle' in e) e.battle.forEach((b) => expect(ENEMIES[b]).toBeDefined());
    };
    for (const [id, d] of Object.entries(DIALOGUES)) {
      const labels = new Set(d.filter((s) => 'label' in s).map((s: any) => s.label));
      for (const s of d) {
        if ('goto' in s) expect(labels.has(s.goto), `${id} -> ${s.goto}`).toBe(true);
        if ('choice' in s) s.choice.forEach((c) => expect(labels.has(c.goto), `${id} choice -> ${c.goto}`).toBe(true));
        if ('do' in s) s.do.forEach((e) => checkEffect(e, id));
      }
    }
  });
  it('магазины продают существующие предметы с ценой', () => {
    for (const s of Object.values(SHOPS)) for (const i of s.items) expect(ITEMS[i]?.price, i).toBeGreaterThan(0);
  });
});
