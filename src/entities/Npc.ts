import Phaser from 'phaser';
import { CHAR_FRAME_H, CHAR_SCALE, TILE } from '../config';
import type { Dir } from '../data/types';

const DIRS: Dir[] = ['down', 'left', 'right', 'up'];

/**
 * NPC: либо лист 5×4 (как у героини), либо одиночная картинка (NPC из набора ассетов).
 * Стоит на месте или бродит в радиусе wander тайлов.
 */
export class Npc extends Phaser.GameObjects.Container {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  glow?: Phaser.GameObjects.Image;
  isSheet: boolean;
  facing: Dir;
  homeX: number;
  homeY: number;
  private wander: number;
  private target: { x: number; y: number } | null = null;
  private wait = 1500 + Math.random() * 2000;
  declare body: Phaser.Physics.Arcade.Body;

  constructor(scene: Phaser.Scene, x: number, y: number, key: string, facing: Dir = 'down', wander = 0, scale = 1, glow?: number) {
    super(scene, x, y);
    this.homeX = x;
    this.homeY = y;
    this.wander = wander * TILE;
    this.facing = facing;
    this.isSheet = scene.anims.exists(`${key}_idle_down`);
    this.shadow = scene.add.image(0, -2, 'shadow').setScale(0.75 * scale, 0.8);
    if (glow !== undefined) {
      this.glow = scene.add.image(0, -36 * scale, 'glow').setTint(glow).setBlendMode(Phaser.BlendModes.ADD).setScale(1.3 * scale).setAlpha(0.55);
      scene.tweens.add({ targets: this.glow, alpha: 0.25, yoyo: true, repeat: -1, duration: 1400 });
    }
    if (this.isSheet) {
      this.sprite = scene.add.sprite(0, 0, key, 4).setOrigin(0.5, (CHAR_FRAME_H - 6) / CHAR_FRAME_H).setScale(CHAR_SCALE * scale);
      this.sprite.anims.play(`${key}_idle_${facing}`);
    } else {
      this.sprite = scene.add.sprite(0, 0, key).setOrigin(0.5, 1);
      const h = key === 'cat' || key === 'mochi' ? 44 : 72;
      this.sprite.setScale((h / this.sprite.height) * scale);
    }
    this.add([this.shadow, ...(this.glow ? [this.glow] : []), this.sprite]);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setSize(30, 18).setOffset(-15, -16);
    this.body.setImmovable(true);
    this.body.pushable = false;
    // лёгкое «дыхание»
    scene.tweens.add({ targets: this.sprite, scaleY: this.sprite.scaleY * 1.015, yoyo: true, repeat: -1, duration: 1300 + Math.random() * 400, ease: 'Sine.InOut' });
    this.setDepth(y);
  }

  face(dir: Dir) {
    this.facing = dir;
    if (this.isSheet) this.sprite.anims.play(`${this.sprite.texture.key}_idle_${dir}`, true);
    else if ((dir === 'left' || dir === 'right') && ['cat', 'mochi'].includes(this.sprite.texture.key)) this.sprite.setFlipX(dir === 'right');
  }

  faceToward(x: number, y: number) {
    const dx = x - this.x;
    const dy = y - this.y;
    this.face(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down');
  }

  bounce() {
    this.scene.tweens.add({ targets: this.sprite, y: -6, yoyo: true, duration: 120 });
  }

  update(dt: number, frozen: boolean) {
    if (!this.wander || frozen) {
      this.body.setVelocity(0, 0);
      if (this.isSheet && this.target) this.sprite.anims.play(`${this.sprite.texture.key}_idle_${this.facing}`, true);
      this.target = null;
      this.setDepth(this.y);
      return;
    }
    if (!this.target) {
      this.wait -= dt;
      if (this.wait <= 0) {
        this.target = { x: this.homeX + (Math.random() * 2 - 1) * this.wander, y: this.homeY + (Math.random() * 2 - 1) * this.wander * 0.5 };
      }
    } else {
      const dx = this.target.x - this.x;
      const dy = this.target.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d < 6 || (this.body.blocked.none === false && Math.random() < 0.05)) {
        this.target = null;
        this.wait = 2000 + Math.random() * 3000;
        this.body.setVelocity(0, 0);
        if (this.isSheet) this.sprite.anims.play(`${this.sprite.texture.key}_idle_${this.facing}`, true);
      } else {
        this.body.setVelocity((dx / d) * 55, (dy / d) * 55);
        const dir: Dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
        this.facing = dir;
        if (this.isSheet) this.sprite.anims.play(`${this.sprite.texture.key}_walk_${dir}`, true);
      }
    }
    this.setDepth(this.y);
  }
}

export { DIRS };
