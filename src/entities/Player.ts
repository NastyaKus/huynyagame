import Phaser from 'phaser';
import { CHAR_FRAME_H, CHAR_FRAME_W, CHAR_SCALE, RUN_SPEED, WALK_SPEED } from '../config';
import type { Dir } from '../data/types';

/** Героиня: плавное движение с ускорением, 8 направлений, анимации из листа 5×4. */
export class Player extends Phaser.Physics.Arcade.Sprite {
  facing: Dir = 'down';
  private vx = 0;
  private vy = 0;
  shadow: Phaser.GameObjects.Image;
  invulnUntil = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, key = 'hana') {
    super(scene, x, y, key, 4);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, (CHAR_FRAME_H - 6) / CHAR_FRAME_H);
    this.setScale(CHAR_SCALE);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(56, 30);
    body.setOffset((CHAR_FRAME_W - 56) / 2, CHAR_FRAME_H - 6 - 30);
    body.setCollideWorldBounds(true);
    this.shadow = scene.add.image(x, y, 'shadow').setScale(0.75, 0.8);
    this.on('destroy', () => this.shadow.destroy());
  }

  /** v — вектор джойстика (длина 0..1). */
  move(v: { x: number; y: number }, run: boolean, dt: number) {
    const speed = run ? RUN_SPEED : WALK_SPEED;
    const tx = v.x * speed;
    const ty = v.y * speed;
    const k = 1 - Math.exp(-dt * (Math.hypot(tx, ty) > 1 ? 14 : 18));
    this.vx += (tx - this.vx) * k;
    this.vy += (ty - this.vy) * k;
    if (Math.abs(this.vx) < 2) this.vx = 0;
    if (Math.abs(this.vy) < 2) this.vy = 0;
    this.setVelocity(this.vx, this.vy);

    const mag = Math.hypot(v.x, v.y);
    if (mag > 0.15) {
      if (Math.abs(v.x) > Math.abs(v.y) * 1.1) this.facing = v.x < 0 ? 'left' : 'right';
      else this.facing = v.y < 0 ? 'up' : 'down';
    }
    const moving = Math.hypot(this.vx, this.vy) > 20;
    const key = this.texture.key;
    if (moving) {
      this.anims.play(`${key}_walk_${this.facing}`, true);
      this.anims.timeScale = Phaser.Math.Clamp(Math.hypot(this.vx, this.vy) / WALK_SPEED, 0.6, 1.7);
    } else {
      this.anims.play(`${key}_idle_${this.facing}`, true);
    }
    this.setDepth(this.y);
    this.shadow.setPosition(this.x, this.y - 2).setDepth(this.y - 1);
  }

  halt() {
    this.vx = this.vy = 0;
    this.setVelocity(0, 0);
    this.anims.play(`${this.texture.key}_idle_${this.facing}`, true);
    this.shadow.setPosition(this.x, this.y - 2);
  }

  face(dir: Dir) {
    this.facing = dir;
    this.anims.play(`${this.texture.key}_idle_${dir}`, true);
  }

  /** Точка «перед игроком» для поиска объектов взаимодействия. */
  frontPoint(dist = 30) {
    const d = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }[this.facing];
    return { x: this.x + d[0] * dist, y: this.y - 12 + d[1] * dist };
  }
}
