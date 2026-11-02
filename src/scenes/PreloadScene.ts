import Phaser from 'phaser';
import manifest from 'virtual:asset-manifest';
import { C, CHAR_FRAME_H, CHAR_FRAME_W, CSS, TILE } from '../config';
import { CHARACTERS } from '../data/characters';
import { generateAll } from '../art/Procedural';
import { txt } from '../ui/widgets';

/**
 * Загружает всё, что есть в public/assets (по манифесту), остальное — генерирует.
 * Соглашения об именах — docs/ASSETS.md.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload() {
    const { width, height } = this.scale;
    const title = txt(this, width / 2, height / 2 - 40, 'ночные кассеты', 34, CSS.pink).setOrigin(0.5);
    const g = this.add.graphics();
    this.load.on('progress', (p: number) => {
      g.clear();
      g.fillStyle(C.plum, 1);
      g.fillRoundedRect(width / 2 - 200, height / 2 + 10, 400, 14, 7);
      g.fillStyle(C.pink, 1);
      g.fillRoundedRect(width / 2 - 200, height / 2 + 10, Math.max(14, 400 * p), 14, 7);
    });
    this.tweens.add({ targets: title, alpha: 0.5, yoyo: true, repeat: -1, duration: 900 });

    const sheets = new Set(Object.values(CHARACTERS).filter((c) => c.spriteKind === 'sheet').map((c) => c.sprite));
    for (const f of manifest) {
      const url = `assets/${f}`;
      const [dir, file] = f.split('/');
      if (!file) continue;
      const name = file.replace(/\.(png|jpe?g|webp)$/i, '');
      if (name === file) continue; // аудио грузит AudioManager
      switch (dir) {
        case 'sprites':
          if (sheets.has(name)) this.load.spritesheet(name, url, { frameWidth: CHAR_FRAME_W, frameHeight: CHAR_FRAME_H });
          else this.load.image(name, url);
          break;
        case 'portraits':
          this.load.image(`portrait_${name}`, url);
          break;
        case 'enemies':
          this.load.image(`enemy_${name}`, url);
          break;
        case 'icons':
          this.load.image(`icon_${name}`, url);
          break;
        case 'fx':
          this.load.image(`fx_${name}`, url);
          break;
        case 'bg':
          this.load.image(name, url);
          break;
        case 'tiles':
          if (name === 'tileset') this.load.spritesheet('tileset', url, { frameWidth: TILE, frameHeight: TILE });
          else this.load.image(`prop_${name}`, url);
          break;
        case 'ui':
          this.load.image(`ui_${name}`, url);
          break;
      }
    }
  }

  create() {
    generateAll(this);
    this.makeAnims();
    // пиксель-арт, который увеличивается, — без размытия
    for (const key of this.textures.getTextureKeys()) {
      if (/^(enemy_|fx_|icon_)/.test(key)) this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    this.scene.start('Menu');
  }

  /** Анимации ходьбы для персонажей со спрайт-листом 5×4 (4 кадра + idle). */
  private makeAnims() {
    const dirs = ['down', 'left', 'right', 'up'];
    for (const c of Object.values(CHARACTERS)) {
      if (c.spriteKind !== 'sheet' || !this.textures.exists(c.sprite)) continue;
      dirs.forEach((d, row) => {
        const base = row * 5;
        if (!this.anims.exists(`${c.sprite}_walk_${d}`))
          this.anims.create({ key: `${c.sprite}_walk_${d}`, frames: this.anims.generateFrameNumbers(c.sprite, { start: base, end: base + 3 }), frameRate: 8, repeat: -1 });
        if (!this.anims.exists(`${c.sprite}_idle_${d}`))
          this.anims.create({ key: `${c.sprite}_idle_${d}`, frames: [{ key: c.sprite, frame: base + 4 }], frameRate: 1 });
      });
    }
  }
}
