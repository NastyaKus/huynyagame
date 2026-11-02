import type { Emo } from './types';

/**
 * Персонажи для диалогов и спрайтов.
 * sprite: ключ текстуры на карте. 'sheet' — лист 5×4 (ходьба), 'single' — одна картинка.
 * emos: какие эмоции реально нарисованы (остальные откатятся к neutral).
 */
export interface CharacterDef {
  id: string;
  name: string;
  color: string;
  sprite: string;
  spriteKind: 'sheet' | 'single';
  emos: Emo[];
}

const list: CharacterDef[] = [
  { id: 'hana', name: 'Хана', color: '#f7b7d2', sprite: 'hana', spriteKind: 'sheet', emos: ['neutral', 'smile', 'surprised', 'sad', 'angry', 'shy', 'tired'] },
  { id: 'ren', name: 'Рэн', color: '#c9b3f0', sprite: 'ren', spriteKind: 'sheet', emos: ['neutral', 'smile', 'surprised', 'angry'] },
  { id: 'miyu', name: 'Мию', color: '#ff9ccc', sprite: 'miyu', spriteKind: 'sheet', emos: ['neutral', 'smile', 'sad', 'angry'] },
  { id: 'aoki', name: 'Аоки', color: '#d9a679', sprite: 'npc_aoki', spriteKind: 'single', emos: ['neutral'] },
  { id: 'fuji', name: 'Фудзи', color: '#e0b88a', sprite: 'npc_fuji', spriteKind: 'single', emos: ['neutral'] },
  { id: 'kana', name: 'Кана', color: '#b79ad6', sprite: 'npc_kana', spriteKind: 'single', emos: ['neutral'] },
  { id: 'jin', name: 'Дзин', color: '#8fd3c7', sprite: 'npc_jin', spriteKind: 'single', emos: ['neutral'] },
  { id: 'takeda', name: 'Такэда-сан', color: '#f0c3d8', sprite: 'npc_takeda', spriteKind: 'single', emos: ['neutral'] },
  { id: 'sota', name: 'Сота', color: '#a9c1ff', sprite: 'npc_sota', spriteKind: 'single', emos: ['neutral'] },
  { id: 'toru', name: 'Тору', color: '#d9a679', sprite: 'npc_toru', spriteKind: 'single', emos: ['neutral'] },
  { id: 'girl', name: 'Девочка в белом', color: '#e6d3ff', sprite: 'npc_girl', spriteKind: 'single', emos: ['neutral'] },
  { id: 'yume', name: 'Юмэ', color: '#ffd98a', sprite: 'npc_aoki', spriteKind: 'single', emos: ['neutral'] },
  { id: 'cat', name: 'Кошка', color: '#ffd98a', sprite: 'cat', spriteKind: 'single', emos: [] },
  { id: 'mochi', name: 'Моти', color: '#ffd98a', sprite: 'mochi', spriteKind: 'single', emos: [] },
  { id: 'resonance', name: 'Резонанс', color: '#e6d3ff', sprite: 'npc_girl', spriteKind: 'single', emos: [] },
];

export const CHARACTERS: Record<string, CharacterDef> = Object.fromEntries(list.map((c) => [c.id, c]));

/** Портрет: у Юмэ — портрет Аоки (это один человек). */
export function portraitKey(who: string, emo: Emo = 'neutral'): string | null {
  const id = who === 'yume' ? 'aoki' : who;
  const c = CHARACTERS[id];
  if (!c || c.emos.length === 0) return null;
  const e = c.emos.includes(emo) ? emo : 'neutral';
  return `portrait_${id}_${e}`;
}
