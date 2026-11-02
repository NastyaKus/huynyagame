import type { MemberDef } from './types';

const list: MemberDef[] = [
  {
    id: 'hana',
    name: 'Хана',
    joinLevel: 1,
    base: { maxHp: 62, maxSp: 32, atk: 8, def: 6, mag: 11, spd: 9 },
    growth: { maxHp: 9, maxSp: 5, atk: 2, def: 2, mag: 3, spd: 1.5 },
    skills: [
      { level: 1, skill: 'quiet_note' },
      { level: 1, skill: 'lullaby' },
      { level: 3, skill: 'tape_rustle' },
      { level: 5, skill: 'chorus' },
      { level: 7, skill: 'night_ballad' },
    ],
  },
  {
    id: 'ren',
    name: 'Рэн',
    joinLevel: 3,
    base: { maxHp: 74, maxSp: 24, atk: 12, def: 8, mag: 8, spd: 8 },
    growth: { maxHp: 11, maxSp: 4, atk: 3, def: 2, mag: 2, spd: 1.2 },
    skills: [
      { level: 1, skill: 'chill_loop' },
      { level: 1, skill: 'bass_drop' },
      { level: 4, skill: 'focus_beat' },
      { level: 6, skill: 'distortion' },
    ],
  },
  {
    id: 'miyu',
    name: 'Мию',
    joinLevel: 5,
    base: { maxHp: 56, maxSp: 40, atk: 7, def: 5, mag: 13, spd: 12 },
    growth: { maxHp: 8, maxSp: 6, atk: 1.5, def: 1.5, mag: 3, spd: 2 },
    skills: [
      { level: 1, skill: 'synth_spark' },
      { level: 1, skill: 'pop_heal' },
      { level: 5, skill: 'idol_wink' },
      { level: 7, skill: 'arpeggio_storm' },
    ],
  },
];

export const MEMBERS: Record<string, MemberDef> = Object.fromEntries(list.map((m) => [m.id, m]));

/** Опыт, нужный для перехода с уровня level на level+1. */
export function expToNext(level: number): number {
  return Math.round(24 + level * level * 9);
}

export const MAX_LEVEL = 30;
