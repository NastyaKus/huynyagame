import Phaser from 'phaser';
import { TILE } from '../config';
import { TILE_LIST, TILESET_COLS } from '../data/tiles';

/**
 * Процедурная графика — всё, чего нет в public/assets, рисуется здесь
 * в общей палитре (pastel night: сливовый, розовый, карамельный).
 */

type Ctx = CanvasRenderingContext2D;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function canvas(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: Ctx) => void) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h)!;
  const c = tex.getContext();
  draw(c);
  tex.refresh();
}

function rr(c: Ctx, x: number, y: number, w: number, h: number, r: number, fill?: string, stroke?: string, lw = 2) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  if (fill) {
    c.fillStyle = fill;
    c.fill();
  }
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = lw;
    c.stroke();
  }
}
function rect(c: Ctx, x: number, y: number, w: number, h: number, fill: string) {
  c.fillStyle = fill;
  c.fillRect(x, y, w, h);
}
function speckle(c: Ctx, x: number, y: number, w: number, h: number, n: number, colors: string[], seed: number, size = 2) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    c.fillStyle = colors[Math.floor(r() * colors.length)];
    c.fillRect(x + Math.floor(r() * w), y + Math.floor(r() * h), size, size);
  }
}

const T = TILE;

// ───────────────────────── тайлы ─────────────────────────
const TILE_DRAW: Record<string, (c: Ctx) => void> = {
  void: (c) => rect(c, 0, 0, T, T, '#120a1c'),
  wood_floor: (c) => {
    rect(c, 0, 0, T, T, '#7a5450');
    for (let i = 0; i < 4; i++) {
      rect(c, 0, i * 12, T, 1, '#5e3f3d');
      rect(c, 0, i * 12 + 1, T, 1, '#8c625c');
      rect(c, ((i * 17) % 40) + 4, i * 12, 1, 12, '#5e3f3d');
    }
    speckle(c, 0, 0, T, T, 14, ['#6c4846', '#86605a'], 7);
  },
  rug: (c) => {
    rect(c, 0, 0, T, T, '#c98aa8');
    speckle(c, 0, 0, T, T, 40, ['#d69ab6', '#bb7c9a'], 3);
  },
  wall_in: (c) => {
    const g = c.createLinearGradient(0, 0, 0, T);
    g.addColorStop(0, '#4a3460');
    g.addColorStop(1, '#5f4478');
    c.fillStyle = g;
    c.fillRect(0, 0, T, T);
    for (let x = 4; x < T; x += 12) rect(c, x, 0, 2, 38, 'rgba(255,220,240,0.06)');
    rect(c, 0, 38, T, 10, '#3a2a48');
    rect(c, 0, 38, T, 2, '#7b5c94');
  },
  window_in: (c) => {
    TILE_DRAW.wall_in(c);
    rr(c, 6, 6, 36, 28, 3, '#e8d5f0');
    const g = c.createLinearGradient(0, 8, 0, 32);
    g.addColorStop(0, '#2b2a6e');
    g.addColorStop(1, '#a86aa8');
    c.fillStyle = g;
    c.fillRect(9, 9, 30, 22);
    rect(c, 23, 9, 2, 22, '#e8d5f0');
    speckle(c, 9, 9, 30, 12, 6, ['#fff3f8'], 11, 1);
    c.fillStyle = '#fff3c8';
    c.beginPath();
    c.arc(32, 14, 3, 0, Math.PI * 2);
    c.fill();
  },
  asphalt: (c) => {
    rect(c, 0, 0, T, T, '#2e2838');
    speckle(c, 0, 0, T, T, 50, ['#38304a', '#262030', '#3d3550'], 5);
  },
  road_line: (c) => {
    TILE_DRAW.asphalt(c);
    rect(c, 8, 22, 32, 4, '#e8dcef');
  },
  crosswalk: (c) => {
    TILE_DRAW.asphalt(c);
    rect(c, 6, 0, 14, T, '#d8cce6');
    rect(c, 28, 0, 14, T, '#d8cce6');
    speckle(c, 0, 0, T, T, 20, ['#2e2838'], 9);
  },
  sidewalk: (c) => {
    rect(c, 0, 0, T, T, '#4a3d5c');
    rect(c, 0, 0, T, 1, '#5d4e72');
    rect(c, 0, 24, T, 1, '#3b3049');
    rect(c, 0, 0, 1, T, '#5d4e72');
    rect(c, 24, 0, 1, 24, '#3b3049');
    rect(c, 12, 24, 1, 24, '#3b3049');
    speckle(c, 0, 0, T, T, 12, ['#54466a', '#42364f'], 13);
  },
  building: (c) => {
    rect(c, 0, 0, T, T, '#3a2b4d');
    for (let y = 0; y < T; y += 8) {
      rect(c, 0, y, T, 1, '#2e2240');
      const off = (y / 8) % 2 === 0 ? 0 : 12;
      for (let x = off; x < T; x += 24) rect(c, x, y, 1, 8, '#2e2240');
    }
    speckle(c, 0, 0, T, T, 10, ['#46365c'], 21);
  },
  shop_window: (c) => {
    rect(c, 0, 0, T, T, '#3a2b4d');
    const g = c.createLinearGradient(0, 4, 0, 44);
    g.addColorStop(0, '#fff3dc');
    g.addColorStop(1, '#ffc9de');
    rr(c, 3, 4, 42, 40, 2, undefined, '#6d5287', 3);
    c.fillStyle = g;
    c.fillRect(5, 6, 38, 36);
    const r = rng(77);
    for (let s = 0; s < 3; s++) {
      rect(c, 6, 14 + s * 10, 36, 2, '#b08aa0');
      for (let i = 0; i < 6; i++) rect(c, 7 + i * 6, 9 + s * 10, 4, 5, ['#ff8fc0', '#8fd3c7', '#ffd98a', '#b79ad6'][Math.floor(r() * 4)]);
    }
  },
  shop_floor: (c) => {
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) rect(c, x * 24, y * 24, 24, 24, (x + y) % 2 ? '#c4b8d6' : '#d9cfe6');
    rect(c, 0, 0, T, 1, '#b3a6c7');
    rect(c, 0, 0, 1, T, '#b3a6c7');
  },
  shelf: (c) => {
    rr(c, 2, 2, 44, 44, 3, '#8f7aa8');
    const r = rng(31);
    for (let s = 0; s < 3; s++) {
      rect(c, 4, 15 + s * 14, 40, 3, '#5f4c78');
      for (let i = 0; i < 7; i++) rect(c, 5 + i * 5.6, 5 + s * 14, 4, 10, ['#ff8fc0', '#8fd3c7', '#ffd98a', '#f7b7d2', '#a9c1ff', '#e0875a'][Math.floor(r() * 6)]);
    }
  },
  counter: () => {},
  alley_ground: (c) => {
    rect(c, 0, 0, T, T, '#2c2535');
    speckle(c, 0, 0, T, T, 40, ['#352d40', '#241e2c', '#3a3146'], 17);
    c.strokeStyle = '#1c1724';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(5, 40);
    c.lineTo(18, 30);
    c.lineTo(22, 34);
    c.stroke();
  },
  crate: (c) => {
    rr(c, 3, 6, 42, 40, 3, '#7a5a44', '#4e3628', 2);
    rect(c, 3, 18, 42, 3, '#5e4332');
    rect(c, 3, 32, 42, 3, '#5e4332');
    rect(c, 6, 9, 36, 2, '#9a7458');
  },
  trash: (c) => {
    rr(c, 6, 10, 36, 36, 4, '#4b5a7a', '#2c3550', 2);
    rr(c, 4, 6, 40, 8, 3, '#5f7096');
    rect(c, 12, 20, 2, 20, '#3c4864');
    rect(c, 23, 20, 2, 20, '#3c4864');
    rect(c, 34, 20, 2, 20, '#3c4864');
  },
  fence: (c) => {
    rect(c, 0, 0, T, T, '#231a2e');
    for (let x = 2; x < T; x += 8) rr(c, x, 6, 5, 40, 2, '#5b4a6e');
    rect(c, 0, 12, T, 4, '#7b6890');
    rect(c, 0, 34, T, 4, '#7b6890');
  },
  roof_floor: (c) => {
    rect(c, 0, 0, T, T, '#4d3f63');
    rect(c, 0, 0, T, 1, '#5d4e75');
    rect(c, 0, 0, 1, T, '#5d4e75');
    rect(c, 0, 47, T, 1, '#3d3150');
    speckle(c, 0, 0, T, T, 16, ['#564771', '#45385a'], 41);
  },
  railing: (c) => {
    rect(c, 0, 4, T, 4, '#c9b3dc');
    rect(c, 0, 24, T, 3, '#a892c0');
    for (let x = 2; x < T; x += 12) rect(c, x, 4, 3, 40, '#b29ccb');
    rect(c, 0, 44, T, 3, '#6d5a85');
  },
  ac_unit: () => {},
  water_tank: () => {},
  club_floor: (c) => {
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) rect(c, x * 24, y * 24, 24, 24, (x + y) % 2 ? '#2a1b3d' : '#3a2654');
  },
  stage: (c) => {
    rect(c, 0, 0, T, T, '#5a3a4a');
    for (let i = 0; i < 4; i++) rect(c, 0, i * 12, T, 1, '#4a2e3c');
    speckle(c, 0, 0, T, T, 10, ['#6a4658'], 51);
  },
  speaker: (c) => {
    rr(c, 4, 2, 40, 44, 4, '#1f1828', '#463858', 2);
    for (const [y, r] of [[15, 9], [35, 7]] as const) {
      c.fillStyle = '#3a2f48';
      c.beginPath();
      c.arc(24, y, r, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#b06bff';
      c.beginPath();
      c.arc(24, y, r / 3, 0, Math.PI * 2);
      c.fill();
    }
  },
  bar: (c) => {
    rect(c, 0, 0, T, T, '#2e1f40');
    rect(c, 0, 0, T, 14, '#5a3d72');
    rect(c, 0, 14, T, 2, '#ff8fc0');
    rect(c, 6, 3, 4, 8, '#8fd3c7');
    rect(c, 30, 4, 5, 7, '#ffd98a');
  },
  bed: () => {},
  desk: () => {},
  kitchen: () => {},
  plant: (c) => {
    rr(c, 14, 30, 20, 16, 3, '#c98a64');
    const r = rng(71);
    for (let i = 0; i < 9; i++) {
      c.fillStyle = ['#6fb09a', '#8fd3c7', '#5a9884'][i % 3];
      c.beginPath();
      c.ellipse(24 + (r() - 0.5) * 22, 18 + (r() - 0.5) * 18, 7, 4, r() * 3, 0, Math.PI * 2);
      c.fill();
    }
  },
  lamp: () => {},
  vending: () => {},
  sakura: () => {},
  bench: (c) => {
    rect(c, 4, 18, 40, 6, '#a8745a');
    rect(c, 4, 27, 40, 6, '#a8745a');
    rect(c, 8, 33, 4, 12, '#4a3d5c');
    rect(c, 36, 33, 4, 12, '#4a3d5c');
    rect(c, 4, 10, 40, 5, '#8a5a44');
  },
  city_below: (c) => {
    const g = c.createLinearGradient(0, 0, 0, T);
    g.addColorStop(0, '#1b1230');
    g.addColorStop(1, '#2a1840');
    c.fillStyle = g;
    c.fillRect(0, 0, T, T);
    speckle(c, 0, 0, T, T, 9, ['#ffd98a', '#ff8fc0', '#8fd3c7'], 81, 2);
  },
  doormat: (c) => {
    rect(c, 0, 0, T, T, '#7a5450');
    rr(c, 3, 6, 42, 36, 4, '#8a5a44');
    speckle(c, 5, 8, 38, 32, 30, ['#9a6a52', '#7a4a38'], 91);
  },
  bookshelf: (c) => {
    rr(c, 2, 0, 44, 46, 2, '#6b4434');
    const r = rng(101);
    for (let s = 0; s < 3; s++) {
      rect(c, 4, 14 + s * 15, 40, 2, '#4e3026');
      for (let x = 5; x < 43; ) {
        const w = 3 + Math.floor(r() * 3);
        rect(c, x, 3 + s * 15 + Math.floor(r() * 3), w, 11, ['#e58fb0', '#b79ad6', '#8fd3c7', '#ffd98a', '#fff3f8'][Math.floor(r() * 5)]);
        x += w + 1;
      }
    }
  },
  table: () => {},
  planter: (c) => {
    rr(c, 2, 22, 44, 24, 3, '#6d5a85');
    const r = rng(111);
    for (let i = 0; i < 12; i++) {
      c.fillStyle = ['#5f9a8a', '#7cc0ae', '#4d8273'][i % 3];
      c.beginPath();
      c.arc(6 + r() * 36, 16 + r() * 12, 6, 0, Math.PI * 2);
      c.fill();
    }
  },
  stairs: (c) => {
    rect(c, 0, 0, T, T, '#3d3150');
    for (let y = 2; y < T; y += 8) rect(c, 4, y, 40, 5, '#8a7aa0');
    rect(c, 2, 0, 3, T, '#c9b3dc');
    rect(c, 43, 0, 3, T, '#c9b3dc');
  },
  sofa: () => {},
  neon_wall: (c) => {
    rect(c, 0, 0, T, T, '#1f1430');
    rect(c, 0, 30, T, 3, '#ff8fc0');
    rect(c, 0, 33, T, 2, 'rgba(255,143,192,0.35)');
    rect(c, 0, 10, T, 2, '#8a5fd0');
  },
  poster_wall: (c) => {
    TILE_DRAW.building(c);
    rect(c, 0, 0, T, T, 'rgba(20,10,30,0.25)');
  },
  fridge: (c) => {
    rr(c, 4, 0, 40, 46, 4, '#e8dcef', '#a596b8', 2);
    rect(c, 4, 16, 40, 2, '#a596b8');
    rect(c, 36, 6, 3, 8, '#a596b8');
    rect(c, 36, 22, 3, 14, '#a596b8');
  },
  tv: (c) => {
    rect(c, 6, 36, 36, 10, '#5a3d48');
    rr(c, 4, 4, 40, 30, 3, '#1f1828');
    const g = c.createLinearGradient(0, 6, 0, 32);
    g.addColorStop(0, '#9db4ff');
    g.addColorStop(1, '#b79ad6');
    c.fillStyle = g;
    c.fillRect(7, 7, 34, 24);
    speckle(c, 7, 7, 34, 24, 60, ['#ffffff', '#c9b3dc', '#7a6a9a'], 121, 1);
  },
  gate: (c) => {
    rect(c, 0, 0, T, T, '#2a2038');
    for (let x = 3; x < T; x += 7) rect(c, x, 0, 3, T, '#8a7aa0');
    rect(c, 0, 20, T, 4, '#a892c0');
  },
};

function drawTileset(scene: Phaser.Scene) {
  if (scene.textures.exists('tileset')) return;
  const rows = Math.ceil(TILE_LIST.length / TILESET_COLS);
  const tex = scene.textures.createCanvas('tileset', TILESET_COLS * T, rows * T)!;
  const c = tex.getContext();
  TILE_LIST.forEach((t, i) => {
    c.save();
    c.translate((i % TILESET_COLS) * T, Math.floor(i / TILESET_COLS) * T);
    c.beginPath();
    c.rect(0, 0, T, T);
    c.clip();
    (TILE_DRAW[t.name] ?? TILE_DRAW.void)(c);
    c.restore();
  });
  tex.refresh();
}

// ───────────────────── высокие объекты (сортируются по глубине) ─────────────────────
function drawProps(scene: Phaser.Scene) {
  canvas(scene, 'prop_lamp', 48, 128, (c) => {
    rect(c, 21, 30, 6, 92, '#4a3d5c');
    rect(c, 22, 30, 2, 92, '#6d5a85');
    rr(c, 14, 118, 20, 8, 3, '#3a2f48');
    rr(c, 8, 14, 32, 18, 6, '#6d5a85');
    rr(c, 12, 26, 24, 8, 4, '#ffe2b0');
    c.fillStyle = 'rgba(255,226,176,0.5)';
    c.beginPath();
    c.ellipse(24, 34, 14, 4, 0, 0, Math.PI * 2);
    c.fill();
  });
  canvas(scene, 'prop_vending', 48, 88, (c) => {
    rr(c, 3, 4, 42, 82, 5, '#d95b7c', '#8a2f4c', 2);
    rr(c, 7, 9, 34, 44, 3, '#fff3f8');
    const r = rng(131);
    for (let s = 0; s < 3; s++) for (let i = 0; i < 5; i++) rr(c, 9 + i * 6.4, 12 + s * 14, 4, 10, 2, ['#8fd3c7', '#ffd98a', '#b79ad6', '#e58fb0', '#a9c1ff'][Math.floor(r() * 5)]);
    rect(c, 9, 58, 30, 3, '#ffd98a');
    rr(c, 10, 66, 28, 14, 3, '#3a1f2e');
  });
  canvas(scene, 'prop_vending2', 48, 88, (c) => {
    rr(c, 3, 4, 42, 82, 5, '#5b7cd9', '#2f468a', 2);
    rr(c, 7, 9, 34, 44, 3, '#eef3ff');
    const r = rng(141);
    for (let s = 0; s < 3; s++) for (let i = 0; i < 5; i++) rr(c, 9 + i * 6.4, 12 + s * 14, 4, 10, 2, ['#8fd3c7', '#ffd98a', '#f7b7d2', '#e0875a'][Math.floor(r() * 4)]);
    rect(c, 9, 58, 30, 3, '#8fd3c7');
    rr(c, 10, 66, 28, 14, 3, '#1f2a4a');
  });
  canvas(scene, 'prop_sakura', 112, 140, (c) => {
    rect(c, 52, 70, 10, 66, '#5a3a3a');
    rect(c, 54, 70, 3, 66, '#7a5050');
    c.strokeStyle = '#5a3a3a';
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(57, 86);
    c.lineTo(36, 62);
    c.moveTo(57, 80);
    c.lineTo(80, 58);
    c.stroke();
    const r = rng(151);
    for (let i = 0; i < 60; i++) {
      const a = r() * Math.PI * 2;
      const d = r() * 44;
      c.fillStyle = ['#ffb7d5', '#f7a8c8', '#ffd0e4', '#e58fb0', '#fff0f6'][Math.floor(r() * 5)];
      c.beginPath();
      c.arc(56 + Math.cos(a) * d * 1.1, 50 + Math.sin(a) * d * 0.75, 7 + r() * 7, 0, Math.PI * 2);
      c.fill();
    }
  });
}

// ───────────────────── животные ─────────────────────
function drawCat(scene: Phaser.Scene, key: string, body: string, dark: string, belly: string) {
  canvas(scene, key, 48, 44, (c) => {
    c.fillStyle = 'rgba(13,8,20,0.35)';
    c.beginPath();
    c.ellipse(24, 40, 16, 4, 0, 0, Math.PI * 2);
    c.fill();
    // хвост
    c.strokeStyle = dark;
    c.lineWidth = 5;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(36, 34);
    c.quadraticCurveTo(46, 30, 42, 18);
    c.stroke();
    // тело
    c.fillStyle = body;
    c.beginPath();
    c.ellipse(26, 30, 13, 10, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = belly;
    c.beginPath();
    c.ellipse(22, 33, 6, 6, 0, 0, Math.PI * 2);
    c.fill();
    // голова
    c.fillStyle = body;
    c.beginPath();
    c.arc(17, 19, 10, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.moveTo(9, 14);
    c.lineTo(10, 3);
    c.lineTo(16, 10);
    c.moveTo(19, 10);
    c.lineTo(25, 3);
    c.lineTo(26, 14);
    c.fill();
    c.fillStyle = '#ff9ccc';
    c.beginPath();
    c.moveTo(11, 11);
    c.lineTo(11.5, 6);
    c.lineTo(14, 10);
    c.fill();
    // глаза
    c.fillStyle = '#ffd98a';
    c.beginPath();
    c.ellipse(13, 19, 2.4, 3, 0, 0, Math.PI * 2);
    c.ellipse(21, 19, 2.4, 3, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#1d1428';
    c.fillRect(12.4, 17, 1.4, 4);
    c.fillRect(20.4, 17, 1.4, 4);
    c.fillStyle = '#ff8fc0';
    c.fillRect(16, 23, 2, 1.5);
  });
}

// ───────────────────── иконки, которых нет в наборе ─────────────────────
function drawIcons(scene: Phaser.Scene) {
  const icon = (key: string, draw: (c: Ctx) => void) =>
    canvas(scene, `icon_${key}`, 48, 48, (c) => {
      rr(c, 2, 2, 44, 44, 9, '#3d2850', '#5b3a6e', 2);
      draw(c);
    });
  icon('onigiri', (c) => {
    c.fillStyle = '#fff3f8';
    c.beginPath();
    c.moveTo(24, 8);
    c.quadraticCurveTo(42, 36, 38, 38);
    c.lineTo(10, 38);
    c.quadraticCurveTo(6, 36, 24, 8);
    c.fill();
    rect(c, 15, 27, 18, 12, '#2b3a3a');
  });
  icon('bread', (c) => {
    c.fillStyle = '#e8c070';
    c.beginPath();
    c.arc(24, 26, 14, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#c99a4a';
    c.lineWidth = 1.5;
    for (let i = -2; i <= 2; i++) {
      c.beginPath();
      c.moveTo(14 + i * 4, 14);
      c.lineTo(28 + i * 4, 38);
      c.stroke();
    }
  });
  icon('fish', (c) => {
    rr(c, 12, 10, 24, 30, 4, '#8fd3c7', '#5a9884', 2);
    c.fillStyle = '#ff8fc0';
    c.beginPath();
    c.ellipse(22, 25, 7, 4, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.moveTo(29, 25);
    c.lineTo(33, 21);
    c.lineTo(33, 29);
    c.fill();
  });
  icon('bento', (c) => {
    rr(c, 8, 14, 32, 24, 4, '#e58fb0');
    rr(c, 6, 10, 36, 8, 3, '#f7b7d2');
    c.fillStyle = '#fff3f8';
    c.beginPath();
    c.arc(24, 12, 4, 0, Math.PI * 2);
    c.fill();
  });
  icon('jacket', (c) => {
    c.fillStyle = '#6f8fc0';
    c.beginPath();
    c.moveTo(14, 10);
    c.lineTo(34, 10);
    c.lineTo(42, 20);
    c.lineTo(38, 24);
    c.lineTo(36, 40);
    c.lineTo(12, 40);
    c.lineTo(10, 24);
    c.lineTo(6, 20);
    c.closePath();
    c.fill();
    rect(c, 23, 12, 2, 28, '#4a6a9a');
    rr(c, 27, 24, 7, 5, 1, '#ff8fc0');
  });
}

// ───────────────────── свет и частицы ─────────────────────
function drawFx(scene: Phaser.Scene) {
  canvas(scene, 'glow', 128, 128, (c) => {
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
  });
  canvas(scene, 'petal', 10, 8, (c) => {
    c.fillStyle = '#ffc4dc';
    c.beginPath();
    c.ellipse(5, 4, 4.5, 2.6, 0.4, 0, Math.PI * 2);
    c.fill();
  });
  canvas(scene, 'dot', 6, 6, (c) => {
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(3, 3, 3, 0, Math.PI * 2);
    c.fill();
  });
  canvas(scene, 'shadow', 48, 16, (c) => {
    c.fillStyle = 'rgba(13,8,20,0.38)';
    c.beginPath();
    c.ellipse(24, 8, 22, 7, 0, 0, Math.PI * 2);
    c.fill();
  });
  canvas(scene, 'sparkle', 24, 24, (c) => {
    c.fillStyle = '#fff3c8';
    c.beginPath();
    c.moveTo(12, 0);
    c.lineTo(14, 10);
    c.lineTo(24, 12);
    c.lineTo(14, 14);
    c.lineTo(12, 24);
    c.lineTo(10, 14);
    c.lineTo(0, 12);
    c.lineTo(10, 10);
    c.closePath();
    c.fill();
  });
  // запасные эффекты боя, если нет PNG
  const fx = (key: string, color: string) =>
    canvas(scene, `fx_${key}`, 96, 96, (c) => {
      const g = c.createRadialGradient(48, 48, 4, 48, 48, 46);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.3, color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 96, 96);
    });
  fx('slash', '#ff8fc0');
  fx('heal', '#8fd3c7');
  fx('fire', '#e0875a');
  fx('ice', '#a9c1ff');
  fx('elec', '#a78bfa');
  fx('dark', '#5b3a6e');
}

/** Размытая версия маленького фона боя на весь экран. */
function blurBackgrounds(scene: Phaser.Scene) {
  for (const name of ['street', 'alley', 'rooftop', 'club']) {
    const src = `battle_${name}`;
    const key = `bgb_${name}`;
    if (scene.textures.exists(key)) continue;
    const tex = scene.textures.createCanvas(key, 1280, 720)!;
    const c = tex.getContext();
    if (scene.textures.exists(src)) {
      const img = scene.textures.get(src).getSourceImage() as HTMLImageElement;
      c.filter = 'blur(10px) saturate(1.15)';
      const s = Math.max(1280 / img.width, 720 / img.height) * 1.08;
      c.drawImage(img, (1280 - img.width * s) / 2, (720 - img.height * s) / 2, img.width * s, img.height * s);
      c.filter = 'none';
    } else {
      const g = c.createLinearGradient(0, 0, 0, 720);
      g.addColorStop(0, '#2b1d4a');
      g.addColorStop(0.6, '#8a4a8a');
      g.addColorStop(1, '#1d1428');
      c.fillStyle = g;
      c.fillRect(0, 0, 1280, 720);
    }
    // виньетка и ночной тон
    const v = c.createRadialGradient(640, 360, 200, 640, 360, 800);
    v.addColorStop(0, 'rgba(29,20,40,0)');
    v.addColorStop(1, 'rgba(13,8,20,0.75)');
    c.fillStyle = v;
    c.fillRect(0, 0, 1280, 720);
    const f = c.createLinearGradient(0, 380, 0, 720);
    f.addColorStop(0, 'rgba(29,20,40,0)');
    f.addColorStop(1, 'rgba(29,20,40,0.85)');
    c.fillStyle = f;
    c.fillRect(0, 380, 1280, 340);
    tex.refresh();
  }
}

/** Силуэт города для параллакса в меню (бесшовный по горизонтали). */
function drawCity(scene: Phaser.Scene) {
  const layer = (key: string, h: number, color: string, winColors: string[], seed: number, minH: number, maxH: number) =>
    canvas(scene, key, 1280, h, (c) => {
      const r = rng(seed);
      let x = 0;
      while (x < 1280) {
        const w = 50 + Math.floor(r() * 90);
        const bw = Math.min(w, 1280 - x);
        const bh = minH + Math.floor(r() * (maxH - minH));
        rect(c, x, h - bh, bw, bh, color);
        if (r() < 0.3) rect(c, x + bw / 2 - 1, h - bh - 18, 2, 18, color);
        for (let wy = h - bh + 10; wy < h - 8; wy += 14)
          for (let wx = x + 8; wx < x + bw - 8; wx += 12) if (r() < 0.22) rect(c, wx, wy, 5, 7, winColors[Math.floor(r() * winColors.length)]);
        x += bw + 2;
      }
    });
  layer('city_far', 300, '#2a1c45', ['rgba(255,217,138,0.5)', 'rgba(255,143,192,0.45)'], 7, 90, 260);
  layer('city_near', 260, '#160d26', ['#ffd98a', '#ff8fc0', '#8fd3c7', '#fff3dc'], 13, 70, 220);
}

// ───────────────────── составная мебель (рисуется одним объектом на всю область) ─────────────────────
export const BIG_PROPS = new Set(['B', 'D', 'K', 'o', 'z', 'a', 't', 'C']);

export function bigProp(scene: Phaser.Scene, ch: string, wt: number, ht: number): string {
  const key = `big_${ch.charCodeAt(0)}_${wt}x${ht}`;
  const w = wt * T;
  const h = ht * T;
  canvas(scene, key, w, h + 16, (c) => {
    c.translate(0, 16);
    const sh = (x: number, y: number, ww: number, hh: number, r: number) => rr(c, x + 3, y + 5, ww, hh, r, 'rgba(13,8,20,0.35)');
    switch (ch) {
      case 'B': {
        sh(4, 2, w - 8, h - 6, 10);
        rr(c, 4, 0, w - 8, h - 6, 10, '#e8d5f0', '#a596b8', 2);
        rr(c, 12, 8, w - 24, 26, 10, '#fff3f8', '#d8c6e6', 2);
        rr(c, 8, 40, w - 16, h - 52, 8, '#e58fb0', '#c76f92', 2);
        rect(c, 8, 52, w - 16, 6, '#f7b7d2');
        speckle(c, 12, 62, w - 24, h - 78, 30, ['#f7a8c8', '#d27a9e'], 7, 3);
        break;
      }
      case 'D': {
        sh(0, 6, w, h - 10, 6);
        rr(c, 0, 6, w, h - 10, 6, '#8a5a44', '#5e3c2e', 2);
        rect(c, 0, 6, w, 14, '#b37a5c');
        rr(c, 10, -10, 40, 22, 4, '#3d2850');
        rect(c, 14, -6, 32, 8, '#ff8fc0');
        c.fillStyle = '#1d1428';
        c.beginPath();
        c.arc(22, -2, 3, 0, Math.PI * 2);
        c.arc(38, -2, 3, 0, Math.PI * 2);
        c.fill();
        rr(c, 58, -2, 22, 14, 2, '#fff3f8');
        rect(c, w - 22, -14, 4, 22, '#6d5a85');
        c.fillStyle = '#ffd98a';
        c.beginPath();
        c.ellipse(w - 20, -16, 12, 7, 0, 0, Math.PI * 2);
        c.fill();
        break;
      }
      case 'K': {
        sh(0, 0, w, h - 4, 4);
        rr(c, 0, 0, w, h - 4, 4, '#c9b8d8', '#a596b8', 2);
        rect(c, 0, 0, w, 14, '#e8dcef');
        c.fillStyle = '#3d3150';
        c.beginPath();
        c.arc(w - 34, 8, 6, 0, Math.PI * 2);
        c.arc(w - 14, 8, 6, 0, Math.PI * 2);
        c.fill();
        rr(c, 10, 2, 30, 12, 4, '#8a9ab8');
        rect(c, 6, 26, w - 12, 2, '#a596b8');
        break;
      }
      case 'C': {
        sh(0, 0, w, h - 4, 6);
        rr(c, 0, 0, w, h - 4, 6, '#8a5a44', '#5e3c2e', 2);
        rr(c, 0, 0, w, 18, 6, '#d9a679');
        rr(c, w / 2 - 16, -10, 32, 20, 3, '#5b3a6e');
        rect(c, w / 2 - 12, -6, 24, 7, '#8fd3c7');
        rr(c, 10, -4, 18, 12, 3, '#ffd98a');
        break;
      }
      case 'o': {
        sh(6, 8, w - 12, h - 14, 14);
        rr(c, 6, 8, w - 12, h - 14, 14, '#b37a5c', '#7a4f3c', 2);
        rr(c, 12, 12, w - 24, 10, 6, 'rgba(255,255,255,0.12)');
        rr(c, w / 2 - 22, h / 2 - 8, 16, 12, 4, '#fff3f8');
        rr(c, w / 2 + 6, h / 2 - 4, 22, 16, 2, '#b79ad6');
        break;
      }
      case 'z': {
        sh(2, 4, w - 4, h - 8, 12);
        rr(c, 2, 4, w - 4, h - 8, 12, '#7b5ca0', '#5a3f7e', 2);
        for (let i = 0; i < wt; i++) rr(c, 10 + i * T, 14, T - 14, h - 26, 8, '#9a7ac0');
        rr(c, 2, 4, w - 4, 12, 8, '#6a4c8e');
        break;
      }
      case 'a': {
        sh(4, 6, w - 8, h - 10, 6);
        rr(c, 4, 6, w - 8, h - 10, 6, '#a9a3b8', '#6f6884', 2);
        const r = Math.min(w, h) * 0.32;
        c.fillStyle = '#6f6884';
        c.beginPath();
        c.arc(w / 2, h / 2 + 2, r, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = '#c9c3d6';
        c.lineWidth = 3;
        for (let a = 0; a < 3; a++) {
          c.beginPath();
          c.arc(w / 2, h / 2 + 2, r * 0.7, a * 2.1, a * 2.1 + 1.2);
          c.stroke();
        }
        for (let y = 12; y < h - 8; y += 6) rect(c, 10, y, 8, 2, '#8a849c');
        break;
      }
      case 't': {
        sh(6, 0, w - 12, h - 4, 18);
        rr(c, 6, 0, w - 12, h - 4, 18, '#8a7aa0', '#5a4c70', 2);
        for (let y = 18; y < h - 8; y += 22) rect(c, 6, y, w - 12, 3, '#6d5f85');
        rect(c, 16, 4, 6, h - 14, 'rgba(255,255,255,0.14)');
        c.fillStyle = '#ff8fc0';
        c.font = 'bold 11px sans-serif';
        c.fillText('♡', w / 2 - 4, h / 2);
        break;
      }
    }
  });
  return key;
}

export function generateAll(scene: Phaser.Scene) {
  drawTileset(scene);
  drawProps(scene);
  drawCat(scene, 'cat', '#3a3046', '#2a2236', '#5a4c66');
  drawCat(scene, 'mochi', '#f2d6b8', '#d9a679', '#fff3e6');
  drawIcons(scene);
  drawFx(scene);
  blurBackgrounds(scene);
  drawCity(scene);
}
