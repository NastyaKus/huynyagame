import { SAVE_VERSION } from '../config';
import { ITEMS, CASSETTE_IDS } from '../data/items';
import { MEMBERS, expToNext, MAX_LEVEL } from '../data/party';
import type { MemberState, SaveData, Stats, ItemDef } from '../data/types';

export function newSave(): SaveData {
  const hana = makeMember('hana');
  return {
    version: SAVE_VERSION,
    savedAt: 0,
    playTime: 0,
    map: 'apartment',
    x: -1,
    y: -1,
    facing: 'down',
    flags: {},
    inv: { onigiri: 2, tea: 1, old_headphones: 1 },
    money: 1000,
    quests: { main: { stage: 0, done: false } },
    party: [{ ...hana, equip: { accessory: 'old_headphones' } }],
    cleared: [],
    track: null,
    seenWeak: [],
  };
}

export function makeMember(id: string, level?: number): MemberState {
  const def = MEMBERS[id];
  const lv = level ?? def.joinLevel;
  const m: MemberState = { id, level: lv, exp: 0, hp: 1, sp: 1, equip: {} };
  const s = memberStats(m);
  m.hp = s.maxHp;
  m.sp = s.maxSp;
  return m;
}

export function memberStats(m: MemberState): Stats {
  const def = MEMBERS[m.id];
  const lv = m.level - 1;
  const s: Stats = {
    maxHp: Math.round(def.base.maxHp + def.growth.maxHp * lv),
    maxSp: Math.round(def.base.maxSp + def.growth.maxSp * lv),
    atk: Math.round(def.base.atk + def.growth.atk * lv),
    def: Math.round(def.base.def + def.growth.def * lv),
    mag: Math.round(def.base.mag + def.growth.mag * lv),
    spd: Math.round(def.base.spd + def.growth.spd * lv),
  };
  for (const slot of ['accessory', 'armor'] as const) {
    const id = m.equip[slot];
    const st = id ? ITEMS[id]?.stats : undefined;
    if (st) for (const k of Object.keys(st) as (keyof Stats)[]) s[k] += st[k] ?? 0;
  }
  return s;
}

export function memberSkills(m: MemberState): string[] {
  return MEMBERS[m.id].skills.filter((s) => s.level <= m.level).map((s) => s.skill);
}

export interface LevelResult {
  levels: number;
  learned: string[];
}

export function addExp(m: MemberState, exp: number): LevelResult {
  const before = memberSkills(m);
  let levels = 0;
  m.exp += exp;
  while (m.level < MAX_LEVEL && m.exp >= expToNext(m.level)) {
    const prev = memberStats(m);
    m.exp -= expToNext(m.level);
    m.level++;
    levels++;
    const now = memberStats(m);
    // при повышении уровня прибавляем разницу HP/SP
    m.hp += now.maxHp - prev.maxHp;
    m.sp += now.maxSp - prev.maxSp;
  }
  const learned = memberSkills(m).filter((s) => !before.includes(s));
  return { levels, learned };
}

/** Состояние текущей игры (синглтон). Чистые данные + удобные методы. */
class GameStateImpl {
  data: SaveData = newSave();

  reset() {
    this.data = newSave();
  }

  load(d: SaveData) {
    this.data = migrate(d);
  }

  // флаги
  flag(k: string): boolean | number | string | undefined {
    return this.data.flags[k];
  }
  setFlag(k: string, v: boolean | number | string = true) {
    this.data.flags[k] = v;
  }
  unflag(k: string) {
    delete this.data.flags[k];
  }

  // инвентарь
  count(id: string): number {
    return this.data.inv[id] ?? 0;
  }
  has(id: string, n = 1): boolean {
    return this.count(id) >= n;
  }
  add(id: string, n = 1) {
    if (!ITEMS[id]) throw new Error(`Unknown item ${id}`);
    this.data.inv[id] = this.count(id) + n;
  }
  remove(id: string, n = 1): boolean {
    if (!this.has(id, n)) return false;
    this.data.inv[id] = this.count(id) - n;
    if (this.data.inv[id] <= 0) delete this.data.inv[id];
    return true;
  }
  /** Предметы инвентаря (включая надетые), отсортированные по типу. */
  items(kind?: ItemDef['kind']): { def: ItemDef; n: number }[] {
    const order = ['consumable', 'equip', 'key', 'cassette', 'note'];
    return Object.entries(this.data.inv)
      .filter(([, n]) => n > 0)
      .map(([id, n]) => ({ def: ITEMS[id], n }))
      .filter((e) => e.def && (!kind || e.def.kind === kind))
      .sort((a, b) => order.indexOf(a.def.kind) - order.indexOf(b.def.kind));
  }
  cassettes(): string[] {
    return CASSETTE_IDS.filter((id) => this.has(id));
  }
  /** Сколько штук предмета свободно (не надето). */
  freeCount(id: string): number {
    const worn = this.data.party.filter((m) => m.equip.accessory === id || m.equip.armor === id).length;
    return this.count(id) - worn;
  }

  // отряд
  member(id: string): MemberState | undefined {
    return this.data.party.find((m) => m.id === id);
  }
  join(id: string) {
    if (this.member(id)) return;
    const hana = this.member('hana');
    const lv = Math.max(MEMBERS[id].joinLevel, (hana?.level ?? 1) - 1);
    this.data.party.push(makeMember(id, lv));
  }
  healAll() {
    for (const m of this.data.party) {
      const s = memberStats(m);
      m.hp = s.maxHp;
      m.sp = s.maxSp;
    }
  }
  equip(memberId: string, itemId: string | null, slot: 'accessory' | 'armor') {
    const m = this.member(memberId);
    if (!m) return;
    if (itemId === null) {
      delete m.equip[slot];
    } else {
      if (this.freeCount(itemId) <= 0) return;
      m.equip[slot] = itemId;
    }
    const s = memberStats(m);
    m.hp = Math.min(m.hp, s.maxHp);
    m.sp = Math.min(m.sp, s.maxSp);
  }

  // враги на карте
  isCleared(id: string) {
    return this.data.cleared.includes(id);
  }
  clear(id: string) {
    if (!this.isCleared(id)) this.data.cleared.push(id);
  }

  // слабости, которые игрок уже обнаружил
  knowsWeak(enemyId: string, mood: string) {
    return this.data.seenWeak.includes(`${enemyId}:${mood}`);
  }
  learnWeak(enemyId: string, mood: string) {
    const k = `${enemyId}:${mood}`;
    if (!this.data.seenWeak.includes(k)) this.data.seenWeak.push(k);
  }
}

/** Миграция старых сохранений: дозаполняем отсутствующие поля. */
export function migrate(d: Partial<SaveData>): SaveData {
  const base = newSave();
  const out = { ...base, ...d } as SaveData;
  out.flags = { ...(d.flags ?? {}) };
  out.inv = { ...(d.inv ?? base.inv) };
  out.quests = { ...(d.quests ?? base.quests) };
  out.party = (d.party ?? base.party).map((m) => ({ ...m, equip: { ...(m.equip ?? {}) } }));
  out.cleared = [...(d.cleared ?? [])];
  out.seenWeak = [...(d.seenWeak ?? [])];
  out.version = SAVE_VERSION;
  return out;
}

export const State = new GameStateImpl();
