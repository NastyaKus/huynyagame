import type { SkillDef } from './types';

const list: SkillDef[] = [
  // Хана — баллада и лечение
  { id: 'quiet_note', name: 'Тихая нота', desc: 'Нежный удар звуком. Ballad.', mood: 'ballad', power: 30, sp: 4, target: 'enemy', kind: 'damage', stat: 'mag' },
  { id: 'lullaby', name: 'Колыбельная', desc: 'Лечит союзника.', power: 45, sp: 5, target: 'ally', kind: 'heal', stat: 'mag' },
  { id: 'tape_rustle', name: 'Шорох плёнки', desc: 'Тёплый шум старой кассеты. Lo-fi.', mood: 'lofi', power: 32, sp: 5, target: 'enemy', kind: 'damage', stat: 'mag' },
  { id: 'chorus', name: 'Припев', desc: 'Лечит весь отряд.', power: 34, sp: 11, target: 'allAllies', kind: 'heal', stat: 'mag' },
  { id: 'night_ballad', name: 'Ночная баллада', desc: 'Песня для всех врагов. Ballad.', mood: 'ballad', power: 27, sp: 10, target: 'allEnemies', kind: 'damage', stat: 'mag' },

  // Рэн — lo-fi битмейкер с тяжёлым басом
  { id: 'chill_loop', name: 'Ледяная петля', desc: 'Сэмпл, замёрзший в лупе. Lo-fi.', mood: 'lofi', power: 34, sp: 4, target: 'enemy', kind: 'damage', stat: 'mag' },
  { id: 'bass_drop', name: 'Бас-дроп', desc: 'Перегруженный бас бьёт как огонь. Rock.', mood: 'rock', power: 36, sp: 5, target: 'enemy', kind: 'damage', stat: 'atk' },
  { id: 'focus_beat', name: 'Ровный бит', desc: 'Отряд попадает в ритм: ATK +30% на 3 хода.', power: 0, sp: 8, target: 'allAllies', kind: 'buff', stat: 'mag', buff: { atk: 0.3, turns: 3 } },
  { id: 'distortion', name: 'Дисторшн', desc: 'Стена огненного звука по всем врагам. Rock.', mood: 'rock', power: 26, sp: 10, target: 'allEnemies', kind: 'damage', stat: 'atk' },

  // Мию — синт-поп, молнии и защита
  { id: 'synth_spark', name: 'Синт-искра', desc: 'Электрический арпеджиатор. Synth.', mood: 'synth', power: 34, sp: 4, target: 'enemy', kind: 'damage', stat: 'mag' },
  { id: 'idol_wink', name: 'Айдол-подмигивание', desc: 'Отряд воодушевлён: DEF +40% на 3 хода.', power: 0, sp: 7, target: 'allAllies', kind: 'buff', stat: 'mag', buff: { def: 0.4, turns: 3 } },
  { id: 'arpeggio_storm', name: 'Шторм арпеджио', desc: 'Молнии по всем врагам. Synth.', mood: 'synth', power: 27, sp: 10, target: 'allEnemies', kind: 'damage', stat: 'mag' },
  { id: 'pop_heal', name: 'Сладкий хук', desc: 'Прилипчивая мелодия лечит союзника.', power: 40, sp: 5, target: 'ally', kind: 'heal', stat: 'mag' },

  // Враги
  { id: 'static_burst', name: 'Взрыв помех', desc: '', power: 26, sp: 4, target: 'enemy', kind: 'damage', stat: 'mag' },
  { id: 'feedback', name: 'Обратная связь', desc: '', power: 18, sp: 7, target: 'allEnemies', kind: 'damage', stat: 'mag' },
  { id: 'thread_bind', name: 'Нить тишины', desc: '', power: 28, sp: 4, target: 'enemy', kind: 'damage', stat: 'atk' },
  { id: 'doll_song', name: 'Фальшивая песенка', desc: '', mood: 'ballad', power: 24, sp: 5, target: 'enemy', kind: 'damage', stat: 'mag' },
  { id: 'stare', name: 'Пристальный взгляд', desc: '', mood: 'lofi', power: 30, sp: 5, target: 'enemy', kind: 'damage', stat: 'mag' },
  { id: 'shard_rain', name: 'Дождь осколков', desc: '', power: 20, sp: 8, target: 'allEnemies', kind: 'damage', stat: 'atk' },
  { id: 'false_chord', name: 'Фальшивый аккорд', desc: '', power: 34, sp: 0, target: 'enemy', kind: 'damage', stat: 'mag' },
  { id: 'resonance_wave', name: 'Резонансная волна', desc: '', power: 26, sp: 0, target: 'allEnemies', kind: 'damage', stat: 'mag' },
  { id: 'encore', name: 'Бис без слов', desc: '', power: 60, sp: 0, target: 'self', kind: 'heal', stat: 'mag' },
];

export const SKILLS: Record<string, SkillDef> = Object.fromEntries(list.map((s) => [s.id, s]));

export function skill(id: string): SkillDef {
  const d = SKILLS[id];
  if (!d) throw new Error(`Unknown skill: ${id}`);
  return d;
}
