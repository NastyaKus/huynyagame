import { ITEMS } from '../data/items';
import { SKILLS } from '../data/skills';
import { ENEMIES } from '../data/enemies';
import { MEMBERS } from '../data/party';
import type { Mood, SkillDef, Stats, MemberState } from '../data/types';
import { memberStats, memberSkills } from './GameState';

export type Side = 'party' | 'enemy';

export interface Combatant {
  uid: string;
  defId: string;
  name: string;
  side: Side;
  stats: Stats;
  hp: number;
  sp: number;
  skills: string[];
  weak: Mood[];
  resist: Mood[];
  down: boolean;
  defending: boolean;
  atkBuff: number;
  atkTurns: number;
  defBuff: number;
  defTurns: number;
  boss?: boolean;
  cycle?: Mood[];
  cycleIdx: number;
  turnsTaken: number;
}

export type Action =
  | { type: 'attack'; target: string }
  | { type: 'skill'; skill: string; target?: string }
  | { type: 'item'; item: string; target?: string }
  | { type: 'defend' }
  | { type: 'flee' }
  | { type: 'allout' };

export type BEvent =
  | { t: 'act'; actor: string; kind: 'attack' | 'skill' | 'item' | 'defend' | 'allout' | 'flee'; name?: string; mood?: Mood; fx?: string }
  | { t: 'hit'; target: string; amount: number; weak?: boolean; resist?: boolean; crit?: boolean; mood?: Mood }
  | { t: 'miss'; target: string }
  | { t: 'heal'; target: string; amount: number }
  | { t: 'sp'; target: string; amount: number }
  | { t: 'revive'; target: string; amount: number }
  | { t: 'down'; target: string }
  | { t: 'stand'; target: string }
  | { t: 'ko'; target: string }
  | { t: 'oneMore'; actor: string }
  | { t: 'buff'; target: string; stat: 'atk' | 'def' }
  | { t: 'weakShift'; target: string; mood: Mood }
  | { t: 'flee'; ok: boolean }
  | { t: 'msg'; text: string };

export type Outcome = null | 'win' | 'lose' | 'fled';

export type Rng = () => number;

export function partyCombatant(m: MemberState): Combatant {
  const s = memberStats(m);
  return {
    uid: m.id,
    defId: m.id,
    name: MEMBERS[m.id].name,
    side: 'party',
    stats: s,
    hp: Math.min(m.hp, s.maxHp),
    sp: Math.min(m.sp, s.maxSp),
    skills: memberSkills(m),
    weak: [],
    resist: [],
    down: false,
    defending: false,
    atkBuff: 0,
    atkTurns: 0,
    defBuff: 0,
    defTurns: 0,
    cycleIdx: 0,
    turnsTaken: 0,
  };
}

export function enemyCombatants(ids: string[]): Combatant[] {
  const counts: Record<string, number> = {};
  const total: Record<string, number> = {};
  ids.forEach((id) => (total[id] = (total[id] ?? 0) + 1));
  return ids.map((id, i) => {
    const d = ENEMIES[id];
    counts[id] = (counts[id] ?? 0) + 1;
    const suffix = total[id] > 1 ? ' ' + 'ABCDE'[counts[id] - 1] : '';
    return {
      uid: `e${i}`,
      defId: id,
      name: d.name + suffix,
      side: 'enemy' as Side,
      stats: { ...d.stats },
      hp: d.stats.maxHp,
      sp: d.stats.maxSp,
      skills: [...d.skills],
      weak: d.cycle ? [d.cycle[0]] : [...d.weak],
      resist: [...d.resist],
      down: false,
      defending: false,
      atkBuff: 0,
      atkTurns: 0,
      defBuff: 0,
      defTurns: 0,
      boss: d.boss,
      cycle: d.cycle,
      cycleIdx: 0,
      turnsTaken: 0,
    };
  });
}

export interface DamageResult {
  amount: number;
  weak: boolean;
  resist: boolean;
  crit: boolean;
}

/** Формула урона. Экспортируется для тестов. */
export function calcDamage(attacker: Combatant, target: Combatant, power: number, stat: 'atk' | 'mag', mood: Mood | undefined, rng: Rng, critChance = 0.06): DamageResult {
  const base = attacker.stats[stat] * (1 + attacker.atkBuff);
  const raw = (base * power) / 12;
  const def = target.stats.def * (1 + target.defBuff);
  let dmg = raw * (50 / (50 + def * 3));
  dmg *= 0.9 + rng() * 0.2;
  const weak = !!mood && target.weak.includes(mood);
  const resist = !!mood && target.resist.includes(mood);
  if (weak) dmg *= 1.5;
  if (resist) dmg *= 0.5;
  const crit = !resist && rng() < critChance;
  if (crit) dmg *= 1.6;
  if (target.defending) dmg *= 0.5;
  return { amount: Math.max(1, Math.round(dmg)), weak, resist, crit };
}

export function healAmount(caster: Combatant, power: number): number {
  return Math.round(power * (1 + caster.stats.mag / 40));
}

/** Пошаговый бой в стиле JRPG: порядок по скорости, слабости дают дополнительный ход. */
export class BattleEngine {
  party: Combatant[];
  enemies: Combatant[];
  rng: Rng;
  queue: string[] = [];
  currentId: string | null = null;
  round = 0;
  outcome: Outcome = null;
  canFlee: boolean;
  private oneMore = false;

  constructor(party: Combatant[], enemies: Combatant[], opts: { rng?: Rng; noFlee?: boolean } = {}) {
    this.party = party;
    this.enemies = enemies;
    this.rng = opts.rng ?? Math.random;
    this.canFlee = !opts.noFlee && !enemies.some((e) => e.boss);
  }

  get all(): Combatant[] {
    return [...this.party, ...this.enemies];
  }
  get(uid: string): Combatant {
    const c = this.all.find((x) => x.uid === uid);
    if (!c) throw new Error('no combatant ' + uid);
    return c;
  }
  get current(): Combatant | null {
    return this.currentId ? this.get(this.currentId) : null;
  }
  alive(side: Side): Combatant[] {
    return (side === 'party' ? this.party : this.enemies).filter((c) => c.hp > 0);
  }
  opponents(c: Combatant): Combatant[] {
    return this.alive(c.side === 'party' ? 'enemy' : 'party');
  }
  allies(c: Combatant): Combatant[] {
    return c.side === 'party' ? this.party : this.enemies;
  }

  /** Все живые враги лежат — можно сыграть «Финальный аккорд». */
  allOutReady(): boolean {
    const e = this.alive('enemy');
    return e.length > 0 && e.every((x) => x.down) && this.current?.side === 'party';
  }

  start(): BEvent[] {
    return this.next();
  }

  private newRound() {
    this.round++;
    this.queue = this.all
      .filter((c) => c.hp > 0)
      .map((c) => ({ c, k: c.stats.spd * (0.85 + this.rng() * 0.3) }))
      .sort((a, b) => b.k - a.k)
      .map((x) => x.c.uid);
  }

  /** Передать ход следующему. Возвращает автоматические события (встал, сменилась слабость…). */
  next(): BEvent[] {
    const ev: BEvent[] = [];
    if (this.outcome) return ev;
    if (this.oneMore && this.current && this.current.hp > 0) {
      this.oneMore = false;
      return ev;
    }
    this.oneMore = false;
    for (let guard = 0; guard < 100; guard++) {
      if (!this.queue.length) this.newRound();
      const id = this.queue.shift()!;
      const c = this.get(id);
      if (c.hp <= 0) continue;
      this.currentId = id;
      c.defending = false;
      c.turnsTaken++;
      if (c.atkTurns > 0 && --c.atkTurns === 0) c.atkBuff = 0;
      if (c.defTurns > 0 && --c.defTurns === 0) c.defBuff = 0;
      if (c.cycle && c.turnsTaken > 1 && (c.turnsTaken - 1) % 2 === 0) {
        c.cycleIdx = (c.cycleIdx + 1) % c.cycle.length;
        c.weak = [c.cycle[c.cycleIdx]];
        ev.push({ t: 'weakShift', target: c.uid, mood: c.weak[0] });
      }
      if (c.down) {
        c.down = false;
        ev.push({ t: 'stand', target: c.uid });
        if (c.side === 'enemy') continue; // упавший враг теряет ход
      }
      return ev;
    }
    return ev;
  }

  private checkOutcome() {
    if (this.alive('enemy').length === 0) this.outcome = 'win';
    else if (this.alive('party').length === 0) this.outcome = 'lose';
  }

  canUseSkill(c: Combatant, skillId: string): boolean {
    const s = SKILLS[skillId];
    return !!s && c.sp >= s.sp;
  }

  /** Выполнить действие текущего бойца. */
  act(a: Action): BEvent[] {
    const actor = this.current;
    if (!actor || this.outcome) return [];
    const ev: BEvent[] = [];
    switch (a.type) {
      case 'attack': {
        ev.push({ t: 'act', actor: actor.uid, kind: 'attack', fx: 'slash' });
        const target = this.validTarget(actor, a.target, 'enemy');
        if (target) this.damage(actor, target, 20, 'atk', undefined, ev);
        break;
      }
      case 'skill': {
        const s = SKILLS[a.skill];
        if (!s || actor.sp < s.sp) {
          ev.push({ t: 'msg', text: 'Не хватает SP!' });
          return ev;
        }
        actor.sp -= s.sp;
        ev.push({ t: 'act', actor: actor.uid, kind: 'skill', name: s.name, mood: s.mood, fx: fxFor(s) });
        this.applySkill(actor, s, a.target, ev);
        break;
      }
      case 'item': {
        const it = ITEMS[a.item];
        if (!it?.effect) return ev;
        ev.push({ t: 'act', actor: actor.uid, kind: 'item', name: it.name, fx: 'heal' });
        const targets = it.effect.all ? this.allies(actor).filter((c) => c.hp > 0) : [this.validTarget(actor, a.target, 'ally', true)].filter(Boolean) as Combatant[];
        for (const t of targets) {
          const e = it.effect;
          if (e.revive && t.hp <= 0) {
            t.hp = Math.max(1, Math.round(t.stats.maxHp * e.revive));
            ev.push({ t: 'revive', target: t.uid, amount: t.hp });
            continue;
          }
          if (t.hp <= 0) continue;
          let h = (e.hp ?? 0) + Math.round((e.hpPct ?? 0) * t.stats.maxHp);
          if (h) {
            h = Math.min(h, t.stats.maxHp - t.hp);
            t.hp += h;
            ev.push({ t: 'heal', target: t.uid, amount: h });
          }
          if (e.sp) {
            const s = Math.min(e.sp, t.stats.maxSp - t.sp);
            t.sp += s;
            ev.push({ t: 'sp', target: t.uid, amount: s });
          }
        }
        break;
      }
      case 'defend': {
        actor.defending = true;
        const s = Math.min(3, actor.stats.maxSp - actor.sp);
        actor.sp += s;
        ev.push({ t: 'act', actor: actor.uid, kind: 'defend' });
        if (s > 0) ev.push({ t: 'sp', target: actor.uid, amount: s });
        break;
      }
      case 'flee': {
        ev.push({ t: 'act', actor: actor.uid, kind: 'flee' });
        if (!this.canFlee) {
          ev.push({ t: 'msg', text: 'Сбежать не получится!' }, { t: 'flee', ok: false });
          break;
        }
        const ps = avg(this.alive('party').map((c) => c.stats.spd));
        const es = avg(this.alive('enemy').map((c) => c.stats.spd));
        const chance = clamp(0.55 + (ps - es) * 0.04, 0.25, 0.92);
        const ok = this.rng() < chance;
        ev.push({ t: 'flee', ok });
        if (ok) this.outcome = 'fled';
        break;
      }
      case 'allout': {
        if (!this.allOutReady()) return ev;
        ev.push({ t: 'act', actor: actor.uid, kind: 'allout', name: 'Финальный аккорд', fx: 'allout' });
        const power = this.alive('party').reduce((s, c) => s + (c.stats.atk + c.stats.mag) * (1 + c.atkBuff), 0);
        for (const e of this.alive('enemy')) {
          const def = e.stats.def * (1 + e.defBuff);
          const dmg = Math.max(1, Math.round(power * 1.25 * (50 / (50 + def * 3)) * (0.95 + this.rng() * 0.1)));
          e.hp = Math.max(0, e.hp - dmg);
          ev.push({ t: 'hit', target: e.uid, amount: dmg });
          e.down = false;
          if (e.hp <= 0) ev.push({ t: 'ko', target: e.uid });
        }
        break;
      }
    }
    this.checkOutcome();
    return ev;
  }

  private validTarget(actor: Combatant, uid: string | undefined, kind: 'enemy' | 'ally', allowDead = false): Combatant | null {
    const pool = kind === 'enemy' ? this.opponents(actor) : this.allies(actor).filter((c) => allowDead || c.hp > 0);
    if (uid) {
      const t = pool.find((c) => c.uid === uid);
      if (t) return t;
    }
    return pool[0] ?? null;
  }

  private applySkill(actor: Combatant, s: SkillDef, target: string | undefined, ev: BEvent[]) {
    if (s.kind === 'damage') {
      const targets = s.target === 'allEnemies' ? this.opponents(actor) : [this.validTarget(actor, target, 'enemy')].filter(Boolean) as Combatant[];
      for (const t of targets) this.damage(actor, t, s.power, s.stat, s.mood, ev);
    } else if (s.kind === 'heal') {
      const targets =
        s.target === 'allAllies' ? this.allies(actor).filter((c) => c.hp > 0) : s.target === 'self' ? [actor] : ([this.validTarget(actor, target, 'ally')].filter(Boolean) as Combatant[]);
      for (const t of targets) {
        const h = Math.min(healAmount(actor, s.power), t.stats.maxHp - t.hp);
        t.hp += h;
        ev.push({ t: 'heal', target: t.uid, amount: h });
      }
    } else if (s.kind === 'buff' && s.buff) {
      const targets = s.target === 'allAllies' ? this.allies(actor).filter((c) => c.hp > 0) : [actor];
      for (const t of targets) {
        if (s.buff.atk) {
          t.atkBuff = s.buff.atk;
          t.atkTurns = s.buff.turns + 1;
          ev.push({ t: 'buff', target: t.uid, stat: 'atk' });
        }
        if (s.buff.def) {
          t.defBuff = s.buff.def;
          t.defTurns = s.buff.turns + 1;
          ev.push({ t: 'buff', target: t.uid, stat: 'def' });
        }
      }
    }
  }

  private damage(actor: Combatant, target: Combatant, power: number, stat: 'atk' | 'mag', mood: Mood | undefined, ev: BEvent[]) {
    // небольшой шанс промаха у обычных атак быстрых целей
    if (!mood && this.rng() < clamp((target.stats.spd - actor.stats.spd) * 0.01, 0, 0.12)) {
      ev.push({ t: 'miss', target: target.uid });
      return;
    }
    const r = calcDamage(actor, target, power, stat, mood, this.rng);
    target.hp = Math.max(0, target.hp - r.amount);
    ev.push({ t: 'hit', target: target.uid, amount: r.amount, weak: r.weak, resist: r.resist, crit: r.crit, mood });
    if (target.hp <= 0) {
      target.down = false;
      ev.push({ t: 'ko', target: target.uid });
      return;
    }
    if ((r.weak || r.crit) && !target.down && target.side === 'enemy') {
      target.down = true;
      ev.push({ t: 'down', target: target.uid });
      if (actor.side === 'party') {
        this.oneMore = true;
        ev.push({ t: 'oneMore', actor: actor.uid });
      }
    }
  }

  /** ИИ врага: выбрать и выполнить действие. */
  enemyTurn(): BEvent[] {
    const e = this.current;
    if (!e || e.side !== 'enemy') return [];
    const targets = this.alive('party');
    if (!targets.length) return [];
    const usable = e.skills.filter((id) => this.canUseSkill(e, id)).map((id) => SKILLS[id]);
    // босс лечится, если ранен
    const heal = usable.find((s) => s.kind === 'heal');
    if (heal && e.hp < e.stats.maxHp * 0.35 && this.rng() < 0.45) return this.act({ type: 'skill', skill: heal.id });
    const attacks = usable.filter((s) => s.kind === 'damage');
    const pick = () => {
      // чуть чаще бьём самого раненого
      const sorted = [...targets].sort((a, b) => a.hp / a.stats.maxHp - b.hp / b.stats.maxHp);
      return (this.rng() < 0.35 ? sorted[0] : targets[Math.floor(this.rng() * targets.length)]).uid;
    };
    if (attacks.length && this.rng() < (e.boss ? 0.7 : 0.45)) {
      const s = attacks[Math.floor(this.rng() * attacks.length)];
      return this.act({ type: 'skill', skill: s.id, target: pick() });
    }
    return this.act({ type: 'attack', target: pick() });
  }

  /** Перенести HP/SP обратно в сохранение. Павшие поднимаются с 1 HP. */
  writeBack(party: MemberState[]) {
    for (const m of party) {
      const c = this.party.find((x) => x.uid === m.id);
      if (!c) continue;
      m.hp = Math.max(1, c.hp);
      m.sp = c.sp;
    }
  }
}

function fxFor(s: SkillDef): string {
  if (s.kind === 'heal') return 'heal';
  if (s.kind === 'buff') return 'heal';
  switch (s.mood) {
    case 'rock':
      return 'fire';
    case 'lofi':
      return 'ice';
    case 'synth':
      return 'elec';
    case 'ballad':
      return 'slash';
    default:
      return 'dark';
  }
}

const avg = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
