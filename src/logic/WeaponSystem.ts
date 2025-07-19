import Phaser from "phaser";
import { WeaponType } from "../constants/WeaponType";

/**
 * Centralises all weapon handling: current selection, cooldowns and bullet creation.
 */
export class WeaponSystem {
  private scene: Phaser.Scene;
  private player: Phaser.GameObjects.Sprite;
  private getFacingAngleFn: () => number;
  private zombies: Phaser.Physics.Arcade.Group;

  private currentWeapon: number = WeaponType.NORMAL;
  private lastShotTime = 0;
  private damageCallback: (zombie: Phaser.GameObjects.Sprite, amount:number)=>void;
  private bullets: Phaser.Physics.Arcade.Group;

  constructor(
    scene: Phaser.Scene,
    player: Phaser.GameObjects.Sprite,
    bulletsGroup: Phaser.Physics.Arcade.Group,
    getFacingAngle: () => number,
    zombies: Phaser.Physics.Arcade.Group,
    damageCallback: (z: Phaser.GameObjects.Sprite, dmg:number)=>void
  ) {
    this.scene = scene;
    this.player = player;
    this.bullets = bulletsGroup;
    this.getFacingAngleFn = getFacingAngle;
    this.zombies = zombies;
    this.damageCallback = damageCallback;
  }

  setWeapon(id: number) {
    this.currentWeapon = id;
  }

  /** Call continuously when the fire button is held */
  tryFire() {
    const cooldown = this.getCooldown();
    if (this.scene.time.now - this.lastShotTime > cooldown) {
      this.fireOnce();
      this.lastShotTime = this.scene.time.now;
    }
  }

  // --------------------------------------------------------------------
  private getCooldown(): number {
    switch (this.currentWeapon) {
      case WeaponType.NORMAL: return 200;
      case WeaponType.SPREAD: return 400;
      case WeaponType.THICK: return 600;
      case WeaponType.RING: return 1000;
      case WeaponType.SOLID_RING: return 800;
      case WeaponType.BOUNCY: return 450;
      case WeaponType.SWORD: return 700;
      case WeaponType.SAW: return 900;
      case WeaponType.TESLA: return 1000;
      default: return 200;
    }
  }

  private fireOnce() {
    switch (this.currentWeapon) {
      case WeaponType.NORMAL: this.shootNormal(); break;
      case WeaponType.SPREAD: this.shootSpread(); break;
      case WeaponType.THICK: this.shootThick(); break;
      case WeaponType.RING: this.shootRing(); break;
      case WeaponType.SOLID_RING: this.shootSolidRing(); break;
      case WeaponType.BOUNCY: this.shootBouncy(); break;
      case WeaponType.SWORD: this.shootSword(); break;
      case WeaponType.SAW: this.shootSaw(); break;
      case WeaponType.TESLA: this.placeTesla(); break;
    }
  }

  // ---- Individual weapon implementations (copied from original PlayScene) ----
  private shootNormal() {
    const bullet = this.scene.add.circle(this.player.x, this.player.y, 5, 0xffff00);
    this.scene.physics.add.existing(bullet);
    this.bullets.add(bullet);
    bullet.setData('damage', 10);
    bullet.setData('weaponType', WeaponType.NORMAL);
    const angle = this.getFacingAngleFn();
    const speed = 600;
    const body = bullet.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
  }

  private shootSpread() {
    const bulletSpeed = 600;
    const offsets = [-0.4, -0.2, 0, 0.2, 0.4];
    offsets.forEach(off => {
      const b = this.scene.add.circle(this.player.x, this.player.y, 4, 0xffa500);
      this.scene.physics.add.existing(b);
      this.bullets.add(b);
      b.setData('weaponType', WeaponType.SPREAD);
      const ang = this.getFacingAngleFn() + off;
      const body = b.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(Math.cos(ang) * bulletSpeed, Math.sin(ang) * bulletSpeed);
    });
  }

  private shootThick() {
    const bullet = this.scene.add.circle(this.player.x, this.player.y, 10, 0x00ffff);
    this.scene.physics.add.existing(bullet);
    this.bullets.add(bullet);
    bullet.setData('weaponType', WeaponType.THICK);
    const speed = 400;
    const ang = this.getFacingAngleFn();
    const body = bullet.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(Math.cos(ang) * speed, Math.sin(ang) * speed);
  }

  private shootRing() {
    const speed = 500; const count = 12;
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2;
      const b = this.scene.add.circle(this.player.x, this.player.y, 3, 0xff00ff);
      this.scene.physics.add.existing(b);
      this.bullets.add(b);
      b.setData('weaponType', WeaponType.RING);
      const body = b.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(Math.cos(ang) * speed, Math.sin(ang) * speed);
    }
  }

  private shootSolidRing() {
    const ring = this.scene.add.circle(this.player.x, this.player.y, 10, 0x00ff00, 0);
    ring.setStrokeStyle(8, 0x00ff00);

    const centerX = this.player.x;
    const centerY = this.player.y;
    const hitSet = new Set<Phaser.GameObjects.Sprite>();
    let frameSkip = 0;

    this.scene.tweens.add({
      targets: ring,
      radius: 120,
      duration: 300,
      ease: 'Power2',
      onUpdate: () => {
        frameSkip++;
        if (frameSkip % 3 !== 0) return; // throttle checks

        const cur = ring.radius as number;
        this.zombies.children.entries.forEach(z => {
          const zombie = z as Phaser.GameObjects.Sprite;
          if (!zombie.active || hitSet.has(zombie)) return;
          const dx = zombie.x - centerX;
          const dy = zombie.y - centerY;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist <= cur + 4 && dist >= cur - 14) { // within current sweep shell (10px thickness)
            hitSet.add(zombie);
            const dmg = zombie.getData('bossLevel') === 4 ? 33.33 : 20;
            this.damageCallback(zombie, dmg);
          }
        });
      },
      onComplete: () => ring.destroy()
    });
  }

  private shootBouncy() {
    const active = this.bullets.getChildren().filter(b => (b as any).getData?.('isBouncy')).length;
    if (active >= 10) return;
    const b = this.scene.add.circle(this.player.x, this.player.y, 5, 0x00ffff);
    this.scene.physics.add.existing(b);
    this.bullets.add(b);
    const body = b.body as Phaser.Physics.Arcade.Body;
    const speed = 500; const ang = this.getFacingAngleFn();
    body.setVelocity(Math.cos(ang) * speed, Math.sin(ang) * speed);
    body.setBounce(1,1); body.setCollideWorldBounds(true); body.onWorldBounds = true;
    b.setData('isBouncy', true); b.setData('weaponType', WeaponType.BOUNCY); b.setData('hits',0);
  }

  private shootSword() {/* TODO: keep sword logic inside PlayScene for now */}
  private shootSaw() {/* TODO: keep saw logic inside PlayScene for now */}
  private placeTesla() {/* TODO */}
} 