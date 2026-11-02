import type { Cond } from '../data/types';
import { State } from './GameState';

export function check(c?: Cond): boolean {
  if (!c) return true;
  const s = State;
  if (c.flag !== undefined && !s.flag(c.flag)) return false;
  if (c.notFlag !== undefined && s.flag(c.notFlag)) return false;
  if (c.item !== undefined && !s.has(c.item)) return false;
  if (c.noItem !== undefined && s.has(c.noItem)) return false;
  if (c.questAt) {
    const q = s.data.quests[c.questAt[0]];
    if (!q || q.done || q.stage !== c.questAt[1]) return false;
  }
  if (c.questMin) {
    const q = s.data.quests[c.questMin[0]];
    if (!q || (!q.done && q.stage < c.questMin[1])) return false;
  }
  if (c.questActive !== undefined) {
    const q = s.data.quests[c.questActive];
    if (!q || q.done) return false;
  }
  if (c.questDone !== undefined && !s.data.quests[c.questDone]?.done) return false;
  if (c.questNotStarted !== undefined && s.data.quests[c.questNotStarted]) return false;
  if (c.cassettes !== undefined && s.cassettes().length < c.cassettes) return false;
  if (c.money !== undefined && s.data.money < c.money) return false;
  if (c.member !== undefined && !s.member(c.member)) return false;
  if (c.any && !c.any.some((x) => check(x))) return false;
  return true;
}
