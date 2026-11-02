import { describe, it, expect, beforeEach } from 'vitest';
import { State } from '../src/systems/GameState';
import { Quests } from '../src/systems/QuestSystem';
import { DialogueRunner } from '../src/systems/DialogueRunner';
import { runEffects, giveItem, type WorldApi } from '../src/systems/Effects';
import { DIALOGUES } from '../src/data/dialogues';
import { MAPS } from '../src/data/maps';
import { check } from '../src/systems/conditions';

/** Фейковый мир: бои всегда выигрываются, оверлеи закрываются сразу. */
const log: string[] = [];
const api: WorldApi = {
  battle: async (g) => (log.push(`battle:${g.join('+')}`), 'win'),
  shop: async () => {},
  sleep: async () => State.healAll(),
  cassettePlayer: async () => {
    // как в меню кассет: слушаем первую кассету
    Quests.notify({ type: 'listen', cassette: 'cassette_1' });
  },
  save: async () => {},
  ending: async () => void log.push('ending'),
  wait: async () => {},
  gameOver: () => log.push('gameover'),
};

/** Проиграть диалог, выбирая варианты по порядку из choices. */
async function talk(id: string, choices: string[] = []) {
  const r = new DialogueRunner(DIALOGUES[id]);
  for (let guard = 0; guard < 200; guard++) {
    const s = r.next();
    if (!s) return;
    if ('choice' in s) {
      const want = choices.shift();
      const opt = s.choice.find((c) => c.text === want) ?? s.choice[0];
      r.choose(opt.goto);
    } else if ('do' in s) {
      const ok = await runEffects(s.do, api);
      if (!ok) return;
    }
  }
  throw new Error('dialogue loop ' + id);
}

function pickup(map: string, id: string) {
  const o = MAPS[map].objects.find((x) => x.type === 'pickup' && x.id === id);
  if (!o || o.type !== 'pickup') throw new Error('no pickup ' + id);
  expect(check(o.cond), `pickup ${id} available`).toBe(true);
  State.setFlag(`got_${o.id}`);
  giveItem(o.item);
  if (o.startQuest && !State.data.quests[o.startQuest]) Quests.start(o.startQuest);
}

function enter(map: string) {
  State.data.map = map;
  Quests.notify({ type: 'enter', map });
}

function canPass(map: string, to: string) {
  const d = MAPS[map].objects.find((o) => o.type === 'door' && o.to === to);
  return !!d && d.type === 'door' && check(d.cond);
}

const stage = () => State.data.quests.main.stage;

beforeEach(() => {
  State.reset();
  log.length = 0;
});

describe('полное прохождение главы 1', () => {
  it('проходится от начала до финала', async () => {
    await talk('intro');
    expect(canPass('apartment', 'street')).toBe(false);
    pickup('apartment', 'p_cas1');
    expect(stage()).toBe(1);
    await talk('apt_desk', ['Послушать кассету']);
    expect(State.has('walkman')).toBe(true);
    expect(stage()).toBe(2);
    expect(canPass('apartment', 'street')).toBe(true);

    enter('street');
    await talk('takeda');
    expect(stage()).toBe(3);
    await talk('sota'); // берём квест проездного
    expect(Quests.isActive('pass')).toBe(true);

    enter('konbini');
    await talk('aoki', ['Поговорить']); // квест бэнто
    expect(State.has('bento')).toBe(true);
    await talk('aoki', ['Купить что-нибудь']);
    State.add('fish_flakes'); // купили в магазине
    enter('street');
    await talk('takeda'); // доставка бэнто
    expect(State.has('cassette_3')).toBe(true);
    expect(State.data.quests.bento.done).toBe(true);

    enter('alley');
    expect(stage()).toBe(4);
    expect(canPass('alley', 'club')).toBe(false);
    await talk('fuji'); // ещё не время
    expect(State.flag('fuji_told')).toBeFalsy();
    await talk('ren');
    expect(State.member('ren')).toBeTruthy();
    expect(stage()).toBe(5);
    await talk('cat'); // квест кошки + кормим
    await talk('cat');
    expect(State.has('cassette_4')).toBe(true);
    pickup('alley', 'p_pass');
    await talk('fuji');
    expect(stage()).toBe(6);

    enter('street');
    await talk('sota');
    expect(State.has('cassette_2')).toBe(true);
    expect(canPass('street', 'rooftop')).toBe(false);

    enter('konbini');
    await talk('aoki', ['Ничего']);
    expect(State.has('roof_key')).toBe(true);
    expect(stage()).toBe(7);
    await talk('jin'); // квест дискеты
    expect(Quests.isActive('disk')).toBe(true);

    expect(canPass('street', 'rooftop')).toBe(true);
    enter('rooftop');
    pickup('rooftop', 'p_disk');
    await talk('miyu');
    expect(State.member('miyu')).toBeTruthy();
    expect(State.has('club_card')).toBe(true);
    expect(State.cassettes().length).toBe(5);
    expect(stage()).toBe(8);

    enter('konbini');
    await talk('jin');
    expect(State.data.quests.disk.done).toBe(true);
    expect(State.has('cd_charm')).toBe(true);

    expect(canPass('alley', 'club')).toBe(true);
    enter('club');
    expect(stage()).toBe(9);
    await talk('club_enter');
    await talk('club_boss');
    expect(log).toContain('battle:resonance');
    expect(State.has('cassette_6')).toBe(true);
    expect(stage()).toBe(10);

    enter('konbini');
    await talk('aoki');
    expect(State.flag('yume_reveal')).toBe(true);
    expect(State.data.quests.main.done).toBe(true);
    expect(log).toContain('ending');
    expect(log).not.toContain('gameover');
  });

  it('Мию не отдаёт карту, пока меньше трёх кассет', async () => {
    State.add('cassette_1');
    State.join('ren');
    await talk('miyu');
    expect(State.has('club_card')).toBe(false);
    expect(State.member('miyu')).toBeFalsy();
    State.add('cassette_2');
    State.add('cassette_3');
    await talk('miyu');
    expect(State.has('club_card')).toBe(true);
  });

  it('страницы дневника открывают квест и награду', () => {
    pickup('street', 'p_diary1');
    expect(Quests.isActive('diary')).toBe(true);
    pickup('alley', 'p_diary2');
    pickup('rooftop', 'p_diary3');
    expect(State.data.quests.diary.done).toBe(true);
  });
});
