import { Scene } from "phaser";

const WeaponType = {
  NORMAL: 0,
  SPREAD: 1,
  THICK: 2,
  RING: 3,
  SOLID_RING: 4,
  BOUNCY: 5
} as const;

export class PlayScene extends Scene {
  private player!: Phaser.GameObjects.Sprite;
  private playerDirection!: Phaser.GameObjects.Rectangle;
  private zombies!: Phaser.Physics.Arcade.Group;
  private bullets!: Phaser.Physics.Arcade.Group;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private numberKeys!: { [key: number]: Phaser.Input.Keyboard.Key };
  private pauseKey!: Phaser.Input.Keyboard.Key;
  private isPaused = false;
  private pauseText!: Phaser.GameObjects.Text;
  private lastShotTime = 0;
  private shotCooldown = 200; // milliseconds
  private score = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private weaponText!: Phaser.GameObjects.Text;
  private facingAngle = 0; // angle in radians, 0 = right, PI/2 = down, PI = left, -PI/2 = up
  private currentWeapon: number = WeaponType.NORMAL;
  private playerMaxHealth = 100;
  private playerHealth = 100;
  private healthBar!: Phaser.GameObjects.Graphics;
  // --- Shield related ---
  private playerMaxShield = 100;
  private playerShield = 0;
  private shieldBar!: Phaser.GameObjects.Graphics;

  // Track zombie kills to grant shield every 20 kills
  private zombieKillCount = 0;

  // --- Boss related ---
  private bossSpawned = false;
  private bossHealthBar!: Phaser.GameObjects.Graphics;

  // Unlockable weapons
  private bouncyUnlocked = false;
  private enemyBullets!: Phaser.Physics.Arcade.Group;
  private gunnerSpawnCounter = 0;
  private gunnerSpawnThreshold = Phaser.Math.Between(15, 20);
  private medkits!: Phaser.Physics.Arcade.Group;

  constructor() {
    super("play");
  }

  preload() {
    // Load zombie sprite (public domain asset from Kenney Top-down Shooter pack)
    // Place PNG at `public/zombie.png` (e.g. PNG 64×64 px) or update the path below
    this.load.image('zombie', 'zombie.png');
    // Load hero sprite
    this.load.image('hero', 'hero.png');
    // Load gunner zombie sprite
    this.load.image('gunner', 'gunner.png');
  }

  create() {
    // Create player sprite in center of screen
    const centerX = this.cameras.main.width / 2;
    const centerY = this.cameras.main.height / 2;

    this.player = this.physics.add.sprite(centerX, centerY, 'hero');
    this.player.setScale(0.5);
    (this.player.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);
    // Optional: use a small circular body
    (this.player.body as Phaser.Physics.Arcade.Body).setCircle(this.player.width * 0.25);

    // Remove the old arrow indicator, we will rotate the player sprite itself
    this.playerDirection = this.add.rectangle(0, 0, 0, 0, 0x000000, 0); // hidden placeholder to keep rest of code
   
    // Create groups for zombies and bullets
    this.zombies = this.physics.add.group();
    this.bullets = this.physics.add.group();
    // Group for bullets fired by gunner zombies
    this.enemyBullets = this.physics.add.group();
    // Group for medkits dropped by gunners
    this.medkits = this.physics.add.group();

    // Initialize input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.pauseKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.P);
    
    // Initialize number keys for weapon selection
    this.numberKeys = {
      1: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
      2: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
      3: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
      4: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR),
      5: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.FIVE),
      6: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SIX)
    };

    // Create score text
    this.scoreText = this.add.text(16, 16, 'Score: 0', {
      fontSize: '32px',
      color: '#ffffff'
    });

    // Create weapon text
    this.weaponText = this.add.text(16, 60, 'Weapon: Normal (1)', {
      fontSize: '24px',
      color: '#ffffff'
    });

    // Reset health on (re)start and create health bar
    this.playerHealth = this.playerMaxHealth;
    this.healthBar = this.add.graphics();
    // Initialize shield graphics
    this.playerShield = 0;
    this.shieldBar = this.add.graphics();
    this.updateHealthBar();

    // Note: Boss will spawn dynamically after 100 kills; no immediate spawn at create.

    // Set up collision detection
    this.physics.add.overlap(this.bullets, this.zombies, this.bulletHitZombie, undefined, this);
    this.physics.add.overlap(this.player, this.zombies, this.playerHitZombie, undefined, this);
    // Damage player when hit by enemy bullets (from gunners)
    this.physics.add.overlap(this.player, this.enemyBullets, this.playerHitEnemyBullet, undefined, this);
    // Heal player when touching medkit
    this.physics.add.overlap(this.player, this.medkits, this.playerTouchMedkit, undefined, this);

    // Spawn zombies periodically
    this.time.addEvent({
      delay: 1000, // spawn every second
      callback: this.spawnZombie,
      callbackScope: this,
      loop: true
    });

    // Pause overlay text (hidden initially)
    this.pauseText = this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2, 'PAUSED', {
      fontSize: '48px',
      color: '#ffffff'
    }).setOrigin(0.5);
    this.pauseText.setVisible(false);
  }

  update() {
    // Toggle pause
    if (Phaser.Input.Keyboard.JustDown(this.pauseKey)) {
      this.isPaused = !this.isPaused;
      if (this.isPaused) {
        this.pauseGame();
      } else {
        this.resumeGame();
      }
    }

    if (this.isPaused) {
      return; // Skip rest of update while paused
    }

    // Player movement and facing direction with arrow keys
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    playerBody.setVelocity(0);

    // Handle movement and calculate facing direction based on key combinations
    let moveX = 0;
    let moveY = 0;

    if (this.cursors.left?.isDown) {
      moveX = -1;
      playerBody.setVelocityX(-300);
    }
    if (this.cursors.right?.isDown) {
      moveX = 1;
      playerBody.setVelocityX(300);
    }
    if (this.cursors.up?.isDown) {
      moveY = -1;
      playerBody.setVelocityY(-300);
    }
    if (this.cursors.down?.isDown) {
      moveY = 1;
      playerBody.setVelocityY(300);
    }

    // Handle diagonal movement - reduce speed so diagonal isn't faster
    if (moveX !== 0 && moveY !== 0) {
      const diagonalSpeed = 300 * 0.707; // sqrt(2)/2 to normalize diagonal speed
      playerBody.setVelocity(moveX * diagonalSpeed, moveY * diagonalSpeed);
    }

    // Update facing angle based on movement direction
    if (moveX !== 0 || moveY !== 0) {
      this.facingAngle = Math.atan2(moveY, moveX);
    }

    // Rotate player sprite to face movement direction
    this.player.setRotation(this.facingAngle);

    // Weapon switching with number keys
    if (Phaser.Input.Keyboard.JustDown(this.numberKeys[1])) {
      this.currentWeapon = WeaponType.NORMAL;
      this.weaponText.setText('Weapon: Normal (1)');
    }
    if (Phaser.Input.Keyboard.JustDown(this.numberKeys[2])) {
      this.currentWeapon = WeaponType.SPREAD;
      this.weaponText.setText('Weapon: Spread (2)');
    }
    if (Phaser.Input.Keyboard.JustDown(this.numberKeys[3])) {
      this.currentWeapon = WeaponType.THICK;
      this.weaponText.setText('Weapon: Thick (3)');
    }
    if (Phaser.Input.Keyboard.JustDown(this.numberKeys[4])) {
      this.currentWeapon = WeaponType.RING;
      this.weaponText.setText('Weapon: Ring (4)');
    }
    if (Phaser.Input.Keyboard.JustDown(this.numberKeys[5])) {
      this.currentWeapon = WeaponType.SOLID_RING;
      this.weaponText.setText('Weapon: Solid Ring (5)');
    }

    if (Phaser.Input.Keyboard.JustDown(this.numberKeys[6])) {
      if (this.bouncyUnlocked) {
        this.currentWeapon = WeaponType.BOUNCY;
        this.weaponText.setText('Weapon: Bouncy (6)');
      }
    }

    // Shooting with spacebar
    const currentCooldown = this.getWeaponCooldown();
    if (this.spaceKey.isDown && this.time.now - this.lastShotTime > currentCooldown) {
      this.shoot();
      this.lastShotTime = this.time.now;
    }

    // Move zombies toward player (gunners stay stationary)
    this.zombies.children.entries.forEach((zombie) => {
      const zombieGO = zombie as Phaser.GameObjects.Sprite;
      const zombieBody = zombie.body as Phaser.Physics.Arcade.Body;

      if (zombieGO.getData('isGunner') && !zombieGO.getData('isBoss')) {
        // Ensure gunners remain stationary
        zombieBody.setVelocity(0, 0);
        return;
      }

      // Calculate direction from zombie to player
      const dx = this.player.x - zombieGO.x;
      const dy = this.player.y - zombieGO.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 0) {
        const speed = 100;
        zombieBody.setVelocity(
          (dx / distance) * speed,
          (dy / distance) * speed
        );
      }
    });

    // Clean up player bullets that go off screen
    this.bullets.children.entries.forEach((bullet) => {
      const bulletGO = bullet as Phaser.GameObjects.Arc;
      const screenWidth = this.cameras.main.width;
      const screenHeight = this.cameras.main.height;
      
      if (bulletGO.x < -50 || bulletGO.x > screenWidth + 50 || bulletGO.y < -50 || bulletGO.y > screenHeight + 50) {
        bullet.destroy();
      }
    });

    // Clean up enemy bullets that go off screen
    this.enemyBullets.children.entries.forEach((bullet) => {
      const bulletGO = bullet as Phaser.GameObjects.Arc;
      const screenWidth = this.cameras.main.width;
      const screenHeight = this.cameras.main.height;

      if (
        bulletGO.x < -50 ||
        bulletGO.x > screenWidth + 50 ||
        bulletGO.y < -50 ||
        bulletGO.y > screenHeight + 50
      ) {
        bullet.destroy();
      }
    });

    // --- Boss orbit update ---
    this.zombies.children.entries.forEach((zombie) => {
      const boss = zombie as Phaser.GameObjects.Sprite;
      if (!boss.getData('isBoss')) return;

      const dt = this.game.loop.delta / 1000; // seconds
      let angle: number = boss.getData('orbitAngle');
      const speed: number = boss.getData('orbitSpeed');
      const radius: number = boss.getData('orbitRadius');

      angle += speed * dt;
      boss.setData('orbitAngle', angle);

      const centerX = this.cameras.main.width / 2;
      const centerY = this.cameras.main.height / 2;

      boss.x = centerX + Math.cos(angle) * radius;
      boss.y = centerY + Math.sin(angle) * radius;

      // Ensure physics body follows sprite
      const bbody = boss.body as Phaser.Physics.Arcade.Body;
      bbody.x = boss.x - bbody.width / 2;
      bbody.y = boss.y - bbody.height / 2;
    });

    // Refresh boss health bar display each frame
    if (this.bossSpawned) {
      this.updateBossHealthBar();
    }
  }

  private spawnZombie() {
    // Spawn zombies at random positions at the edge of the screen
    const screenWidth = this.cameras.main.width;
    const screenHeight = this.cameras.main.height;
    const side = Phaser.Math.Between(0, 3);
    let x, y;

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

    // Determine whether to spawn a gunner or normal zombie
    this.gunnerSpawnCounter++;

    if (this.gunnerSpawnCounter >= this.gunnerSpawnThreshold) {
      // Choose a visible on-screen position for gunners
      const gunnerX = Phaser.Math.Between(50, screenWidth - 50);
      const gunnerY = Phaser.Math.Between(50, screenHeight - 50);

      // Spawn gunner zombie with its dedicated sprite
      const gunner = this.physics.add.sprite(gunnerX, gunnerY, 'gunner');
      gunner.setScale(0.5);
      (gunner.body as Phaser.Physics.Arcade.Body).setCircle(gunner.width * 0.25);
      gunner.setData('isGunner', true);
      this.zombies.add(gunner);

      // Start shooting behavior
      this.startGunnerShooting(gunner);

      // Reset counter and choose next threshold
      this.gunnerSpawnCounter = 0;
      this.gunnerSpawnThreshold = Phaser.Math.Between(15, 20);
    } else {
      // Spawn normal moving zombie
      const zombie = this.physics.add.sprite(x!, y!, 'zombie');
      zombie.setScale(0.5);
      (zombie.body as Phaser.Physics.Arcade.Body).setCircle(zombie.width * 0.25);
      this.zombies.add(zombie);
    }
  }

  private shoot() {
    switch (this.currentWeapon) {
      case WeaponType.NORMAL:
        this.shootNormal();
        break;
      case WeaponType.SPREAD:
        this.shootSpread();
        break;
      case WeaponType.THICK:
        this.shootThick();
        break;
      case WeaponType.RING:
        this.shootRing();
        break;
      case WeaponType.SOLID_RING:
        this.shootSolidRing();
        break;
      case WeaponType.BOUNCY:
        this.shootBouncy();
        break;
    }
  }

  private shootNormal() {
    // Create normal bullet (yellow circle)
    const bullet = this.add.circle(this.player.x, this.player.y, 5, 0xffff00);
    this.physics.add.existing(bullet);
    this.bullets.add(bullet);

    // Set bullet velocity in the facing direction
    const bulletSpeed = 600;
    const bulletBody = bullet.body as Phaser.Physics.Arcade.Body;
    bulletBody.setVelocity(
      Math.cos(this.facingAngle) * bulletSpeed,
      Math.sin(this.facingAngle) * bulletSpeed
    );
  }

  private shootSpread() {
    // Create 5 bullets in a spread pattern
    const bulletSpeed = 600;
    const spreadAngles = [-0.4, -0.2, 0, 0.2, 0.4]; // spread of about 45 degrees total
    
    spreadAngles.forEach((angleOffset) => {
      const bullet = this.add.circle(this.player.x, this.player.y, 4, 0xffa500); // orange bullets
      this.physics.add.existing(bullet);
      this.bullets.add(bullet);
      
      const shootAngle = this.facingAngle + angleOffset;
      const bulletBody = bullet.body as Phaser.Physics.Arcade.Body;
      bulletBody.setVelocity(
        Math.cos(shootAngle) * bulletSpeed,
        Math.sin(shootAngle) * bulletSpeed
      );
    });
  }

  private shootThick() {
    // Create thick bullet (larger, slower, cyan)
    const bullet = this.add.circle(this.player.x, this.player.y, 10, 0x00ffff);
    this.physics.add.existing(bullet);
    this.bullets.add(bullet);

    // Set bullet velocity in the facing direction (slower than normal)
    const bulletSpeed = 400;
    const bulletBody = bullet.body as Phaser.Physics.Arcade.Body;
    bulletBody.setVelocity(
      Math.cos(this.facingAngle) * bulletSpeed,
      Math.sin(this.facingAngle) * bulletSpeed
    );
  }

  private shootRing() {
    // Create ring of bullets shooting in all directions
    const bulletSpeed = 500;
    const numBullets = 12; // 12 bullets in a circle
    
    for (let i = 0; i < numBullets; i++) {
      const angle = (i / numBullets) * Math.PI * 2;
      const bullet = this.add.circle(this.player.x, this.player.y, 3, 0xff00ff); // magenta bullets
      this.physics.add.existing(bullet);
      this.bullets.add(bullet);
      
      const bulletBody = bullet.body as Phaser.Physics.Arcade.Body;
      bulletBody.setVelocity(
        Math.cos(angle) * bulletSpeed,
        Math.sin(angle) * bulletSpeed
      );
    }
  }

  private shootSolidRing() {
    // Create expanding ring that damages zombies
    const ring = this.add.circle(this.player.x, this.player.y, 10, 0x00ff00, 0);
    ring.setStrokeStyle(8, 0x00ff00); // Green ring with thick stroke
    
    const ringCenterX = this.player.x;
    const ringCenterY = this.player.y;
    let previousRadius = 10;
    const hitZombies = new Set(); // Track which zombies have been hit
    
    // Make ring expand over time
    this.tweens.add({
      targets: ring,
      radius: 120, // Expand to 120 pixels radius
      duration: 300, // Over 300ms
      ease: 'Power2',
      onUpdate: () => {
        const currentRadius = ring.radius;
        
        // Check all zombies for collision with the expanding ring
        this.zombies.children.entries.forEach((zombie) => {
          const zombieGO = zombie as Phaser.GameObjects.Sprite;
          
          // Skip if already hit
          if (hitZombies.has(zombie)) return;
          
          // Calculate distance from ring center to zombie
          const dx = zombieGO.x - ringCenterX;
          const dy = zombieGO.y - ringCenterY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // Check if zombie is within the ring's expanding area
          // We check if zombie is between previous radius and current radius
          if (distance <= currentRadius && distance >= previousRadius - 10) {
            hitZombies.add(zombie);
            this.damageZombie(zombieGO, 20);
            if (!zombieGO.active) {
              // zombie was destroyed
              this.score += 10;
              this.scoreText.setText('Score: ' + this.score);
            }
          }
        });
        
        previousRadius = currentRadius;
      },
      onComplete: () => {
        ring.destroy(); // Remove ring after expansion
      }
    });
  }

  private getWeaponCooldown(): number {
    switch (this.currentWeapon) {
      case WeaponType.NORMAL:
        return 200; // Normal fire rate
      case WeaponType.SPREAD:
        return 400; // Slower for spread shots
      case WeaponType.THICK:
        return 600; // Slower for thick bullets
      case WeaponType.RING:
        return 1000; // Much slower for ring burst
      case WeaponType.SOLID_RING:
        return 800; // Slower for solid ring
      case WeaponType.BOUNCY:
        return 300; // Moderate fire rate
      default:
        return 200;
    }
  }

  private bulletHitZombie(bullet: any, zombie: any) {
    // Remove only the zombie, let bullet continue through
    const destroyed = this.damageZombie(zombie as Phaser.GameObjects.Sprite, 20);
    if (destroyed) {
      // Increase score
      this.score += 10;
      this.scoreText.setText('Score: ' + this.score);
    }

    // Handle bouncy bullet hit counts
    if (bullet.getData && bullet.getData('isBouncy')) {
      let hits = bullet.getData('hits') || 0;
      hits += 1;
      if (hits >= 5) {
        bullet.destroy();
      } else {
        bullet.setData('hits', hits);
      }
    }
  }

  private playerHitZombie(player: any, zombie: any) {
    const isBoss = (zombie as Phaser.GameObjects.Sprite).getData('isBoss');
    const damageToPlayer = isBoss ? 15 : 20;

    // Apply damage to zombie (may or may not be destroyed)
    const destroyed = this.damageZombie(zombie as Phaser.GameObjects.Sprite, damageToPlayer);
    // Damage player regardless
    this.applyDamage(damageToPlayer);
  }

  private updateHealthBar() {
    const x = 16;
    const y = 100;
    const width = 200;
    const height = 20;

    this.healthBar.clear();
    this.shieldBar.clear();

    // Draw background for both bars
    this.healthBar.fillStyle(0x444444, 1);
    this.healthBar.fillRect(x, y, width, height);
    this.shieldBar.fillStyle(0x444444, 1);
    const shieldX = x + width + 10; // 10px gap between bars
    this.shieldBar.fillRect(shieldX, y, width, height);

    // Draw health fill (red)
    const healthPercent = Phaser.Math.Clamp(this.playerHealth / this.playerMaxHealth, 0, 1);
    this.healthBar.fillStyle(0xff0000, 1);
    this.healthBar.fillRect(x, y, width * healthPercent, height);

    // Draw shield fill (blue)
    const shieldPercent = Phaser.Math.Clamp(this.playerShield / this.playerMaxShield, 0, 1);
    this.shieldBar.fillStyle(0x0000ff, 1);
    this.shieldBar.fillRect(shieldX, y, width * shieldPercent, height);
  }

  // --- Gunner zombie helpers ---

  private startGunnerShooting(gunner: Phaser.GameObjects.Sprite) {
    const shootTimer = this.time.addEvent({
      delay: 1000, // fire every second
      callback: () => this.gunnerShoot(gunner),
      loop: true
    });

    gunner.setData('shootTimer', shootTimer);

    // Clean up timer when gunner is destroyed
    gunner.on('destroy', () => {
      const timer: Phaser.Time.TimerEvent | undefined = gunner.getData('shootTimer');
      if (timer) {
        timer.remove(false);
      }
      // Drop medkit on death
      this.spawnMedkit(gunner.x, gunner.y);
    });
  }

  private gunnerShoot(gunner: Phaser.GameObjects.Sprite) {
    if (!gunner.active) return;

    const bullet = this.add.circle(gunner.x, gunner.y, 4, 0xff0000); // red bullet
    this.physics.add.existing(bullet);
    this.enemyBullets.add(bullet);

    const bulletSpeed = 400;
    const dx = this.player.x - gunner.x;
    const dy = this.player.y - gunner.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance === 0) return; // avoid divide by zero

    const body = bullet.body as Phaser.Physics.Arcade.Body;
    body.setVelocity((dx / distance) * bulletSpeed, (dy / distance) * bulletSpeed);

    // Mark bullet if fired by boss for extra damage
    if (gunner.getData('isBoss')) {
      bullet.setData('isBossBullet', true);
    }
  }

  private playerHitEnemyBullet(player: any, bullet: any) {
    bullet.destroy();
    const damage = bullet.getData && bullet.getData('isBossBullet') ? 15 : 10;
    this.applyDamage(damage);
  }

  // --- Medkit helpers ---

  private spawnMedkit(x: number, y: number) {
    const medkit = this.add.rectangle(x, y, 16, 16, 0x00ff00);
    this.physics.add.existing(medkit);
    this.medkits.add(medkit);
  }

  private playerTouchMedkit(player: any, medkit: any) {
    medkit.destroy();

    this.playerHealth = Math.min(this.playerHealth + 20, this.playerMaxHealth);
    this.updateHealthBar();
  }

  // --- Helper methods ---

  /**
   * Apply damage to the player, depleting shield first and then health.
   */
  private applyDamage(amount: number) {
    if (this.playerShield > 0) {
      const shieldDamage = Math.min(amount, this.playerShield);
      this.playerShield -= shieldDamage;
      amount -= shieldDamage;
    }
    if (amount > 0) {
      this.playerHealth -= amount;
    }

    this.updateHealthBar();

    if (this.playerHealth <= 0) {
      this.scene.restart();
    }
  }

  /**
   * Increment kill count and grant shield every 20 kills.
   */
  private incrementKillCount() {
    this.zombieKillCount += 1;

    if (this.zombieKillCount % 20 === 0) {
      this.playerShield = Math.min(this.playerShield + 20, this.playerMaxShield);
      this.updateHealthBar();
    }

    // Spawn boss after first 100 kills
    if (!this.bossSpawned && this.zombieKillCount >= 100) {
      this.spawnBoss();
    }
  }

  /**
   * Damage a zombie, supporting bosses with health. Returns true if zombie was destroyed.
   */
  private damageZombie(zombie: Phaser.GameObjects.Sprite, amount: number): boolean {
    if (zombie.getData('isBoss')) {
      let health: number = zombie.getData('health');
      health -= amount;
      if (health <= 0) {
        this.killBoss(zombie);
        return true;
      } else {
        zombie.setData('health', health);
        return false;
      }
    }

    // Regular zombie
    zombie.destroy();
    this.incrementKillCount();
    return true;
  }

  /** Spawn the boss zombie */
  private spawnBoss() {
    this.bossSpawned = true;

    // Spawn at screen edge similar to regular spawn
    const screenWidth = this.cameras.main.width;
    const screenHeight = this.cameras.main.height;
    const side = Phaser.Math.Between(0, 3);
    let x: number, y: number;
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
      default:
        x = -30;
        y = Phaser.Math.Between(0, screenHeight);
        break;
    }

    const boss = this.physics.add.sprite(x, y, 'gunner');
    boss.setScale(1.2); // bigger for emphasis
    boss.setVisible(true);
    boss.setAlpha(1);
    boss.setDepth(5); // render above other zombies

    this.zombies.add(boss);

    boss.setData('isGunner', true);
    boss.setData('isBoss', true);
    boss.setData('health', 150);

    // Orbit params
    const orbitRadius = Math.min(screenWidth, screenHeight) / 2 - 60;
    boss.setData('orbitRadius', orbitRadius);
    boss.setData('orbitAngle', Phaser.Math.FloatBetween(0, Math.PI * 2));
    boss.setData('orbitSpeed', 0.6); // radians per second

    // Start faster shooting (1.5x faster => 667ms)
    const shootTimer = this.time.addEvent({
      delay: 667,
      callback: () => this.gunnerShoot(boss),
      loop: true
    });
    boss.setData('shootTimer', shootTimer);

    // Clean up timer on destroy
    boss.on('destroy', () => {
      const timer: Phaser.Time.TimerEvent | undefined = boss.getData('shootTimer');
      if (timer) timer.remove(false);
    });
  }

  /** Handle killing the boss and reward player */
  private killBoss(boss: Phaser.GameObjects.Sprite) {
    boss.destroy();

    // Remove boss health bar
    if (this.bossHealthBar) {
      this.bossHealthBar.destroy();
    }

    // Increase shield capacity
    this.playerMaxShield = 150;
    // Keep current shield amount, just ensure not exceeding new max
    this.playerShield = Math.min(this.playerShield, this.playerMaxShield);
    this.updateHealthBar();

    // Unlock bouncy weapon
    this.bouncyUnlocked = true;

    // Notify player
    this.weaponText.setText('Weapon unlocked! Press 6 for Bouncy Gun');

    // Reward score
    this.score += 100;
    this.scoreText.setText('Score: ' + this.score);

    // Increment kill counter for shield cycle logic
    this.incrementKillCount();
  }

  private updateBossHealthBar() {
    if (!this.bossHealthBar) {
      this.bossHealthBar = this.add.graphics();
    }

    // Find boss sprite
    const boss = this.zombies.getChildren().find(z => (z as Phaser.GameObjects.Sprite).getData('isBoss')) as Phaser.GameObjects.Sprite | undefined;

    if (!boss || !boss.active) {
      // Boss not present; hide bar
      this.bossHealthBar.clear();
      return;
    }

    const health: number = boss.getData('health');
    const maxHealth = 150;

    const barWidth = 300;
    const barHeight = 20;
    const x = (this.cameras.main.width - barWidth) / 2;
    const y = 20;

    const healthPercent = Phaser.Math.Clamp(health / maxHealth, 0, 1);

    this.bossHealthBar.clear();
    this.bossHealthBar.fillStyle(0x444444, 1);
    this.bossHealthBar.fillRect(x, y, barWidth, barHeight);
    this.bossHealthBar.fillStyle(0xffaa00, 1);
    this.bossHealthBar.fillRect(x, y, barWidth * healthPercent, barHeight);
  }

  private shootBouncy() {
    const bulletSpeed = 500;
    const bullet = this.add.circle(this.player.x, this.player.y, 5, 0x00ffff); // cyan ball
    this.physics.add.existing(bullet);
    this.bullets.add(bullet);

    const body = bullet.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(
      Math.cos(this.facingAngle) * bulletSpeed,
      Math.sin(this.facingAngle) * bulletSpeed
    );
    body.setBounce(1, 1);
    body.setCollideWorldBounds(true);
    body.onWorldBounds = true;

    bullet.setData('isBouncy', true);
    bullet.setData('hits', 0);
  }

  // --- Pause helpers ---
  private pauseGame() {
    this.physics.world.pause();
    // Pause all timers
    this.time.paused = true;
    this.pauseText.setVisible(true);
    this.saveGame();
  }

  private resumeGame() {
    this.physics.world.resume();
    this.time.paused = false;
    this.pauseText.setVisible(false);
  }

  private saveGame() {
    const boss = this.zombies.getChildren().find(z => (z as Phaser.GameObjects.Sprite).getData('isBoss')) as Phaser.GameObjects.Sprite | undefined;

    const data = {
      score: this.score,
      playerHealth: this.playerHealth,
      playerShield: this.playerShield,
      playerMaxShield: this.playerMaxShield,
      zombieKillCount: this.zombieKillCount,
      bouncyUnlocked: this.bouncyUnlocked,
      bossSpawned: this.bossSpawned,
      bossHealth: boss ? boss.getData('health') : null
    };

    try {
      localStorage.setItem('save1', JSON.stringify(data));
    } catch (e) {
      console.warn('Save failed', e);
    }
  }
}
