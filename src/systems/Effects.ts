import type { Effect } from '../data/types';
import { ITEMS } from '../data/items';
import { MEMBERS } from '../data/party';
import { State } from './GameState';
import { Quests } from './QuestSystem';
import { bus } from './events';
import { Audio2 } from './Audio';

export type BattleResult = 'win' | 'lose' | 'fled';

/** То, что эффекты умеют просить у игрового мира (реализует WorldScene). */
export interface WorldApi {
  battle(group: string[], opts: { bg?: string; boss?: boolean; music?: string; noFlee?: boolean }): Promise<BattleResult>;
  shop(id: string): Promise<void>;
  sleep(): Promise<void>;
  cassettePlayer(): Promise<void>;
  save(): Promise<void>;
  ending(): Promise<void>;
  wait(ms: number): Promise<void>;
  gameOver(): void;
}

/** Выдать предмет с тостом и уведомлением квестов. */
export function giveItem(id: string, n = 1, silent = false) {
  State.add(id, n);
  const def = ITEMS[id];
  if (!silent) {
    Audio2.sfx(def.kind === 'cassette' ? 'cassette' : 'pickup');
    bus.emit('toast', `${def.kind === 'cassette' ? '📼 ' : ''}Получено: ${def.name}${n > 1 ? ` ×${n}` : ''}`, def.kind === 'cassette' ? 'cassette' : 'item');
  }
  Quests.notify({ type: 'pickup', item: id });
}

export function setFlag(key: string, value: boolean | number | string = true) {
  State.setFlag(key, value);
  Quests.notify({ type: 'flag', key });
}

/** Выполнить эффекты по очереди. false — прервать диалог (например, бой проигран). */
export async function runEffects(effects: Effect[], api: WorldApi): Promise<boolean> {
  for (const e of effects) {
    if ('flag' in e) setFlag(e.flag, e.value ?? true);
    else if ('unflag' in e) State.unflag(e.unflag);
    else if ('give' in e) giveItem(e.give, e.n ?? 1);
    else if ('take' in e) State.remove(e.take, e.n ?? 1);
    else if ('money' in e) {
      State.data.money += e.money;
      bus.emit('toast', `${e.money > 0 ? '+' : ''}${e.money} ¥`, 'money');
    } else if ('quest' in e) {
      if (e.complete) Quests.complete(e.quest);
      else if (e.stage !== undefined) Quests.setStage(e.quest, e.stage);
      else Quests.start(e.quest);
    } else if ('battle' in e) {
      const r = await api.battle(e.battle, { bg: e.bg, boss: e.boss, music: e.music, noFlee: e.noFlee });
      if (r === 'lose') {
        api.gameOver();
        return false;
      }
      if (r === 'win' && e.winFlag) setFlag(e.winFlag);
      if (r === 'fled') return false;
    } else if ('join' in e) {
      if (!State.member(e.join)) {
        State.join(e.join);
        Audio2.sfx('levelup');
        bus.emit('toast', `${MEMBERS[e.join].name} в отряде!`, 'party');
      }
    } else if ('shop' in e) await api.shop(e.shop);
    else if ('sleep' in e) await api.sleep();
    else if ('cassettePlayer' in e) await api.cassettePlayer();
    else if ('heal' in e) State.healAll();
    else if ('ending' in e) await api.ending();
    else if ('sfx' in e) Audio2.sfx(e.sfx as any);
    else if ('music' in e) Audio2.play(e.music);
    else if ('save' in e) await api.save();
    else if ('wait' in e) await api.wait(e.wait);
  }
  return true;
}
