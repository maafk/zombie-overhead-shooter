import { Scene } from "phaser";

const WeaponType = {
  NORMAL: 0,
  SPREAD: 1,
  THICK: 2,
  RING: 3,
  SOLID_RING: 4,
  BOUNCY: 5,
  SWORD: 6,
  SAW: 7,
  TESLA: 8
} as const;

export class PlayScene extends Scene {
  private player!: Phaser.GameObjects.Sprite;
  private zombies!: Phaser.Physics.Arcade.Group;
  private bullets!: Phaser.Physics.Arcade.Group;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private numberKeys!: { [key: number]: Phaser.Input.Keyboard.Key };
  private pauseKey!: Phaser.Input.Keyboard.Key;
  private isPaused = false;
  private pauseText!: Phaser.GameObjects.Text;
  private lastShotTime = 0;
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
  private boss1Defeated = false;
  private boss2Defeated = false;
  private boss3Defeated = false;
  private boss4Defeated = false;

  // Second boss
  private secondBossSpawned = false;
  private thirdBossSpawned = false;
  private fourthBossSpawned = false;

  // Unlockable weapons
  private bouncyUnlocked = false;
  private swordUnlocked = false;
  private sawUnlocked = false;
  private teslaUnlocked = false;
  private teslaPlaced = false;
  private enemyBullets!: Phaser.Physics.Arcade.Group;
  private gunnerSpawnCounter = 0;
  private gunnerSpawnThreshold = Phaser.Math.Between(15, 20);
  private medkits!: Phaser.Physics.Arcade.Group;
  private shields!: Phaser.Physics.Arcade.Group;
  private blockCharges = 0; // shield charges from pickup
  private blockShieldIndicator!: Phaser.GameObjects.Sprite;
  private pauseSaveButton?: Phaser.GameObjects.Text;
  private slotButtons?: Phaser.GameObjects.Text[];
  private pendingLoadSlot?: number;

  constructor() {
    super("play");
  }

  /** Receive data when scene starts */
  init(data: { loadSlot?: number }) {
    if (data && typeof data.loadSlot === 'number') {
      this.pendingLoadSlot = data.loadSlot;
    } else {
      this.pendingLoadSlot = undefined;
    }
  }

  preload() {
    // Load zombie sprite (public domain asset from Kenney Top-down Shooter pack)
    // Place PNG at `public/zombie.png` (e.g. PNG 64×64 px) or update the path below
    this.load.image('zombie', 'zombie.png');
    // Load hero sprite
    this.load.image('hero', 'hero.png');
    // Load gunner zombie sprite
    this.load.image('gunner', 'gunner.png');
    // Load second boss sprite (provide your own asset at public/boss2.png)
    this.load.image('boss2', 'boss2.png');
    // Load third boss sprite (place at public/boss3.png)
    this.load.image('boss3', 'boss3.png');
    // Load saw projectile sprite (place at public/saw.png)
    this.load.image('saw', 'saw.png');
    // Load sword sprite for melee weapon
    this.load.image('sword', 'sword.png');
    // Load shield pickup sprite
    this.load.image('shield', 'shield.png');
    this.load.image('boss4','boss4.png');
    this.load.image('rock','rock.png');
    this.load.image('tesla','tesla.png');
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

    // Create groups for zombies and bullets
    this.zombies = this.physics.add.group();
    this.bullets = this.physics.add.group();
    // Group for bullets fired by gunner zombies
    this.enemyBullets = this.physics.add.group();
    // Group for medkits dropped by gunners
    this.medkits = this.physics.add.group();
    // Group for temporary shield pickups
    this.shields = this.physics.add.group();

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
      6: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SIX),
      7: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SEVEN),
      8: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.EIGHT),
      9: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.NINE)
    };

    // Reset score on (re)start
    this.score = 0;

    // Reset kill counters and boss flags for a fresh session
    this.zombieKillCount = 0;
    this.bossSpawned = false;
    this.secondBossSpawned = false;
    this.boss1Defeated = false;
    this.boss2Defeated = false;
    this.boss3Defeated = false;

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

    // Shield block indicator
    this.blockShieldIndicator = this.textures.exists('shield') ?
      this.add.sprite(this.player.x, this.player.y, 'shield') :
      this.add.circle(this.player.x, this.player.y, 8, 0x0000ff, 0.3) as unknown as Phaser.GameObjects.Sprite;
    this.blockShieldIndicator.setScale(0.4);
    this.blockShieldIndicator.setAlpha(0.6);
    this.blockShieldIndicator.setVisible(false);

    // Note: Boss will spawn dynamically after 100 kills; no immediate spawn at create.

    // Set up collision detection
    this.physics.add.overlap(this.bullets, this.zombies, this.bulletHitZombie, undefined, this);
    this.physics.add.overlap(this.player, this.zombies, this.playerHitZombie, undefined, this);
    // Damage player when hit by enemy bullets (from gunners)
    this.physics.add.overlap(this.player, this.enemyBullets, this.playerHitEnemyBullet, undefined, this);
    // Heal player when touching medkit
    this.physics.add.overlap(this.player, this.medkits, this.playerTouchMedkit, undefined, this);
    // Shield pickup
    this.physics.add.overlap(this.player, this.shields, this.playerTouchShield, undefined, this);

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

    // If coming from a saved game, load it
    if (this.pendingLoadSlot != null) {
      this.loadGame(this.pendingLoadSlot);
      this.pendingLoadSlot = undefined; // clear after loading
    }
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

    // Check score-based Boss4 spawn
    if(!this.fourthBossSpawned && !this.boss4Defeated && this.score >= 4000){
      this.spawnFourthBoss();
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

    // Update shield indicator position/visibility
    if(this.blockShieldIndicator){
      this.blockShieldIndicator.setPosition(this.player.x, this.player.y);
      this.blockShieldIndicator.setVisible(this.blockCharges>0);
    }

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

    if (Phaser.Input.Keyboard.JustDown(this.numberKeys[7])) {
      if (this.swordUnlocked) {
        this.currentWeapon = WeaponType.SWORD;
        this.weaponText.setText('Weapon: Sword (7)');
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.numberKeys[8])) {
      if (this.sawUnlocked) {
        this.currentWeapon = WeaponType.SAW;
        this.weaponText.setText('Weapon: Saw (8)');
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.numberKeys[9])) {
      if (this.teslaUnlocked) {
        this.currentWeapon = WeaponType.TESLA;
        this.weaponText.setText('Weapon: Tesla Coil (9)');
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

      // If boss doesn't have orbit data, skip orbit update (new roaming boss)
      if (boss.getData('orbitRadius') == null) return;

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

    // Refresh boss health bar display each frame if any boss exists
    this.updateBossHealthBar();
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
    const bossAlive = this.zombies.getChildren().some(z => (z as Phaser.GameObjects.Sprite).getData('isBoss'));
    this.gunnerSpawnCounter++;

    if (!bossAlive && this.gunnerSpawnCounter >= this.gunnerSpawnThreshold) {
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
      case WeaponType.SWORD:
        this.shootSword();
        break;
      case WeaponType.SAW:
        this.shootSaw();
        break;
      case WeaponType.TESLA:
        this.placeTesla();
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
            // Scoring now handled inside damageZombie
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
        return 450; // 1.5x longer reload for bouncy gun
      case WeaponType.SWORD:
        return 700;
      case WeaponType.SAW:
        return 900;
      case WeaponType.TESLA:
        return 1000;
      default:
        return 200;
    }
  }

  private bulletHitZombie(bullet: any, zombie: any) {
    // Remove only the zombie, let bullet continue through
    const destroyed = this.damageZombie(zombie as Phaser.GameObjects.Sprite, 20);
    // Scoring now handled inside damageZombie

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

  private playerHitZombie(_player: any, zombie: any) {
    const isBoss = (zombie as Phaser.GameObjects.Sprite).getData('isBoss');
    const damageToPlayer = isBoss ? 15 : 20;

    // Apply damage to zombie (may or may not be destroyed)
    this.damageZombie(zombie as Phaser.GameObjects.Sprite, damageToPlayer);
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
      // 70% medkit, 30% shield
      if(Math.random() < 0.6){
        this.spawnMedkit(gunner.x, gunner.y);
      } else {
        this.spawnShield(gunner.x, gunner.y);
      }
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

  private playerHitEnemyBullet(_player: any, bullet: any) {
    bullet.destroy();
    let damage=10;
    if(bullet.getData()){
      if(bullet.getData('isBossRock')) damage=30;
      else if(bullet.getData('isBossBullet')) damage=15;
    }
    this.applyDamage(damage);
  }

  // --- Medkit helpers ---

  private spawnMedkit(x: number, y: number) {
    const medkit = this.add.rectangle(x, y, 16, 16, 0x00ff00);
    this.physics.add.existing(medkit);
    this.medkits.add(medkit);
  }

  private spawnShield(x:number, y:number){
    let sh: Phaser.GameObjects.Sprite|Phaser.GameObjects.Rectangle;
    if(this.textures.exists('shield')){
      sh = this.add.sprite(x,y,'shield');
      sh.setScale(0.4);
    } else {
      sh = this.add.rectangle(x,y,8,8,0x0000ff) as any; // fallback
    }
    this.physics.add.existing(sh);
    this.shields.add(sh as any);
  }

  private playerTouchMedkit(_player: any, medkit: any) {
    medkit.destroy();

    this.playerHealth = Math.min(this.playerHealth + 20, this.playerMaxHealth);
    this.updateHealthBar();
  }

  private playerTouchShield(_player:any, shield:any){
    shield.destroy();
    this.blockCharges = 3;
    this.blockShieldIndicator.setVisible(true);
  }

  // --- Helper methods ---

  /**
   * Apply damage to the player, depleting shield first and then health.
   */
  private applyDamage(amount: number) {
    if(this.blockCharges>0){
      this.blockCharges--;
      if(this.blockCharges<=0){
        this.blockShieldIndicator.setVisible(false);
      }
      return;
    }

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
      // Record score to leaderboard then return to menu
      this.recordScore();
      this.scene.start('menu');
    }
  }

  /** Add the current score to persistent leaderboard (top 5) */
  private recordScore() {
    try {
      const raw = localStorage.getItem('leaderboard');
      const list: number[] = raw ? JSON.parse(raw) : [];
      list.push(this.score);
      list.sort((a, b) => b - a);
      const top5 = list.slice(0, 5);
      localStorage.setItem('leaderboard', JSON.stringify(top5));
    } catch (e) {
      console.warn('Unable to update leaderboard', e);
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
    if (!this.boss1Defeated && !this.bossSpawned && this.zombieKillCount >= 100) {
      this.spawnBoss();
    }

    // Spawn second boss after 200 kills
    if (!this.boss2Defeated && !this.secondBossSpawned && this.zombieKillCount >= 200) {
      this.spawnSecondBoss();
    }

    // Spawn third boss after 300 kills
    if (!this.boss3Defeated && !this.thirdBossSpawned && this.zombieKillCount >= 300) {
      this.spawnThirdBoss();
    }

    // Spawn fourth boss when score reaches 4000
    if (!this.boss4Defeated && !this.fourthBossSpawned && this.score >= 4000) {
      this.spawnFourthBoss();
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

    // Regular or gunner zombie
    const isGunner = zombie.getData('isGunner') === true;
    zombie.destroy();
    this.incrementKillCount();

    const points = isGunner ? 20 : 10;
    this.score += points;
    this.scoreText.setText('Score: ' + this.score);
    return true;
  }

  /** Spawn the boss zombie */
  private spawnBoss() {
    this.bossSpawned = true;

    // Spawn somewhere visible on screen (like gunner does)
    const screenWidth = this.cameras.main.width;
    const screenHeight = this.cameras.main.height;
    const x = Phaser.Math.Between(50, screenWidth - 50);
    const y = Phaser.Math.Between(50, screenHeight - 50);

    const boss = this.physics.add.sprite(x, y, 'gunner');
    boss.setScale(1.2); // bigger for emphasis
    boss.setVisible(true);
    boss.setAlpha(1);
    boss.setDepth(5); // render above other zombies

    this.zombies.add(boss);

    boss.setData('isGunner', true);
    boss.setData('isBoss', true);
    boss.setData('health', 150);
    boss.setData('bossLevel', 1);
    boss.setData('maxHealth', 150);

    // No orbiting — boss will chase the player like a regular zombie

    // Start faster shooting (1.5x faster => 667ms)
    const shootTimer = this.time.addEvent({
      delay: 667,
      callback: () => this.gunnerShoot(boss),
      loop: true
    });
    boss.setData('shootTimer', shootTimer);

    // Eliminate any existing non-boss gunners so only the real boss remains visible
    this.zombies.getChildren().forEach(child => {
      if (child === boss) return;
      const sprite = child as Phaser.GameObjects.Sprite;
      if (sprite.texture.key === 'gunner' && !sprite.getData('isBoss')) {
        sprite.destroy();
      }
    });

    // Clean up timer on destroy
    boss.on('destroy', () => {
      const timer: Phaser.Time.TimerEvent | undefined = boss.getData('shootTimer');
      if (timer) timer.remove(false);
    });
  }

  /** Handle killing the boss and reward player */
  private killBoss(boss: Phaser.GameObjects.Sprite) {
    const level = boss.getData('bossLevel') || 1;

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

    if (level === 1) {
      // Unlock bouncy weapon
      this.bouncyUnlocked = true;
      this.weaponText.setText('Weapon unlocked! Press 6 for Bouncy Gun');
      this.score += 50;
      this.bossSpawned = false; // boss1 defeated
      this.boss1Defeated = true;
    } else if(level===2){
      this.swordUnlocked = true;
      this.weaponText.setText('Weapon unlocked! Press 7 for Sword');
      this.score += 70;
      this.secondBossSpawned = false; // boss2 defeated
      this.boss2Defeated = true;
    } else if(level===3){
      this.sawUnlocked = true;
      this.weaponText.setText('Weapon unlocked! Press 8 for Saw');
      this.score += 100;
      this.thirdBossSpawned = false;
      this.boss3Defeated = true;
    } else if(level===4){
      this.teslaUnlocked = true;
      this.weaponText.setText('Weapon unlocked! Press 9 for Tesla Coil');
      this.score += 100;
      this.fourthBossSpawned = false;
      this.boss4Defeated = true;
    }

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
    const maxHealth = boss.getData('maxHealth') ?? 150;

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

  /** Spawn the second boss (spread-gun wielder) */
  private spawnSecondBoss() {
    this.secondBossSpawned = true;

    const screenWidth = this.cameras.main.width;
    const screenHeight = this.cameras.main.height;
    const x = Phaser.Math.Between(50, screenWidth - 50);
    const y = Phaser.Math.Between(50, screenHeight - 50);

    const boss = this.physics.add.sprite(x, y, 'boss2');
    boss.setScale(1.4);
    boss.setDepth(5);
    this.zombies.add(boss);

    boss.setData('isBoss', true);
    boss.setData('bossLevel', 2);
    boss.setData('health', 200);
    boss.setData('maxHealth', 200);

    // Spread-gun shooting every 600 ms
    const shootTimer = this.time.addEvent({
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

  /** Second boss spread-shot helper */
  private bossSpreadShoot(boss: Phaser.GameObjects.Sprite) {
    if (!boss.active) return;

    const bulletSpeed = 450;
    const angleToPlayer = Math.atan2(this.player.y - boss.y, this.player.x - boss.x);
    const offsets = [-0.3, -0.15, 0, 0.15, 0.3];

    offsets.forEach(off => {
      const bullet = this.add.circle(boss.x, boss.y, 4, 0xffa500);
      this.physics.add.existing(bullet);
      this.enemyBullets.add(bullet);
      const angle = angleToPlayer + off;
      const body = bullet.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(Math.cos(angle) * bulletSpeed, Math.sin(angle) * bulletSpeed);
      bullet.setData('isBossBullet', true);
    });
  }

  /** Spawn third boss that uses solid ring */
  private spawnThirdBoss() {
    this.thirdBossSpawned = true;

    const screenWidth = this.cameras.main.width;
    const screenHeight = this.cameras.main.height;
    const x = Phaser.Math.Between(50, screenWidth - 50);
    const y = Phaser.Math.Between(50, screenHeight - 50);

    const boss = this.physics.add.sprite(x, y, 'boss3');
    boss.setScale(1.6);
    boss.setDepth(5);
    this.zombies.add(boss);

    boss.setData('isBoss', true);
    boss.setData('bossLevel', 3);
    boss.setData('health', 250);
    boss.setData('maxHealth', 250);

    // Attack timer
    const timer = this.time.addEvent({
      delay: 800,
      callback: () => this.bossSolidRingAttack(boss),
      loop: true
    });
    boss.setData('shootTimer', timer);

    boss.on('destroy',()=>{
      timer.remove(false);
    });
  }

  /** Solid ring attack damaging player */
  private bossSolidRingAttack(boss: Phaser.GameObjects.Sprite){
    if(!boss.active) return;
    const ring = this.add.circle(boss.x, boss.y, 10, 0xffaaaa,0);
    ring.setStrokeStyle(8,0xffaaaa);
    const cx=boss.x, cy=boss.y;
    let prev=10;
    this.tweens.add({
      targets:ring,
      radius:120,
      duration:400,
      ease:'Power2',
      onUpdate: ()=>{
        const cur = ring.radius;
        const dx=this.player.x-cx;
        const dy=this.player.y-cy;
        const dist=Math.sqrt(dx*dx+dy*dy);
        if(dist<=cur && dist>=prev-10){
          this.applyDamage(20);
        }
        prev=cur;
      },
      onComplete:()=> ring.destroy()
    });
  }

  private shootBouncy() {
    // Limit to 10 active bouncy bullets at any given time
    const activeBouncyCount = this.bullets.getChildren().filter(b => {
      // Ensure object supports getData and is still active
      return (b as any).active && (b as any).getData && (b as any).getData('isBouncy');
    }).length;

    if (activeBouncyCount >= 10) {
      return; // Too many bouncy bullets, wait until some are destroyed
    }

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

    // Create Save button if not already
    if (!this.pauseSaveButton) {
      this.pauseSaveButton = this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2 + 60, 'SAVE', {
        fontSize: '32px',
        color: '#ffff00',
        backgroundColor: '#000000',
        padding: { left: 20, right: 20, top: 10, bottom: 10 }
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      this.pauseSaveButton.on('pointerdown', () => this.showSaveSlots());
    } else {
      this.pauseSaveButton.setVisible(true);
    }
  }

  private resumeGame() {
    this.physics.world.resume();
    this.time.paused = false;
    this.pauseText.setVisible(false);

    // Hide pause save UI if present
    if (this.pauseSaveButton) this.pauseSaveButton.setVisible(false);
    if (this.slotButtons) this.slotButtons.forEach(b => b.setVisible(false));
  }

  private showSaveSlots() {
    const cx = this.cameras.main.width / 2;
    const cy = this.cameras.main.height / 2 + 120;

    if (!this.slotButtons) {
      this.slotButtons = [1, 2, 3].map((slot, idx) => {
        const btn = this.add.text(cx, cy + idx * 50, `SAVE ${slot}`, {
          fontSize: '28px',
          color: '#ffffff',
          backgroundColor: '#000000',
          padding: { left: 20, right: 20, top: 5, bottom: 5 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        btn.on('pointerdown', () => {
          this.saveGame(slot);
          // Go back to menu
          this.scene.start('menu');
        });
        return btn;
      });
    } else {
      this.slotButtons.forEach(btn => btn.setVisible(true));
    }

    if (this.pauseSaveButton) this.pauseSaveButton.setVisible(false);
  }

  private saveGame(slot: number) {
    const key = `save${slot}`;
    const boss1 = this.zombies.getChildren().find(z => (z as Phaser.GameObjects.Sprite).getData('bossLevel') === 1) as Phaser.GameObjects.Sprite | undefined;
    const boss2 = this.zombies.getChildren().find(z => (z as Phaser.GameObjects.Sprite).getData('bossLevel') === 2) as Phaser.GameObjects.Sprite | undefined;

    const data = {
      score: this.score,
      playerHealth: this.playerHealth,
      playerShield: this.playerShield,
      playerMaxShield: this.playerMaxShield,
      zombieKillCount: this.zombieKillCount,
      bouncyUnlocked: this.bouncyUnlocked,
      swordUnlocked: this.swordUnlocked,
      sawUnlocked: this.sawUnlocked,
      boss1Alive: !!boss1,
      boss1Health: boss1 ? boss1.getData('health') : null,
      boss2Alive: !!boss2,
      boss2Health: boss2 ? boss2.getData('health') : null,
      boss1Defeated: this.boss1Defeated,
      boss2Defeated: this.boss2Defeated,
      boss3Defeated: this.boss3Defeated,
      boss4Defeated: this.boss4Defeated
    };

    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn('Save failed', e);
    }
  }

  /** Load from a given slot */
  private loadGame(slot: number) {
    const key = `save${slot}`;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const data = JSON.parse(raw);

      this.score = data.score ?? 0;
      this.scoreText.setText('Score: ' + this.score);

      this.playerHealth = data.playerHealth ?? this.playerMaxHealth;
      this.playerShield = data.playerShield ?? 0;
      this.playerMaxShield = data.playerMaxShield ?? 100;
      this.zombieKillCount = data.zombieKillCount ?? 0;
      this.bouncyUnlocked = data.bouncyUnlocked ?? false;
      this.swordUnlocked = data.swordUnlocked ?? false;
      this.sawUnlocked = data.sawUnlocked ?? false;
      this.boss1Defeated = data.boss1Defeated ?? false;
      this.boss2Defeated = data.boss2Defeated ?? false;
      this.boss3Defeated = data.boss3Defeated ?? false;
      this.boss4Defeated = data.boss4Defeated ?? false;

      this.updateHealthBar();

      if (data.boss1Alive) {
        this.spawnBoss();
        const boss = this.zombies.getChildren().find(z => (z as Phaser.GameObjects.Sprite).getData('bossLevel') === 1) as Phaser.GameObjects.Sprite | undefined;
        if (boss) boss.setData('health', data.boss1Health ?? 150);
      }

      if (data.boss2Alive) {
        this.spawnSecondBoss();
        const boss2 = this.zombies.getChildren().find(z => (z as Phaser.GameObjects.Sprite).getData('bossLevel') === 2) as Phaser.GameObjects.Sprite | undefined;
        if (boss2) boss2.setData('health', data.boss2Health ?? 200);
      }
      this.pendingLoadSlot = undefined;
    } catch (e) {
      console.warn('Load failed', e);
    }
  }

  /** Sword swing attack */
  private shootSword() {
    const reach = 90; // smaller sword reach
    let sword: Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Alpha;
    if (this.textures.exists('sword')) {
      sword = this.add.sprite(this.player.x, this.player.y, 'sword');
      (sword as Phaser.GameObjects.Sprite).setOrigin(0, 0.5);
      (sword as Phaser.GameObjects.Sprite).setScale(reach / (sword as Phaser.GameObjects.Sprite).width, 1);
    } else {
      // Fallback grey rectangle if texture missing
      sword = this.add.rectangle(this.player.x, this.player.y, reach, 10, 0x999999) as any; // fallback
      (sword as any).setOrigin?.(0, 0.5);
    }
    (sword as any).setDepth?.(3);
    (sword as any).setAlpha?.(1);

    // Starting angle (swing back) and end angle (swing forward)
    const swingRange = Math.PI / 1.5; // 120 deg total
    const startAngle = this.facingAngle - swingRange / 2;
    const endAngle = this.facingAngle + swingRange / 2;
    (sword as any).setRotation?.(startAngle);

    const hitZombies = new Set<Phaser.GameObjects.Sprite>();
    const doHitCheck = () => {
      const currentAngle = (sword as any).rotation ?? this.facingAngle;
      this.zombies.children.entries.forEach(child => {
        const zombie = child as Phaser.GameObjects.Sprite;
        if (!zombie.active || hitZombies.has(zombie)) return;
        const dx = zombie.x - this.player.x;
        const dy = zombie.y - this.player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > reach) return;

        const angleToZombie = Math.atan2(dy, dx);
        const diff = Phaser.Math.Angle.Wrap(angleToZombie - currentAngle);
        // allow 40 deg to either side of blade (narrower than sweep)
        if (Math.abs(diff) <= Math.PI / 4) {
          hitZombies.add(zombie);
          const damage = zombie.getData('isBoss') ? 30 : 25;
          this.damageZombie(zombie, damage);
        }
      });
    };

    doHitCheck(); // initial
 
    // Visual swing tween (rotate and fade)
    this.tweens.add({
      targets: sword,
      rotation: endAngle,
      alpha: 0,
      duration: 200,
      ease: 'Cubic.Out',
      onUpdate: doHitCheck,
      onComplete: () => {
        sword.destroy();
      }
    });
  }

  /** Saw weapon orbiting around player */
  private shootSaw(){
    if(this.bullets.getChildren().some(b=>(b as any).getData?.('isSaw'))) return; // one saw at a time
    const saw=this.add.sprite(this.player.x,this.player.y,'saw');
    this.physics.add.existing(saw);
    this.bullets.add(saw);
    saw.setData('isSaw',true);

    const orbitRadius=100;
    let angle=0;
    const rotateSpeed=2*Math.PI; //rad per sec
    saw.setOrigin(0.5);

    saw.update=()=>{};
    this.events.on('update',()=>{
      if(!saw.active) return;
      angle+=rotateSpeed*this.game.loop.delta/1000;
      saw.x=this.player.x+Math.cos(angle)*orbitRadius;
      saw.y=this.player.y+Math.sin(angle)*orbitRadius;

      // Damage zombies it touches
      this.zombies.children.entries.forEach(z=>{
        const zombie=z as Phaser.GameObjects.Sprite;
        if(!zombie.active||zombie.getData('isBoss')) return;
        const dx=zombie.x-saw.x, dy=zombie.y-saw.y;
        if(Math.sqrt(dx*dx+dy*dy)<20){
          this.damageZombie(zombie,20);
        }
      });
    });

    // Saw lasts 4 seconds
    this.time.delayedCall(4000,()=>{
      saw.destroy();
    });
  }

  /** Tesla placement */
  private placeTesla(){
    if(this.teslaPlaced) return;
    const coil=this.add.sprite(this.player.x,this.player.y,'tesla');
    coil.setScale(0.3); // make coil very small
    coil.setDepth(4);
    this.teslaPlaced=true;

    const blast=()=>{
      const zombies=this.zombies.getChildren().filter(z=>z.active) as Phaser.GameObjects.Sprite[];
      // sort by distance
      zombies.sort((a,b)=>{
        const da=Phaser.Math.Distance.Between(a.x,a.y,coil.x,coil.y);
        const db=Phaser.Math.Distance.Between(b.x,b.y,coil.x,coil.y);
        return da-db;
      });
      let killed = 0;
      zombies.forEach(z => {
        if (killed >= 1) return; // kill only one enemy per blast
        if (z.getData('isBoss')) return; // ignore bosses entirely

        // instakill regular / gunner
        this.damageZombie(z, 999);
        killed++;
      });
      // optional lightning visual
    };

    this.time.addEvent({delay:3000,callback:blast,loop:true});
  }

  /** Spawn fourth boss (rock thrower) */
  private spawnFourthBoss(){
    this.fourthBossSpawned = true;

    const x=Phaser.Math.Between(50,this.cameras.main.width-50);
    const y=Phaser.Math.Between(50,this.cameras.main.height-50);
    const boss=this.physics.add.sprite(x,y,'boss4');
    boss.setScale(1.6);
    boss.setDepth(6);
    this.zombies.add(boss);

    boss.setData('isBoss',true);
    boss.setData('bossLevel',4);
    boss.setData('health',300);
    boss.setData('maxHealth',300);

    const timer=this.time.addEvent({delay:800,callback:()=>this.bossThrowRock(boss),loop:true});
    boss.setData('shootTimer',timer);
    boss.on('destroy',()=>timer.remove(false));
  }

  private bossThrowRock(boss:Phaser.GameObjects.Sprite){
    if(!boss.active) return;
    const rock=this.add.sprite(boss.x,boss.y,'rock');
    this.physics.add.existing(rock);
    this.enemyBullets.add(rock);
    rock.setData('isBossRock',true);
    rock.setDepth(5);
    const speed=400;
    const dx=this.player.x-boss.x;
    const dy=this.player.y-boss.y;
    const dist=Math.sqrt(dx*dx+dy*dy)||1;
    (rock.body as Phaser.Physics.Arcade.Body).setVelocity((dx/dist)*speed,(dy/dist)*speed);
  }
}
