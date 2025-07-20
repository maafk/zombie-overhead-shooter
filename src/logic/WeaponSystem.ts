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
  private activeTesla?: Phaser.GameObjects.Sprite;
  private activeSaw?: Phaser.GameObjects.Sprite;

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
    let debugCounter = 0;
    const startTime = performance.now();
    let totalIterations=0;

    this.scene.tweens.add({
      targets: ring,
      radius: 120,
      duration: 300,
      ease: 'Power2',
      onUpdate: () => {
        frameSkip++;
        if (frameSkip % 3 !== 0) return; // throttle checks

        debugCounter++;
        if(debugCounter % 10 === 0){
          console.log(`[SolidRing] radius=${ring.radius.toFixed(1)} zombies=${this.zombies.countActive()} frame=${frameSkip}`);
        }

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
            totalIterations++;
          }
        });
      },
      onComplete: () => {
        ring.destroy();
        console.log(`[SolidRing] finished. frames=${frameSkip} hits=${hitSet.size} iter=${totalIterations} time=${(performance.now()-startTime).toFixed(1)}ms`);
      }
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

  private shootSword() {
    // Short-range melee swipe: create a temporary hitbox in front of the player
    const angle = this.getFacingAngleFn();
    const offset = 40; // distance from player centre
    const x = this.player.x + Math.cos(angle) * offset;
    const y = this.player.y + Math.sin(angle) * offset;

    const sword = this.scene.add.sprite(x, y, 'sword');
    sword.setRotation(angle);
    this.scene.physics.add.existing(sword);
    this.bullets.add(sword);
    const body = sword.body as Phaser.Physics.Arcade.Body;
    // Make the sword hitbox a bit larger than sprite
    body.setCircle(20);
    body.setAllowGravity(false);
    sword.setData('damage', 30);
    sword.setData('weaponType', WeaponType.SWORD);

    // Destroy after a short duration so it can hit multiple enemies within the window
    this.scene.time.addEvent({ delay: 150, callback: () => sword.destroy() });
  }

  private shootSaw() {
    // Only one saw allowed at a time
    if (this.activeSaw && this.activeSaw.active) {
      return;
    }

    // Create a saw that revolves around the player 3 times and then disappears
    const revolutions = 3;
    const radius = 100;
    const durationPerRev = 1000; // 1 second per revolution
    const totalDuration = revolutions * durationPerRev;

    const saw = this.scene.add.sprite(this.player.x, this.player.y, 'saw');
    saw.setOrigin(0.5);
    this.scene.physics.add.existing(saw);
    this.bullets.add(saw);
    const body = saw.body as Phaser.Physics.Arcade.Body;
    body.setCircle(24);
    body.setAllowGravity(false);
    saw.setData('damage', 999); // one-shot regular zombies
    saw.setData('weaponType', WeaponType.SAW);

    this.activeSaw = saw;

    // Use a tween counter to update angle around the player
    this.scene.tweens.addCounter({
      from: 0,
      to: Math.PI * 2 * revolutions,
      duration: totalDuration,
      onUpdate: tween => {
        const value = tween.getValue() as number; // getValue may return null in typings
        const sx = this.player.x + Math.cos(value) * radius;
        const sy = this.player.y + Math.sin(value) * radius;
        saw.setPosition(sx, sy);
        body.reset(sx, sy);
      },
      onComplete: () => {
        saw.destroy();
        if (this.activeSaw === saw) {
          this.activeSaw = undefined;
        }
      }
    });
  }

  private placeTesla() {
    // Only one coil allowed at a time
    if (this.activeTesla && this.activeTesla.active) {
      return;
    }

    const coil = this.scene.add.sprite(this.player.x, this.player.y, 'tesla');
    coil.setOrigin(0.5);
    this.scene.physics.add.existing(coil);
    (coil.body as Phaser.Physics.Arcade.Body).setImmovable(true);
    coil.setData('isTesla', true);
    this.activeTesla = coil;

    // Periodically zap nearby zombies
    const zapRadius = 150;
    const zapDamage = 20;
    const interval = 500; // ms

    this.scene.time.addEvent({
      delay: interval,
      loop: true,
      callback: () => {
        if (!coil.active) return; // coil might have been destroyed in future versions
        this.zombies.children.each(child => {
          const zombie = child as Phaser.GameObjects.Sprite;
          if (!zombie.active) return false;
          const dx = zombie.x - coil.x;
          const dy = zombie.y - coil.y;
          const distSq = dx * dx + dy * dy;
          if (distSq <= zapRadius * zapRadius) {
            // Apply damage – full damage even to bosses
            this.damageCallback(zombie, zapDamage);
          }
          return false; // satisfy typing: boolean | null
        });
      }
    });
  }
} 