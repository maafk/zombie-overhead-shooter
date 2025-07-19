import Phaser from "phaser";

/**
 * Handles spawning and basic AI for regular and gunner zombies. Bosses remain managed by PlayScene.
 */
export class ZombieManager {
  declare scene: Phaser.Scene;
  declare player: Phaser.GameObjects.Sprite;

  constructor(scene: Phaser.Scene, player: Phaser.GameObjects.Sprite) {
    this.scene = scene;
    this.player = player;
    const physics = scene.physics;
    this.zombies = physics.add.group();
    this.enemyBullets = physics.add.group();
    this.medkits = physics.add.group();
    this.shields = physics.add.group();
    this.gunnerSpawnCounter = 0;
    this.gunnerSpawnThreshold = Phaser.Math.Between(15, 20);

    // Periodic spawn timer (1 s)
    scene.time.addEvent({
      delay: 1000,
      callback: this.spawnZombie,
      callbackScope: this,
      loop: true
    });
  }

  // Accessors -----------------------------
  getZombies() { return this.zombies; }
  getEnemyBullets() { return this.enemyBullets; }
  getMedkits() { return this.medkits; }
  getShields() { return this.shields; }

  /** Call each frame to update zombie movement toward the player */
  update() {
    this.zombies.children.entries.forEach(z => {
      const zombie = z as Phaser.GameObjects.Sprite;
      if (zombie.getData('isGunner') && !zombie.getData('isBoss')) return; // stationary gunners
      const body = zombie.body as Phaser.Physics.Arcade.Body;
      const dx = this.player.x - zombie.x;
      const dy = this.player.y - zombie.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      const speed = 100;
      body.setVelocity((dx / distance) * speed, (dy / distance) * speed);
    });
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private spawnZombie() {
    const screenWidth = this.scene.cameras.main.width;
    const screenHeight = this.scene.cameras.main.height;
    const side = Phaser.Math.Between(0, 3);
    let x = 0, y = 0;
    switch (side) {
      case 0: // top
        x = Phaser.Math.Between(0, screenWidth);
        y = -30;
        break;
      case 1: // right
        x = screenWidth + 30;
        y = Phaser.Math.Between(0, screenHeight);
        break;
      case 2: // bottom
        x = Phaser.Math.Between(0, screenWidth);
        y = screenHeight + 30;
        break;
      case 3: // left
        x = -30;
        y = Phaser.Math.Between(0, screenHeight);
        break;
    }

    const bossAlive = this.zombies.getChildren().some(z => (z as Phaser.GameObjects.Sprite).getData('isBoss'));
    this.gunnerSpawnCounter++;

    if (!bossAlive && this.gunnerSpawnCounter >= this.gunnerSpawnThreshold) {
      // Spawn gunner in visible area
      const gunnerX = Phaser.Math.Between(50, screenWidth - 50);
      const gunnerY = Phaser.Math.Between(50, screenHeight - 50);
      const gunner = this.scene.physics.add.sprite(gunnerX, gunnerY, 'gunner');
      gunner.setScale(0.5);
      (gunner.body as Phaser.Physics.Arcade.Body).setCircle(gunner.width * 0.25);
      gunner.setData('isGunner', true);
      this.zombies.add(gunner);
      this.startGunnerShooting(gunner);

      this.gunnerSpawnCounter = 0;
      this.gunnerSpawnThreshold = Phaser.Math.Between(15, 20);
    } else {
      const zombie = this.scene.physics.add.sprite(x, y, 'zombie');
      zombie.setScale(0.5);
      (zombie.body as Phaser.Physics.Arcade.Body).setCircle(zombie.width * 0.25);
      this.zombies.add(zombie);
    }
  }

  private startGunnerShooting(gunner: Phaser.GameObjects.Sprite) {
    const shootTimer = this.scene.time.addEvent({
      delay: 1000,
      callback: () => this.gunnerShoot(gunner),
      loop: true
    });
    gunner.setData('shootTimer', shootTimer);

    gunner.on('destroy', () => {
      const timer: Phaser.Time.TimerEvent | undefined = gunner.getData('shootTimer');
      timer?.remove(false);
      // Drop pickup – 60% medkit else shield
      if (Math.random() < 0.6) {
        this.spawnMedkit(gunner.x, gunner.y);
      } else {
        this.spawnShield(gunner.x, gunner.y);
      }
    });
  }

  private gunnerShoot(gunner: Phaser.GameObjects.Sprite) {
    if (!gunner.active) return;
    const bullet = this.scene.add.circle(gunner.x, gunner.y, 4, 0xff0000);
    this.scene.physics.add.existing(bullet);
    this.enemyBullets.add(bullet);

    const bulletSpeed = 400;
    const dx = this.player.x - gunner.x;
    const dy = this.player.y - gunner.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const body = bullet.body as Phaser.Physics.Arcade.Body;
    body.setVelocity((dx / dist) * bulletSpeed, (dy / dist) * bulletSpeed);
  }

  private spawnMedkit(x: number, y: number) {
    const medkit = this.scene.add.rectangle(x, y, 16, 16, 0x00ff00);
    this.scene.physics.add.existing(medkit);
    this.medkits.add(medkit);
  }

  private spawnShield(x: number, y: number) {
    let obj: Phaser.GameObjects.GameObject;
    if (this.scene.textures.exists('shield')) {
      obj = this.scene.add.sprite(x, y, 'shield').setScale(0.4);
    } else {
      obj = this.scene.add.rectangle(x, y, 8, 8, 0x0000ff);
    }
    this.scene.physics.add.existing(obj);
    this.shields.add(obj as any);
  }
}

// Augment class with field types without emitting class field definitions
export interface ZombieManager {
  zombies: Phaser.Physics.Arcade.Group;
  enemyBullets: Phaser.Physics.Arcade.Group;
  medkits: Phaser.Physics.Arcade.Group;
  shields: Phaser.Physics.Arcade.Group;
  gunnerSpawnCounter: number;
  gunnerSpawnThreshold: number;
} 