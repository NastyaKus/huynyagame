import { QUESTS } from '../data/quests';
import type { QuestTrigger } from '../data/types';
import { State, addExp } from './GameState';
import { bus } from './events';

export type QuestEvent =
  | { type: 'pickup'; item: string }
  | { type: 'enter'; map: string }
  | { type: 'flag'; key: string }
  | { type: 'listen'; cassette: string }
  | { type: 'win'; tag: string };

export interface QuestUpdate {
  id: string;
  title: string;
  kind: 'start' | 'advance' | 'complete';
  text: string;
}

function matches(t: QuestTrigger | undefined, ev: QuestEvent): boolean {
  if (!t) return false;
  if ('pickup' in t) return ev.type === 'pickup' && ev.item === t.pickup;
  if ('enter' in t) return ev.type === 'enter' && ev.map === t.enter;
  if ('flag' in t) return ev.type === 'flag' && ev.key === t.flag;
  if ('listen' in t) return ev.type === 'listen' && ev.cassette === t.listen;
  if ('win' in t) return ev.type === 'win' && ev.tag === t.win;
  if ('items' in t) return t.items.every((i) => State.has(i));
  return false;
}

/** Условие уже выполнено «задним числом» (например, предмет подобран раньше старта квеста). */
function alreadySatisfied(t: QuestTrigger | undefined): boolean {
  if (!t) return false;
  if ('pickup' in t) return State.has(t.pickup);
  if ('flag' in t) return !!State.flag(t.flag);
  if ('items' in t) return t.items.every((i) => State.has(i));
  return false;
}

export const Quests = {
  isActive(id: string) {
    const q = State.data.quests[id];
    return !!q && !q.done;
  },

  currentText(id: string): string {
    const def = QUESTS[id];
    const q = State.data.quests[id];
    if (!def || !q) return '';
    if (q.done) return 'Выполнено';
    return def.stages[Math.min(q.stage, def.stages.length - 1)].text;
  },

  start(id: string): QuestUpdate[] {
    if (State.data.quests[id]) return [];
    State.data.quests[id] = { stage: 0, done: false };
    const def = QUESTS[id];
    const out: QuestUpdate[] = [{ id, title: def.title, kind: 'start', text: def.stages[0].text }];
    out.push(...this.catchUp(id));
    out.forEach((u) => bus.emit('quest', u));
    return out;
  },

  setStage(id: string, stage: number): QuestUpdate[] {
    const def = QUESTS[id];
    if (!State.data.quests[id]) State.data.quests[id] = { stage: 0, done: false };
    const q = State.data.quests[id];
    if (q.done) return [];
    if (stage >= def.stages.length) return this.complete(id);
    q.stage = stage;
    const u: QuestUpdate = { id, title: def.title, kind: 'advance', text: def.stages[stage].text };
    bus.emit('quest', u);
    return [u];
  },

  complete(id: string): QuestUpdate[] {
    const def = QUESTS[id];
    if (!State.data.quests[id]) State.data.quests[id] = { stage: 0, done: false };
    const q = State.data.quests[id];
    if (q.done) return [];
    q.done = true;
    q.stage = def.stages.length;
    const r = def.reward;
    if (r?.money) State.data.money += r.money;
    r?.items?.forEach((i) => State.add(i));
    if (r?.exp) for (const m of State.data.party) {
      const res = addExp(m, r.exp);
      if (res.levels) bus.emit('levelup', m.id, m.level, res.learned);
    }
    const u: QuestUpdate = { id, title: def.title, kind: 'complete', text: rewardText(r) };
    bus.emit('quest', u);
    return [u];
  },

  /** Продвинуть все активные квесты, чьё условие совпало с событием. */
  notify(ev: QuestEvent): QuestUpdate[] {
    const out: QuestUpdate[] = [];
    for (const [id, q] of Object.entries(State.data.quests)) {
      if (q.done) continue;
      const def = QUESTS[id];
      if (!def) continue;
      const stage = def.stages[q.stage];
      if (stage && matches(stage.on, ev)) {
        out.push(...this.advance(id));
      }
    }
    return out;
  },

  advance(id: string): QuestUpdate[] {
    const q = State.data.quests[id];
    const def = QUESTS[id];
    const next = q.stage + 1;
    const out = next >= def.stages.length ? this.complete(id) : this.setStage(id, next);
    if (!State.data.quests[id].done) out.push(...this.catchUp(id));
    return out;
  },

  /** Если условие текущей стадии уже выполнено — сразу продвигаем. */
  catchUp(id: string): QuestUpdate[] {
    const q = State.data.quests[id];
    const def = QUESTS[id];
    if (q.done) return [];
    const st = def.stages[q.stage];
    if (st && alreadySatisfied(st.on)) return this.advance(id);
    return [];
  },
};

function rewardText(r?: { money?: number; items?: string[]; exp?: number }): string {
  if (!r) return 'Квест выполнен';
  const parts: string[] = [];
  if (r.exp) parts.push(`+${r.exp} EXP`);
  if (r.money) parts.push(`+${r.money} ¥`);
  if (r.items?.length) parts.push('предмет');
  return parts.length ? `Награда: ${parts.join(', ')}` : 'Квест выполнен';
}
