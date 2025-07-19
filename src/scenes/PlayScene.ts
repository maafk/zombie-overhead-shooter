import { Scene } from "phaser";
import { WeaponType } from "../constants/WeaponType";
import { PlayerController } from "../logic/PlayerController";
import { ZombieManager } from "../logic/ZombieManager";
import { BossManager } from "../logic/BossManager";
import { PowerupManager } from "../logic/PowerupManager";
import { UIManager } from "../logic/UIManager";
import { WeaponSystem } from "../logic/WeaponSystem";
import { SaveLoadService } from "../logic/SaveLoadService";

export class PlayScene extends Scene {
  private player!: Phaser.GameObjects.Sprite;
  private playerController!: PlayerController;
  private zombies!: Phaser.Physics.Arcade.Group;
  private bullets!: Phaser.Physics.Arcade.Group;
  private zombieManager!: ZombieManager;
  private bossManager!: BossManager;
  private powerupManager!: PowerupManager;
  private uiManager!: UIManager;
  private weaponSystem!: WeaponSystem;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private numberKeys!: { [key: number]: Phaser.Input.Keyboard.Key };
  private pauseKey!: Phaser.Input.Keyboard.Key;
  private isPaused = false;
  private score = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private weaponText!: Phaser.GameObjects.Text;
  // facingAngle handled via PlayerController
  private playerMaxHealth = 100;
  private playerHealth = 100;
  // --- Shield related ---
  // player shield charges handled by PlayerController
  // blockShieldIndicator removed – handled by PlayerController
  private pendingLoadSlot?: number;
  // --- Sandbox flags ---
  private isSandbox = false;
  private sandboxInitialScore = 0;

  private playerMaxShield = 100;
  private playerShield = 0;

  // Track zombie kills to grant shield every 20 kills
  private zombieKillCount = 0;

  // Unlockable weapons
  private bouncyUnlocked = false;
  private swordUnlocked = false;
  private sawUnlocked = false;
  private teslaUnlocked = false;

  private enemyBullets!: Phaser.Physics.Arcade.Group;
  private medkits!: Phaser.Physics.Arcade.Group;
  private shields!: Phaser.Physics.Arcade.Group;

  constructor() {
    super("play");
  }

  /** Receive data when scene starts */
  init(data: { loadSlot?: number; sandbox?: boolean; initialScore?: number }) {
    if (data && typeof data.loadSlot === 'number') {
      this.pendingLoadSlot = data.loadSlot;
    } else {
      this.pendingLoadSlot = undefined;
    }

    // Sandbox parameters
    this.isSandbox = data?.sandbox === true;
    if (this.isSandbox) {
      this.sandboxInitialScore = data?.initialScore ?? 0;
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
    // Player controller handles player creation & input
    this.playerController = new PlayerController(this);
    this.player = this.playerController.getSprite();

    // Bullet group remains local to scene; zombies handled by manager
    this.bullets = this.physics.add.group();

    // Instantiate WeaponSystem (handles cooldowns & bullet creation)
    this.weaponSystem = new WeaponSystem(this, this.player, this.bullets, () => this.playerController.getFacingAngle(), this.zombies, (z,d)=>this.damageZombie(z,d));

    // Instantiate ZombieManager (handles its own groups)
    this.zombieManager = new ZombieManager(this, this.player);
    this.zombies = this.zombieManager.getZombies();
    this.enemyBullets = this.zombieManager.getEnemyBullets();
    this.medkits = this.zombieManager.getMedkits();
    this.shields = this.zombieManager.getShields();
    // Instantiate PowerupManager for medkits & shields
    this.powerupManager = new PowerupManager(this, this.playerController, this.medkits, this.shields, this.zombies);
    this.bossManager = new BossManager(this, this.player, this.zombies, this.enemyBullets);
    this.uiManager = new UIManager(this);
    // Redirect existing fields to UIManager texts for backward compatibility
    (this as any).scoreText = this.uiManager.getScoreText();
    (this as any).weaponText = this.uiManager.getWeaponText();

    // Set BossManager callbacks
    this.bossManager.setCallbacks({
      onBossKilled: (_level, scoreReward) => {
        this.score += scoreReward;
        this.scoreText.setText('Score: ' + this.score);
        this.incrementKillCount();
      },
      onWeaponUnlocked: (weaponName) => {
        if (weaponName === 'Bouncy Gun') {
          this.bouncyUnlocked = true;
          this.weaponText.setText('Weapon unlocked! Press 6 for Bouncy Gun');
        } else if (weaponName === 'Sword') {
          this.swordUnlocked = true;
          this.weaponText.setText('Weapon unlocked! Press 7 for Sword');
        } else if (weaponName === 'Saw') {
          this.sawUnlocked = true;
          this.weaponText.setText('Weapon unlocked! Press 8 for Saw');
        } else if (weaponName === 'Tesla Coil') {
          this.teslaUnlocked = true;
          this.weaponText.setText('Weapon unlocked! Press 9 for Tesla Coil');
        }
      },
      onShieldCapacityIncrease: (newCapacity) => {
        this.playerController.addShield(0, newCapacity);
        this.updateHealthBar();
      }
    });

    // Initialize input for weapons / pause (arrow keys handled by PlayerController internally)
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
    this.score = this.isSandbox ? this.sandboxInitialScore : 0;

    // Reset kill counters and boss flags for a fresh session
    this.zombieKillCount = 0;
    this.bossManager.checkSpawnConditions(this.zombieKillCount, this.score, this.isSandbox);

    // Create score text
    // this.scoreText = this.add.text(16, 16, 'Score: ' + this.score, {
    //   fontSize: '32px',
    //   color: '#ffffff'
    // });

    // Create weapon text
    // this.weaponText = this.add.text(16, 60, 'Weapon: Normal (1)', {
    //   fontSize: '24px',
    //   color: '#ffffff'
    // });

    // If sandbox mode, unlock all special weapons immediately
    if (this.isSandbox) {
      this.bouncyUnlocked = true;
      this.swordUnlocked = true;
      this.sawUnlocked = true;
      this.teslaUnlocked = true;
    }

    // PlayerController handles health / shield bars and block indicator

    // Note: Boss will spawn dynamically after 100 kills; no immediate spawn at create.

    // Set up collision detection
    this.physics.add.overlap(this.bullets, this.zombies, this.bulletHitZombie, undefined, this);
    this.physics.add.overlap(this.player, this.zombies, this.playerHitZombie, undefined, this);
    // Damage player when hit by enemy bullets (from gunners)
    this.physics.add.overlap(this.player, this.enemyBullets, this.playerHitEnemyBullet, undefined, this);
    // Overlaps handled by PowerupManager

    // ZombieManager handles spawn timer

    // If coming from a saved game, load it
    if (this.pendingLoadSlot != null) {
      this.loadGame(this.pendingLoadSlot);
      this.pendingLoadSlot = undefined; // clear after loading
    }

    // Check boss spawn conditions after everything is initialized
    this.bossManager.checkSpawnConditions(this.zombieKillCount, this.score, this.isSandbox);
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

    // Delegate player & zombie updates
    this.playerController.update();
    this.zombieManager.update();

    // Weapon switching with number keys
    if (Phaser.Input.Keyboard.JustDown(this.numberKeys[1])) {
      this.weaponSystem.setWeapon(WeaponType.NORMAL);
      this.weaponText.setText('Weapon: Normal (1)');
    }
    if (Phaser.Input.Keyboard.JustDown(this.numberKeys[2])) {
      this.weaponSystem.setWeapon(WeaponType.SPREAD);
      this.weaponText.setText('Weapon: Spread (2)');
    }
    if (Phaser.Input.Keyboard.JustDown(this.numberKeys[3])) {
      this.weaponSystem.setWeapon(WeaponType.THICK);
      this.weaponText.setText('Weapon: Thick (3)');
    }
    if (Phaser.Input.Keyboard.JustDown(this.numberKeys[4])) {
      this.weaponSystem.setWeapon(WeaponType.RING);
      this.weaponText.setText('Weapon: Ring (4)');
    }
    if (Phaser.Input.Keyboard.JustDown(this.numberKeys[5])) {
      this.weaponSystem.setWeapon(WeaponType.SOLID_RING);
      this.weaponText.setText('Weapon: Solid Ring (5)');
    }

    if (Phaser.Input.Keyboard.JustDown(this.numberKeys[6])) {
      if (this.bouncyUnlocked) {
        this.weaponSystem.setWeapon(WeaponType.BOUNCY);
        this.weaponText.setText('Weapon: Bouncy (6)');
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.numberKeys[7])) {
      if (this.swordUnlocked) {
        this.weaponSystem.setWeapon(WeaponType.SWORD);
        this.weaponText.setText('Weapon: Sword (7)');
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.numberKeys[8])) {
      if (this.sawUnlocked) {
        this.weaponSystem.setWeapon(WeaponType.SAW);
        this.weaponText.setText('Weapon: Saw (8)');
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.numberKeys[9])) {
      if (this.teslaUnlocked) {
        this.weaponSystem.setWeapon(WeaponType.TESLA);
        this.weaponText.setText('Weapon: Tesla Coil (9)');
      }
    }

    // Shooting with spacebar
    if (this.spaceKey.isDown) {
      this.weaponSystem.tryFire();
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

    // Update powerups (no-op currently)
    this.powerupManager.update();
    // Delegate boss handling to BossManager
    this.bossManager.update();
  }

  private bulletHitZombie(bullet: any, zombie: any) {
    // Base damage is whatever the bullet reports (defaults to 20)
    let dmg = (bullet.getData && bullet.getData('damage') != null) ? bullet.getData('damage') : 20;

    // If target is Boss 4 we override damage so that specific numbers of hits are required
    const bossLevel = (zombie as Phaser.GameObjects.Sprite).getData('bossLevel');
    if (bossLevel === 4) {
      const wType = bullet.getData && bullet.getData('weaponType');
      switch (wType) {
        case WeaponType.NORMAL:
        case WeaponType.SPREAD:
        case WeaponType.RING:
        case WeaponType.BOUNCY:
          dmg = 20; // 25 hits (500 HP / 20)
          break;
        case WeaponType.THICK:
          dmg = 50; // 10 hits
          break;
        case WeaponType.SOLID_RING:
          dmg = 33.33; // ≈15 hits
          break;
        default:
          dmg = 0; // e.g. Saw or unknown – no damage
      }
    }

    // Remove only the zombie, let bullet continue through
    this.damageZombie(zombie as Phaser.GameObjects.Sprite, dmg);
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

  // ---- Delegated helpers to PlayerController ----
  private updateHealthBar() {
    this.playerController && (this.playerController as any)["updateHealthBar"]?.();
  }

  // applyDamage duplicate removed; single implementation exists later in file

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

  // --- Helper methods ---

  /**
   * Apply damage to the player, depleting shield first and then health.
   */
  private applyDamage(amount: number) {
    if (!this.playerController) return;
    const died = this.playerController.applyDamage(amount);
    if (died) {
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
      this.playerController.addShield(20);
    }

    // Check boss spawn conditions
    this.bossManager.checkSpawnConditions(this.zombieKillCount, this.score, this.isSandbox);
  }

  /**
   * Damage a zombie, supporting bosses with health. Returns true if zombie was destroyed.
   */
  private damageZombie(zombie: Phaser.GameObjects.Sprite, amount: number): boolean {
    if (zombie.getData('isBoss')) {
      let health: number = zombie.getData('health');
      health -= amount;
      if (health <= 0) {
        this.bossManager.killBoss(zombie);
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

  // --- Pause helpers ---
  private pauseGame() {
    this.physics.world.pause();
    this.time.paused = true;
    this.uiManager.showPauseOverlay(()=> this.uiManager.showSaveSlots(slot=>{
      this.saveGame(slot);
      this.scene.start('menu');
    }));
  }

  private resumeGame() {
    this.physics.world.resume();
    this.time.paused = false;
    this.uiManager.hidePauseOverlay();
  }

  private saveGame(slot: number) {
    const boss1 = this.zombies.getChildren().find(z => (z as Phaser.GameObjects.Sprite).getData('bossLevel') === 1) as Phaser.GameObjects.Sprite | undefined;
    const boss2 = this.zombies.getChildren().find(z => (z as Phaser.GameObjects.Sprite).getData('bossLevel') === 2) as Phaser.GameObjects.Sprite | undefined;
    const defeatedStates = this.bossManager.getDefeatedStates();

    const data = {
      score: this.score,
      playerHealth: this.playerHealth,
      playerShield: this.playerShield,
      playerMaxShield: this.playerMaxShield,
      zombieKillCount: this.zombieKillCount,
      bouncyUnlocked: this.bouncyUnlocked,
      swordUnlocked: this.swordUnlocked,
      sawUnlocked: this.sawUnlocked,
      teslaUnlocked: this.teslaUnlocked,
      boss1Alive: !!boss1,
      boss1Health: boss1 ? boss1.getData('health') : null,
      boss2Alive: !!boss2,
      boss2Health: boss2 ? boss2.getData('health') : null,
      boss1Defeated: defeatedStates.boss1Defeated,
      boss2Defeated: defeatedStates.boss2Defeated,
      boss3Defeated: defeatedStates.boss3Defeated,
      boss4Defeated: defeatedStates.boss4Defeated
    };

    try {
      SaveLoadService.save(slot,data);
    } catch (e) {
      console.warn('Save failed', e);
    }
  }

  /** Load from a given slot */
  private loadGame(slot: number) {
    try {
      const data = SaveLoadService.load(slot);
      if(!data) return;

      this.score = data.score ?? 0;
      this.scoreText.setText('Score: ' + this.score);

      this.playerHealth = data.playerHealth ?? this.playerMaxHealth;
      this.playerShield = data.playerShield ?? 0;
      this.playerMaxShield = data.playerMaxShield ?? 100;
      this.zombieKillCount = data.zombieKillCount ?? 0;
      this.bouncyUnlocked = data.bouncyUnlocked ?? false;
      this.swordUnlocked = data.swordUnlocked ?? false;
      this.sawUnlocked = data.sawUnlocked ?? false;
      this.teslaUnlocked = data.teslaUnlocked ?? false;

      // Set boss defeated states
      this.bossManager.setDefeatedStates({
        boss1Defeated: data.boss1Defeated ?? false,
        boss2Defeated: data.boss2Defeated ?? false,
        boss3Defeated: data.boss3Defeated ?? false,
        boss4Defeated: data.boss4Defeated ?? false
      });

      this.updateHealthBar();

      // TODO: Handle restoring alive bosses with saved health
      // This requires BossManager to expose methods for spawning specific bosses with health

      this.pendingLoadSlot = undefined;
    } catch (e) {
      console.warn('Load failed', e);
    }
  }
}
