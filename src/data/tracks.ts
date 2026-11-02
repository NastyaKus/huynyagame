/**
 * Процедурные треки-заглушки (city pop / lo-fi через WebAudio).
 * Если положить public/assets/music/<id>.ogg|mp3 — будет играть файл.
 * chords — аккорды в полутонах от root (MIDI), один аккорд = один такт.
 */
export interface TrackDef {
  id: string;
  title: string;
  bpm: number;
  root: number;
  chords: number[][];
  lead: OscillatorType;
  pad: OscillatorType;
  drums: 'none' | 'soft' | 'beat' | 'battle';
  bass: 'none' | 'soft' | 'walk' | 'drive';
  seed: number;
  /** плотность мелодии 0..1 */
  density: number;
  /** шум плёнки */
  hiss?: boolean;
  /** громкость мелодии */
  leadGain?: number;
}

const maj7 = (r: number) => [r, r + 4, r + 7, r + 11];
const min7 = (r: number) => [r, r + 3, r + 7, r + 10];
const dom7 = (r: number) => [r, r + 4, r + 7, r + 10];
const add9 = (r: number) => [r, r + 4, r + 7, r + 14];

const list: TrackDef[] = [
  { id: 'menu', title: 'Ночные кассеты', bpm: 84, root: 53, chords: [maj7(0), min7(9), min7(2), dom7(7)], lead: 'triangle', pad: 'sawtooth', drums: 'soft', bass: 'soft', seed: 3, density: 0.45, hiss: true },
  { id: 'apartment', title: 'Тихая квартира', bpm: 72, root: 55, chords: [maj7(5), maj7(0), min7(9), add9(7)], lead: 'sine', pad: 'triangle', drums: 'none', bass: 'soft', seed: 11, density: 0.3, hiss: true },
  { id: 'street', title: 'Улица после полуночи', bpm: 96, root: 50, chords: [maj7(5), dom7(7), min7(4), min7(9)], lead: 'triangle', pad: 'sawtooth', drums: 'beat', bass: 'walk', seed: 21, density: 0.5 },
  { id: 'konbini', title: 'Свет витрин', bpm: 104, root: 57, chords: [maj7(0), maj7(5), min7(2), dom7(7)], lead: 'square', pad: 'triangle', drums: 'soft', bass: 'walk', seed: 33, density: 0.55, leadGain: 0.5 },
  { id: 'alley', title: 'Переулок', bpm: 80, root: 49, chords: [min7(0), min7(5), maj7(8), dom7(7)], lead: 'sine', pad: 'sawtooth', drums: 'beat', bass: 'soft', seed: 41, density: 0.35, hiss: true },
  { id: 'rooftop', title: 'Над проводами', bpm: 90, root: 52, chords: [add9(0), maj7(5), min7(9), add9(7)], lead: 'triangle', pad: 'sawtooth', drums: 'soft', bass: 'soft', seed: 55, density: 0.4 },
  { id: 'club', title: 'Пустой зал', bpm: 70, root: 48, chords: [min7(0), maj7(8), maj7(3), dom7(10)], lead: 'sine', pad: 'sawtooth', drums: 'none', bass: 'soft', seed: 61, density: 0.3, hiss: true },
  { id: 'battle', title: 'Шум!', bpm: 148, root: 50, chords: [min7(0), maj7(8), maj7(10), dom7(7)], lead: 'square', pad: 'sawtooth', drums: 'battle', bass: 'drive', seed: 71, density: 0.7, leadGain: 0.45 },
  { id: 'boss', title: 'Резонанс', bpm: 156, root: 45, chords: [min7(0), min7(5), maj7(8), dom7(7), min7(0), maj7(3), maj7(8), dom7(10)], lead: 'sawtooth', pad: 'sawtooth', drums: 'battle', bass: 'drive', seed: 89, density: 0.75, leadGain: 0.35 },

  // кассеты
  { id: 'tape1', title: 'Кассета без подписи', bpm: 76, root: 57, chords: [maj7(0), min7(4), min7(9), add9(5)], lead: 'sine', pad: 'triangle', drums: 'soft', bass: 'soft', seed: 101, density: 0.45, hiss: true },
  { id: 'tape2', title: 'Неоновый дождь', bpm: 112, root: 52, chords: [maj7(5), dom7(7), min7(4), min7(9)], lead: 'square', pad: 'sawtooth', drums: 'beat', bass: 'walk', seed: 202, density: 0.6, leadGain: 0.45 },
  { id: 'tape3', title: 'Комбини в 3 ночи', bpm: 68, root: 60, chords: [maj7(0), maj7(5), maj7(0), dom7(7)], lead: 'triangle', pad: 'triangle', drums: 'none', bass: 'soft', seed: 303, density: 0.35, hiss: true },
  { id: 'tape4', title: 'Кошачий переулок', bpm: 92, root: 50, chords: [min7(2), dom7(7), maj7(0), min7(9)], lead: 'triangle', pad: 'sawtooth', drums: 'beat', bass: 'walk', seed: 404, density: 0.5, hiss: true },
  { id: 'tape5', title: 'Над проводами', bpm: 100, root: 54, chords: [add9(0), add9(5), min7(9), dom7(7)], lead: 'sine', pad: 'sawtooth', drums: 'soft', bass: 'soft', seed: 505, density: 0.55 },
  { id: 'tape6', title: 'Lavender Note', bpm: 82, root: 53, chords: [maj7(0), min7(9), maj7(5), dom7(7), min7(4), min7(9), min7(2), dom7(7)], lead: 'triangle', pad: 'sawtooth', drums: 'soft', bass: 'walk', seed: 606, density: 0.5 },
];

export const TRACKS: Record<string, TrackDef> = Object.fromEntries(list.map((t) => [t.id, t]));
