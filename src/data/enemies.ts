import type { EnemyDef } from './types';

const list: EnemyDef[] = [
  {
    id: 'swarm', name: 'Рой', art: 'swarm',
    desc: 'Помехи, сбившиеся в куклу с телевизором вместо головы.',
    stats: { maxHp: 40, maxSp: 12, atk: 8, def: 4, mag: 7, spd: 7 },
    weak: ['ballad'], resist: ['synth'], skills: ['static_burst'],
    exp: 13, money: 60, drops: [{ item: 'onigiri', chance: 0.3 }],
  },
  {
    id: 'thread', name: 'Нить', art: 'thread',
    desc: 'Тонкая, как оборванная струна. Быстрая.',
    stats: { maxHp: 34, maxSp: 10, atk: 9, def: 3, mag: 6, spd: 13 },
    weak: ['synth'], resist: ['lofi'], skills: ['thread_bind'],
    exp: 14, money: 55, drops: [{ item: 'tea', chance: 0.35 }],
  },
  {
    id: 'doll', name: 'Кукла', art: 'doll',
    desc: 'Поёт песенку, которую никто не помнит.',
    stats: { maxHp: 52, maxSp: 15, atk: 9, def: 6, mag: 9, spd: 8 },
    weak: ['rock'], resist: ['ballad'], skills: ['doll_song'],
    exp: 17, money: 75, drops: [{ item: 'candy', chance: 0.2 }],
  },
  {
    id: 'eye', name: 'Око', art: 'eye',
    desc: 'Слушает слишком внимательно.',
    stats: { maxHp: 58, maxSp: 20, atk: 8, def: 6, mag: 13, spd: 10 },
    weak: ['lofi'], resist: ['synth'], skills: ['stare', 'feedback'],
    exp: 22, money: 90, drops: [{ item: 'energy', chance: 0.3 }],
  },
  {
    id: 'crystal', name: 'Кристалл', art: 'crystal',
    desc: 'Застывший глитч. Очень твёрдый.',
    stats: { maxHp: 66, maxSp: 16, atk: 12, def: 11, mag: 6, spd: 6 },
    weak: ['rock'], resist: ['lofi', 'ballad'], skills: ['shard_rain'],
    exp: 24, money: 110, drops: [{ item: 'melonpan', chance: 0.25 }],
  },
  {
    id: 'resonance', name: 'Резонанс', art: 'resonance', boss: true, scale: 1.0,
    desc: 'Эхо последней песни. Её слабость меняется вместе с мелодией.',
    stats: { maxHp: 520, maxSp: 999, atk: 14, def: 9, mag: 16, spd: 11 },
    weak: ['lofi'], resist: [], cycle: ['lofi', 'rock', 'synth', 'ballad'],
    skills: ['false_chord', 'resonance_wave', 'encore'],
    exp: 180, money: 1500, drops: [],
  },
];

export const ENEMIES: Record<string, EnemyDef> = Object.fromEntries(list.map((e) => [e.id, e]));

export function enemy(id: string): EnemyDef {
  const d = ENEMIES[id];
  if (!d) throw new Error(`Unknown enemy: ${id}`);
  return d;
}
