import Phaser from "phaser";

export class PlayerController {
  private scene: Phaser.Scene;
  private sprite: Phaser.GameObjects.Sprite;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private healthBar: Phaser.GameObjects.Graphics;
  private shieldBar: Phaser.GameObjects.Graphics;
  private blockShieldIndicator: Phaser.GameObjects.Sprite | Phaser.GameObjects.Arc;

  // Stats
  private playerMaxHealth = 100;
  private playerHealth = 100;
  private playerMaxShield = 100;
  private playerShield = 0;
  private blockCharges = 0;

  private facingAngle = 0; // radians

  // Add getters and a state setter for external use
  /** Current shield value (blue bar) */
  getShield() {
    return this.playerShield;
  }

  /** Current maximum shield capacity */
  getMaxShield() {
    return this.playerMaxShield;
  }

  /**
   * Restore player stats from a saved game. Values are clamped to their maximums.
   */
  loadState(health: number, shield: number, maxShield: number) {
    this.playerMaxShield = maxShield;
    this.playerShield = Phaser.Math.Clamp(shield, 0, this.playerMaxShield);
    this.playerHealth = Phaser.Math.Clamp(health, 0, this.playerMaxHealth);
    this.updateHealthBar();
  }

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    const centerX = scene.cameras.main.width / 2;
    const centerY = scene.cameras.main.height / 2;

    // Create player sprite
    this.sprite = scene.physics.add.sprite(centerX, centerY, "hero");
    this.sprite.setScale(0.5);
    (this.sprite.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);
    (this.sprite.body as Phaser.Physics.Arcade.Body).setCircle(this.sprite.width * 0.25);

    // Input
    this.cursors = scene.input.keyboard!.createCursorKeys();

    // UI graphics
    this.healthBar = scene.add.graphics();
    this.shieldBar = scene.add.graphics();

    // Shield indicator (small semi-transparent shield sprite around player)
    if (scene.textures.exists("shield")) {
      this.blockShieldIndicator = scene.add.sprite(this.sprite.x, this.sprite.y, "shield");
      this.blockShieldIndicator.setScale(0.4);
    } else {
      this.blockShieldIndicator = scene.add.circle(this.sprite.x, this.sprite.y, 8, 0x0000ff, 0.3) as unknown as Phaser.GameObjects.Sprite;
    }
    this.blockShieldIndicator.setAlpha(0.6);
    this.blockShieldIndicator.setVisible(false);

    this.updateHealthBar();
  }

  /** Call every frame from the owning Scene */
  update() {
    // Skip processing when scene is paused via physics world
    if (this.scene.physics.world.isPaused) return;

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0);

    let moveX = 0;
    let moveY = 0;

    if (this.cursors.left?.isDown) {
      moveX = -1;
      body.setVelocityX(-300);
    }
    if (this.cursors.right?.isDown) {
      moveX = 1;
      body.setVelocityX(300);
    }
    if (this.cursors.up?.isDown) {
      moveY = -1;
      body.setVelocityY(-300);
    }
    if (this.cursors.down?.isDown) {
      moveY = 1;
      body.setVelocityY(300);
    }

    // Diagonal speed normalisation
    if (moveX !== 0 && moveY !== 0) {
      const d = 300 * 0.707;
      body.setVelocity(moveX * d, moveY * d);
    }

    if (moveX !== 0 || moveY !== 0) {
      this.facingAngle = Math.atan2(moveY, moveX);
    }

    // Rotate sprite
    this.sprite.setRotation(this.facingAngle);

    // Update shield indicator position/visibility
    if (this.blockShieldIndicator) {
      this.blockShieldIndicator.setPosition(this.sprite.x, this.sprite.y);
      this.blockShieldIndicator.setVisible(this.blockCharges > 0);
    }
  }

  /** Apply damage; returns true when the player died */
  applyDamage(amount: number): boolean {
    if (this.blockCharges > 0) {
      this.blockCharges--;
      return false; // damage blocked
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

    return this.playerHealth <= 0;
  }

  heal(amount: number) {
    this.playerHealth = Math.min(this.playerHealth + amount, this.playerMaxHealth);
    this.updateHealthBar();
  }

  /** Increments currently stored shield (blue bar) */
  addShield(amount: number, maxCap?: number) {
    if (maxCap != null) {
      this.playerMaxShield = maxCap;
    }
    this.playerShield = Math.min(this.playerShield + amount, this.playerMaxShield);
    this.updateHealthBar();
  }

  /** Grants temporary block shield charges (used by shield pickup) */
  addBlockCharges(charges: number) {
    this.blockCharges += charges;
  }

  getFacingAngle() {
    return this.facingAngle;
  }

  /** Expose the underlying sprite for collisions */
  getSprite() {
    return this.sprite;
  }

  getHealth() {
    return this.playerHealth;
  }

  private updateHealthBar() {
    const x = 16;
    const y = 100;
    const width = 200;
    const height = 20;

    this.healthBar.clear();
    this.shieldBar.clear();

    // Background
    this.healthBar.fillStyle(0x444444, 1);
    this.healthBar.fillRect(x, y, width, height);
    this.shieldBar.fillStyle(0x444444, 1);
    const shieldX = x + width + 10;
    this.shieldBar.fillRect(shieldX, y, width, height);

    // Health fill (red)
    const healthPercent = Phaser.Math.Clamp(this.playerHealth / this.playerMaxHealth, 0, 1);
    this.healthBar.fillStyle(0xff0000, 1);
    this.healthBar.fillRect(x, y, width * healthPercent, height);

    // Shield (blue)
    const shieldPercent = Phaser.Math.Clamp(this.playerShield / this.playerMaxShield, 0, 1);
    this.shieldBar.fillStyle(0x0000ff, 1);
    this.shieldBar.fillRect(shieldX, y, width * shieldPercent, height);
  }
} 