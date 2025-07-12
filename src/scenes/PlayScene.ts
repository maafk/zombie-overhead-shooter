import { Scene } from "phaser";

const WeaponType = {
  NORMAL: 0,
  SPREAD: 1,
  THICK: 2,
  RING: 3,
  SOLID_RING: 4
} as const;

export class PlayScene extends Scene {
  private player!: Phaser.GameObjects.Sprite;
  private playerDirection!: Phaser.GameObjects.Rectangle;
  private zombies!: Phaser.Physics.Arcade.Group;
  private bullets!: Phaser.Physics.Arcade.Group;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private numberKeys!: { [key: number]: Phaser.Input.Keyboard.Key };
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

  constructor() {
    super("play");
  }

  preload() {
    // Load zombie sprite (public domain asset from Kenney Top-down Shooter pack)
    // Place PNG at `public/zombie.png` (e.g. PNG 64×64 px) or update the path below
    this.load.image('zombie', 'zombie.png');
    // Load hero sprite
    this.load.image('hero', 'hero.png');
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

    // Initialize input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    
    // Initialize number keys for weapon selection
    this.numberKeys = {
      1: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
      2: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
      3: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
      4: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR),
      5: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.FIVE)
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
    this.updateHealthBar();

    // Set up collision detection
    this.physics.add.overlap(this.bullets, this.zombies, this.bulletHitZombie, undefined, this);
    this.physics.add.overlap(this.player, this.zombies, this.playerHitZombie, undefined, this);

    // Spawn zombies periodically
    this.time.addEvent({
      delay: 1000, // spawn every second
      callback: this.spawnZombie,
      callbackScope: this,
      loop: true
    });
  }

  update() {
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

    // Shooting with spacebar
    const currentCooldown = this.getWeaponCooldown();
    if (this.spaceKey.isDown && this.time.now - this.lastShotTime > currentCooldown) {
      this.shoot();
      this.lastShotTime = this.time.now;
    }

    // Move zombies toward player
    this.zombies.children.entries.forEach((zombie) => {
      const zombieGO = zombie as Phaser.GameObjects.Sprite;
      const zombieBody = zombie.body as Phaser.Physics.Arcade.Body;
      
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

    // Clean up bullets that go off screen
    this.bullets.children.entries.forEach((bullet) => {
      const bulletGO = bullet as Phaser.GameObjects.Arc;
      const screenWidth = this.cameras.main.width;
      const screenHeight = this.cameras.main.height;
      
      if (bulletGO.x < -50 || bulletGO.x > screenWidth + 50 || bulletGO.y < -50 || bulletGO.y > screenHeight + 50) {
        bullet.destroy();
      }
    });
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

    // Create zombie sprite
    const zombie = this.physics.add.sprite(x!, y!, 'zombie');
    zombie.setScale(0.5); // down-scale large sprites if needed
    (zombie.body as Phaser.Physics.Arcade.Body).setCircle(zombie.width * 0.25); // circular body
    this.zombies.add(zombie);
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
            zombie.destroy();
            
            // Increase score
            this.score += 10;
            this.scoreText.setText('Score: ' + this.score);
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
      default:
        return 200;
    }
  }

  private bulletHitZombie(bullet: any, zombie: any) {
    // Remove only the zombie, let bullet continue through
    zombie.destroy();
    
    // Increase score
    this.score += 10;
    this.scoreText.setText('Score: ' + this.score);
  }

  private playerHitZombie(player: any, zombie: any) {
    zombie.destroy();

    this.playerHealth -= 20; // Damage amount per hit
    this.updateHealthBar();

    if (this.playerHealth <= 0) {
      this.scene.restart();
    }
  }

  private updateHealthBar() {
    const x = 16;
    const y = 100;
    const width = 200;
    const height = 20;

    this.healthBar.clear();

    // Draw background
    this.healthBar.fillStyle(0x444444, 1);
    this.healthBar.fillRect(x, y, width, height);

    // Draw health fill
    const healthPercent = Phaser.Math.Clamp(this.playerHealth / this.playerMaxHealth, 0, 1);
    this.healthBar.fillStyle(0xff0000, 1);
    this.healthBar.fillRect(x, y, width * healthPercent, height);
  }
}
