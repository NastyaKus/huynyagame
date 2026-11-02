import Phaser from 'phaser';
import { TILE } from '../config';

/** Шум на карте: парит, бродит у «дома», замечает игрока и преследует. */
export class FieldEnemy extends Phaser.GameObjects.Container {
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  aura: Phaser.GameObjects.Image;
  declare body: Phaser.Physics.Arcade.Body;
  homeX: number;
  homeY: number;
  stunnedUntil = 0;
  private wanderT = 0;
  private dir = new Phaser.Math.Vector2();
  private alert = false;
  private mark: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: string, public id: string, public group: string[], public radius = 190) {
    super(scene, x, y);
    this.homeX = x;
    this.homeY = y;
    this.shadow = scene.add.image(0, -2, 'shadow').setScale(0.7, 0.7);
    this.aura = scene.add.image(0, -34, 'glow').setTint(0xb06bff).setBlendMode(Phaser.BlendModes.ADD).setScale(0.9).setAlpha(0.5);
    const key = scene.textures.exists(`enemy_${kind}`) ? `enemy_${kind}` : 'fx_dark';
    this.sprite = scene.add.image(0, -8, key).setOrigin(0.5, 1);
    this.sprite.setScale(64 / Math.max(this.sprite.height, this.sprite.width * 0.8));
    this.mark = scene.add.text(0, -86, '!', { fontFamily: 'Nunito', fontSize: '28px', color: '#ff8fc0', fontStyle: '800' }).setOrigin(0.5).setAlpha(0);
    this.add([this.shadow, this.aura, this.sprite, this.mark]);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setSize(32, 18).setOffset(-16, -16);
    scene.tweens.add({ targets: this.sprite, y: -16, yoyo: true, repeat: -1, duration: 900 + Math.random() * 300, ease: 'Sine.InOut' });
    scene.tweens.add({ targets: this.aura, alpha: 0.2, yoyo: true, repeat: -1, duration: 700 });
  }

  stun(ms: number) {
    this.stunnedUntil = this.scene.time.now + ms;
    this.setAlpha(0.35);
    this.scene.time.delayedCall(ms, () => this.active && this.setAlpha(1));
  }

  update(dt: number, px: number, py: number, frozen: boolean) {
    const now = this.scene.time.now;
    if (frozen || now < this.stunnedUntil) {
      this.body.setVelocity(0, 0);
      this.setDepth(this.y);
      return;
    }
    const dPlayer = Phaser.Math.Distance.Between(this.x, this.y, px, py);
    const dHome = Phaser.Math.Distance.Between(this.x, this.y, this.homeX, this.homeY);
    const chasing = dPlayer < this.radius && dHome < this.radius * 2.2;
    if (chasing && !this.alert) {
      this.alert = true;
      this.mark.setAlpha(1).setScale(0.4);
      this.scene.tweens.add({ targets: this.mark, scale: 1, duration: 200, ease: 'Back.Out' });
      this.scene.time.delayedCall(900, () => this.mark.active && this.scene.tweens.add({ targets: this.mark, alpha: 0, duration: 300 }));
    }
    if (!chasing) this.alert = false;

    if (chasing) {
      this.dir.set(px - this.x, py - this.y).normalize();
      this.body.setVelocity(this.dir.x * 112, this.dir.y * 112);
    } else if (dHome > TILE * 2) {
      this.dir.set(this.homeX - this.x, this.homeY - this.y).normalize();
      this.body.setVelocity(this.dir.x * 60, this.dir.y * 60);
    } else {
      this.wanderT -= dt;
      if (this.wanderT <= 0) {
        this.wanderT = 1200 + Math.random() * 1800;
        const a = Math.random() * Math.PI * 2;
        const s = Math.random() < 0.35 ? 0 : 40;
        this.body.setVelocity(Math.cos(a) * s, Math.sin(a) * s);
      }
    }
    if (this.body.velocity.x !== 0) this.sprite.setFlipX(this.body.velocity.x > 0);
    this.setDepth(this.y);
  }
}
