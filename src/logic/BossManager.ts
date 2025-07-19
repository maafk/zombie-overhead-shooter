import Phaser from "phaser";

export class BossManager {
  private scene: Phaser.Scene;
  private player: Phaser.GameObjects.Sprite;
  private zombies: Phaser.Physics.Arcade.Group;
  private enemyBullets: Phaser.Physics.Arcade.Group;
  private bossHealthBar: Phaser.GameObjects.Graphics;

  // Boss spawn tracking
  private bossSpawned = false;
  private secondBossSpawned = false;
  private thirdBossSpawned = false;
  private fourthBossSpawned = false;

  // Boss defeated tracking
  private boss1Defeated = false;
  private boss2Defeated = false;
  private boss3Defeated = false;
  private boss4Defeated = false;

  // Callbacks for rewards
  private onBossKilled?: (level: number, scoreReward: number) => void;
  private onWeaponUnlocked?: (weaponName: string) => void;
  private onShieldCapacityIncrease?: (newCapacity: number) => void;

  constructor(
    scene: Phaser.Scene,
    player: Phaser.GameObjects.Sprite,
    zombies: Phaser.Physics.Arcade.Group,
    enemyBullets: Phaser.Physics.Arcade.Group
  ) {
    this.scene = scene;
    this.player = player;
    this.zombies = zombies;
    this.enemyBullets = enemyBullets;
    this.bossHealthBar = scene.add.graphics();
  }

  /** Register callbacks for boss events */
  setCallbacks(callbacks: {
    onBossKilled?: (level: number, scoreReward: number) => void;
    onWeaponUnlocked?: (weaponName: string) => void;
    onShieldCapacityIncrease?: (newCapacity: number) => void;
  }) {
    this.onBossKilled = callbacks.onBossKilled;
    this.onWeaponUnlocked = callbacks.onWeaponUnlocked;
    this.onShieldCapacityIncrease = callbacks.onShieldCapacityIncrease;
  }

  /** Check spawn conditions and spawn bosses as needed */
  checkSpawnConditions(zombieKillCount: number, score: number, isSandbox: boolean) {
    // Boss 1: 100 kills
    if (!this.boss1Defeated && !this.bossSpawned && zombieKillCount >= 100) {
      this.spawnBoss1();
    }

    // Boss 2: 200 kills
    if (!this.boss2Defeated && !this.secondBossSpawned && zombieKillCount >= 200) {
      this.spawnBoss2();
    }

    // Boss 3: 300 kills
    if (!this.boss3Defeated && !this.thirdBossSpawned && zombieKillCount >= 300) {
      this.spawnBoss3();
    }

    // Boss 4: score >= 4000
    if (!this.boss4Defeated && !this.fourthBossSpawned && score >= 4000) {
      this.spawnBoss4();
    }

    // Auto-spawn in sandbox mode based on score
    if (isSandbox) {
      if (!this.fourthBossSpawned && score >= 4000) {
        this.spawnBoss4();
      } else if (!this.thirdBossSpawned && score >= 300) {
        this.spawnBoss3();
      } else if (!this.secondBossSpawned && score >= 200) {
        this.spawnBoss2();
      } else if (!this.bossSpawned && score >= 100) {
        this.spawnBoss1();
      }
    }
  }

  /** Handle boss death and rewards */
  killBoss(boss: Phaser.GameObjects.Sprite) {
    const level = boss.getData('bossLevel') || 1;
    boss.destroy();

    // Clear health bar
    this.bossHealthBar.clear();

    // Increase shield capacity for all bosses
    this.onShieldCapacityIncrease?.(150);

    // Handle specific rewards
    switch (level) {
      case 1:
        this.bossSpawned = false;
        this.boss1Defeated = true;
        this.onWeaponUnlocked?.('Bouncy Gun');
        this.onBossKilled?.(1, 50);
        break;
      case 2:
        this.secondBossSpawned = false;
        this.boss2Defeated = true;
        this.onWeaponUnlocked?.('Sword');
        this.onBossKilled?.(2, 70);
        break;
      case 3:
        this.thirdBossSpawned = false;
        this.boss3Defeated = true;
        this.onWeaponUnlocked?.('Saw');
        this.onBossKilled?.(3, 100);
        break;
      case 4:
        this.fourthBossSpawned = false;
        this.boss4Defeated = true;
        this.onWeaponUnlocked?.('Tesla Coil');
        this.onBossKilled?.(4, 100);
        break;
    }
  }

  /** Get boss defeated states for save/load */
  getDefeatedStates() {
    return {
      boss1Defeated: this.boss1Defeated,
      boss2Defeated: this.boss2Defeated,
      boss3Defeated: this.boss3Defeated,
      boss4Defeated: this.boss4Defeated
    };
  }

  /** Set boss defeated states for save/load */
  setDefeatedStates(states: {
    boss1Defeated: boolean;
    boss2Defeated: boolean;
    boss3Defeated: boolean;
    boss4Defeated: boolean;
  }) {
    this.boss1Defeated = states.boss1Defeated;
    this.boss2Defeated = states.boss2Defeated;
    this.boss3Defeated = states.boss3Defeated;
    this.boss4Defeated = states.boss4Defeated;
  }

  /** Call once per frame */
  update() {
    this.updateOrbit();
    this.updateHealthBar();
  }

  // ----------------------------------------------------------
  // Internal helpers
  // ----------------------------------------------------------

  private spawnBoss1() {
    this.bossSpawned = true;

    const screenWidth = this.scene.cameras.main.width;
    const screenHeight = this.scene.cameras.main.height;
    const x = Phaser.Math.Between(50, screenWidth - 50);
    const y = Phaser.Math.Between(50, screenHeight - 50);

    const boss = this.scene.physics.add.sprite(x, y, 'gunner');
    boss.setScale(1.2);
    boss.setDepth(5);
    this.zombies.add(boss);

    boss.setData('isGunner', true);
    boss.setData('isBoss', true);
    boss.setData('health', 150);
    boss.setData('bossLevel', 1);
    boss.setData('maxHealth', 150);

    // Shooting timer
    const shootTimer = this.scene.time.addEvent({
      delay: 667,
      callback: () => this.gunnerShoot(boss),
      loop: true
    });
    boss.setData('shootTimer', shootTimer);

    // Eliminate non-boss gunners
    this.zombies.getChildren().forEach(child => {
      if (child === boss) return;
      const sprite = child as Phaser.GameObjects.Sprite;
      if (sprite.texture.key === 'gunner' && !sprite.getData('isBoss')) {
        sprite.destroy();
      }
    });

    boss.on('destroy', () => {
      const timer: Phaser.Time.TimerEvent | undefined = boss.getData('shootTimer');
      if (timer) timer.remove(false);
    });
  }

  private spawnBoss2() {
    this.secondBossSpawned = true;

    const screenWidth = this.scene.cameras.main.width;
    const screenHeight = this.scene.cameras.main.height;
    const x = Phaser.Math.Between(50, screenWidth - 50);
    const y = Phaser.Math.Between(50, screenHeight - 50);

    const boss = this.scene.physics.add.sprite(x, y, 'boss2');
    boss.setScale(1.4);
    boss.setDepth(5);
    this.zombies.add(boss);

    boss.setData('isBoss', true);
    boss.setData('bossLevel', 2);
    boss.setData('health', 200);
    boss.setData('maxHealth', 200);

    const shootTimer = this.scene.time.addEvent({
      delay: 600,
      callback: () => this.bossSpreadShoot(boss),
      loop: true
    });
    boss.setData('shootTimer', shootTimer);

    boss.on('destroy', () => {
      const timer: Phaser.Time.TimerEvent | undefined = boss.getData('shootTimer');
      if (timer) timer.remove(false);
    });
  }

  private spawnBoss3() {
    this.thirdBossSpawned = true;

    const screenWidth = this.scene.cameras.main.width;
    const screenHeight = this.scene.cameras.main.height;
    const x = Phaser.Math.Between(50, screenWidth - 50);
    const y = Phaser.Math.Between(50, screenHeight - 50);

    const boss = this.scene.physics.add.sprite(x, y, 'boss3');
    boss.setScale(1.6);
    boss.setDepth(5);
    this.zombies.add(boss);

    boss.setData('isBoss', true);
    boss.setData('bossLevel', 3);
    boss.setData('health', 250);
    boss.setData('maxHealth', 250);

    const timer = this.scene.time.addEvent({
      delay: 800,
      callback: () => this.bossSolidRingAttack(boss),
      loop: true
    });
    boss.setData('shootTimer', timer);

    boss.on('destroy', () => {
      timer.remove(false);
    });
  }

  private spawnBoss4() {
    this.fourthBossSpawned = true;

    const x = Phaser.Math.Between(50, this.scene.cameras.main.width - 50);
    const y = Phaser.Math.Between(50, this.scene.cameras.main.height - 50);
    const boss = this.scene.physics.add.sprite(x, y, 'boss4');
    boss.setScale(1.6);
    boss.setDepth(6);
    this.zombies.add(boss);

    boss.setData('isBoss', true);
    boss.setData('bossLevel', 4);
    boss.setData('health', 500);
    boss.setData('maxHealth', 500);

    const timer = this.scene.time.addEvent({
      delay: 800,
      callback: () => this.bossThrowRock(boss),
      loop: true
    });
    boss.setData('shootTimer', timer);
    boss.on('destroy', () => timer.remove(false));
  }

  private gunnerShoot(gunner: Phaser.GameObjects.Sprite) {
    if (!gunner.active) return;

    const bullet = this.scene.add.circle(gunner.x, gunner.y, 4, 0xff0000);
    this.scene.physics.add.existing(bullet);
    this.enemyBullets.add(bullet);

    const bulletSpeed = 400;
    const dx = this.player.x - gunner.x;
    const dy = this.player.y - gunner.y;
    const distance = Math.sqrt(dx * dx + dy * dy) || 1;

    const body = bullet.body as Phaser.Physics.Arcade.Body;
    body.setVelocity((dx / distance) * bulletSpeed, (dy / distance) * bulletSpeed);

    if (gunner.getData('isBoss')) {
      bullet.setData('isBossBullet', true);
    }
  }

  private bossSpreadShoot(boss: Phaser.GameObjects.Sprite) {
    if (!boss.active) return;

    const bulletSpeed = 450;
    const angleToPlayer = Math.atan2(this.player.y - boss.y, this.player.x - boss.x);
    const offsets = [-0.3, -0.15, 0, 0.15, 0.3];

    offsets.forEach(off => {
      const bullet = this.scene.add.circle(boss.x, boss.y, 4, 0xffa500);
      this.scene.physics.add.existing(bullet);
      this.enemyBullets.add(bullet);
      const angle = angleToPlayer + off;
      const body = bullet.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(Math.cos(angle) * bulletSpeed, Math.sin(angle) * bulletSpeed);
      bullet.setData('isBossBullet', true);
    });
  }

  private bossSolidRingAttack(boss: Phaser.GameObjects.Sprite) {
    if (!boss.active) return;
    const ring = this.scene.add.circle(boss.x, boss.y, 10, 0xffaaaa, 0);
    ring.setStrokeStyle(8, 0xffaaaa);
    const cx = boss.x, cy = boss.y;
    let prev = 10;

    // Need to get applyDamage callback from scene
    const scene = this.scene as any;

    this.scene.tweens.add({
      targets: ring,
      radius: 120,
      duration: 400,
      ease: 'Power2',
      onUpdate: () => {
        const cur = ring.radius;
        const dx = this.player.x - cx;
        const dy = this.player.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= cur && dist >= prev - 10) {
          scene.applyDamage?.(20);
        }
        prev = cur;
      },
      onComplete: () => ring.destroy()
    });
  }

  private bossThrowRock(boss: Phaser.GameObjects.Sprite) {
    if (!boss.active) return;
    const rock = this.scene.add.sprite(boss.x, boss.y, 'rock');
    this.scene.physics.add.existing(rock);
    this.enemyBullets.add(rock);
    rock.setData('isBossRock', true);
    rock.setDepth(5);
    const speed = 400;
    const dx = this.player.x - boss.x;
    const dy = this.player.y - boss.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    (rock.body as Phaser.Physics.Arcade.Body).setVelocity((dx / dist) * speed, (dy / dist) * speed);
  }

  private updateOrbit() {
    const dt = this.scene.game.loop.delta / 1000;
    this.zombies.children.entries.forEach(z => {
      const boss = z as Phaser.GameObjects.Sprite;
      if (!boss.getData('isBoss')) return;
      if (boss.getData('orbitRadius') == null) return;

      let angle: number = boss.getData('orbitAngle');
      const speed: number = boss.getData('orbitSpeed');
      const radius: number = boss.getData('orbitRadius');

      angle += speed * dt;
      boss.setData('orbitAngle', angle);

      const centerX = this.scene.cameras.main.width / 2;
      const centerY = this.scene.cameras.main.height / 2;

      boss.x = centerX + Math.cos(angle) * radius;
      boss.y = centerY + Math.sin(angle) * radius;

      const body = boss.body as Phaser.Physics.Arcade.Body;
      if (body) {
        body.x = boss.x - body.width / 2;
        body.y = boss.y - body.height / 2;
      }
    });
  }

  private updateHealthBar() {
    const boss = this.zombies.getChildren().find(z => (z as Phaser.GameObjects.Sprite).getData('isBoss')) as Phaser.GameObjects.Sprite | undefined;
    if (!boss || !boss.active) {
      this.bossHealthBar.clear();
      return;
    }

    const health: number = boss.getData('health');
    const maxHealth: number = boss.getData('maxHealth') ?? 150;

    const barWidth = 300;
    const barHeight = 20;
    const x = (this.scene.cameras.main.width - barWidth) / 2;
    const y = 20;

    const healthPercent = Phaser.Math.Clamp(health / maxHealth, 0, 1);

    this.bossHealthBar.clear();
    this.bossHealthBar.fillStyle(0x444444, 1);
    this.bossHealthBar.fillRect(x, y, barWidth, barHeight);
    this.bossHealthBar.fillStyle(0xffaa00, 1);
    this.bossHealthBar.fillRect(x, y, barWidth * healthPercent, barHeight);
  }
} 