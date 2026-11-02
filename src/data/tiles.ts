/**
 * Легенда тайлов. Порядок = индекс кадра в тайлсете (tileset.png, тайлы 48×48 в ряд по 8).
 * Чтобы заменить процедурные тайлы своими — нарисуй tileset.png в этом же порядке.
 */
export interface TileDef {
  ch: string;
  name: string;
  solid: boolean;
  /** свет от тайла */
  light?: { color: number; r: number; alpha?: number; dy?: number };
}

export const TILE_LIST: TileDef[] = [
  { ch: ' ', name: 'void', solid: true },
  { ch: '.', name: 'wood_floor', solid: false },
  { ch: 'r', name: 'rug', solid: false },
  { ch: '#', name: 'wall_in', solid: true },
  { ch: 'w', name: 'window_in', solid: true, light: { color: 0x9db4ff, r: 70, alpha: 0.25, dy: 30 } },
  { ch: '=', name: 'asphalt', solid: false },
  { ch: '-', name: 'road_line', solid: false },
  { ch: ',', name: 'sidewalk', solid: false },
  { ch: 'H', name: 'building', solid: true },
  { ch: 'O', name: 'shop_window', solid: true, light: { color: 0xffe2b0, r: 80, alpha: 0.32, dy: 30 } },
  { ch: '_', name: 'shop_floor', solid: false },
  { ch: 'S', name: 'shelf', solid: true },
  { ch: 'C', name: 'counter', solid: true },
  { ch: ':', name: 'alley_ground', solid: false },
  { ch: 'x', name: 'crate', solid: true },
  { ch: 'u', name: 'trash', solid: true },
  { ch: 'f', name: 'fence', solid: true },
  { ch: ';', name: 'roof_floor', solid: false },
  { ch: 'R', name: 'railing', solid: true },
  { ch: 'a', name: 'ac_unit', solid: true },
  { ch: 't', name: 'water_tank', solid: true },
  { ch: '+', name: 'club_floor', solid: false },
  { ch: '^', name: 'stage', solid: false },
  { ch: 'Y', name: 'speaker', solid: true },
  { ch: 'Q', name: 'bar', solid: true, light: { color: 0xff8fc0, r: 60, alpha: 0.25 } },
  { ch: 'B', name: 'bed', solid: true },
  { ch: 'D', name: 'desk', solid: true, light: { color: 0xffd98a, r: 70, alpha: 0.35 } },
  { ch: 'K', name: 'kitchen', solid: true },
  { ch: 'p', name: 'plant', solid: true },
  { ch: 'L', name: 'lamp', solid: true, light: { color: 0xffc98a, r: 150, alpha: 0.5, dy: -10 } },
  { ch: 'V', name: 'vending', solid: true, light: { color: 0x9fe8ff, r: 90, alpha: 0.42 } },
  { ch: 'b', name: 'bench', solid: true },
  { ch: '~', name: 'city_below', solid: true },
  { ch: 'd', name: 'doormat', solid: false },
  { ch: 'k', name: 'bookshelf', solid: true },
  { ch: 'o', name: 'table', solid: true },
  { ch: 'g', name: 'planter', solid: true },
  { ch: 's', name: 'stairs', solid: false },
  { ch: 'z', name: 'sofa', solid: true },
  { ch: 'N', name: 'neon_wall', solid: true },
  { ch: 'P', name: 'poster_wall', solid: true },
  { ch: 'T', name: 'sakura', solid: true, light: { color: 0xffa8d0, r: 70, alpha: 0.18 } },
  { ch: 'F', name: 'fridge', solid: true },
  { ch: 'v', name: 'tv', solid: true, light: { color: 0x9db4ff, r: 60, alpha: 0.3 } },
  { ch: 'c', name: 'crosswalk', solid: false },
  { ch: 'G', name: 'gate', solid: true },
];

export const TILE_INDEX: Record<string, number> = Object.fromEntries(TILE_LIST.map((t, i) => [t.ch, i]));
export const SOLID_INDICES = TILE_LIST.map((t, i) => (t.solid ? i : -1)).filter((i) => i >= 0);
export const TILESET_COLS = 8;
