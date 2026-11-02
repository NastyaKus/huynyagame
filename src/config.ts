/** Базовое логическое разрешение. Scale.EXPAND расширяет ширину под соотношение сторон телефона. */
export const BASE_W = 1280;
export const BASE_H = 720;

/** Размер тайла в мире (px). */
export const TILE = 48;

/** Кадр персонажа в спрайт-листе (px) и масштаб отображения. */
export const CHAR_FRAME_W = 96;
export const CHAR_FRAME_H = 152;
export const CHAR_SCALE = 0.5;

export const WALK_SPEED = 170;
export const RUN_SPEED = 265;

export const SAVE_VERSION = 1;

/** Палитра: pastel night / city pop. */
export const C = {
  night: 0x1d1428,
  night2: 0x2b1d3a,
  plum: 0x3d2850,
  violet: 0x5b3a6e,
  lilac: 0xb79ad6,
  pink: 0xf7b7d2,
  hotpink: 0xff8fc0,
  rose: 0xe58fb0,
  cream: 0xfff3f8,
  brown: 0x8a5a44,
  caramel: 0xd9a679,
  mint: 0x8fd3c7,
  gold: 0xffd98a,
  red: 0xff6f8e,
  shadow: 0x0d0814,
} as const;

export const CSS = {
  text: '#fff3f8',
  dim: '#c9b3dc',
  pink: '#f7b7d2',
  hotpink: '#ff8fc0',
  caramel: '#d9a679',
  mint: '#8fd3c7',
  gold: '#ffd98a',
  red: '#ff6f8e',
  lilac: '#b79ad6',
  night: '#1d1428',
} as const;

export const FONT = 'Nunito, "Trebuchet MS", sans-serif';

export const MOOD_INFO = {
  lofi: { name: 'Lo-fi', color: 0x8fd3c7, css: '#8fd3c7', glyph: '☾' },
  rock: { name: 'Rock', color: 0xe0875a, css: '#e0875a', glyph: '⚡' },
  synth: { name: 'Synth', color: 0xa78bfa, css: '#a78bfa', glyph: '◆' },
  ballad: { name: 'Ballad', color: 0xf7a8c8, css: '#f7a8c8', glyph: '♥' },
} as const;
