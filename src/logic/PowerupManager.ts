import Phaser from "phaser";
import { PlayerController } from "./PlayerController";

/**
 * Handles medkit healing, shield pickups, and other temporary power-ups.
 * Spawn of pickups remains in ZombieManager for now; this class wires up
 * collisions and applies effects to the player.
 */
export class PowerupManager {
  // Scene reference not stored to avoid unused warnings
  private player: Phaser.GameObjects.Sprite;
  private playerController: PlayerController;
  private medkits: Phaser.Physics.Arcade.Group;
  private shields: Phaser.Physics.Arcade.Group;
  private zombies: Phaser.Physics.Arcade.Group;

  private teslaPlaced = false;

  constructor(
    scene: Phaser.Scene,
    playerController: PlayerController,
    medkitsGroup: Phaser.Physics.Arcade.Group,
    shieldsGroup: Phaser.Physics.Arcade.Group,
    zombies: Phaser.Physics.Arcade.Group
  ) {
    this.playerController = playerController;
    this.player = playerController.getSprite();
    this.medkits = medkitsGroup;
    this.shields = shieldsGroup;
    this.zombies = zombies;

    const physics = scene.physics;
    physics.add.overlap(this.player, this.medkits, this.onPlayerTouchMedkit, undefined, this);
    physics.add.overlap(this.player, this.shields, this.onPlayerTouchShield, undefined, this);
  }

  // ------------------------------------------------------------------
  // Collision callbacks
  // ------------------------------------------------------------------

  private onPlayerTouchMedkit(_player: any, medkit: any) {
    medkit.destroy();
    this.playerController.heal(20);
  }

  private onPlayerTouchShield(_player: any, shield: any) {
    shield.destroy();
    this.playerController.addBlockCharges(3);
  }

  /** Called each frame (currently unused but keeps API consistent) */
  update() {}

  // ------------------------------------------------------------------
  // Tesla coil deployment
  // ------------------------------------------------------------------

  deployTesla(x: number, y: number) {
    if (this.teslaPlaced) return;
    if (!this.sceneTextureExists('tesla')) return; // ensure texture exists

    const coil = (this.player.scene as Phaser.Scene).add.sprite(x, y, 'tesla');
    coil.setScale(0.3);
    coil.setDepth(4);
    this.teslaPlaced = true;

    const blast = () => {
      const zombies = this.zombies.getChildren().filter(z => (z as any).active) as Phaser.GameObjects.Sprite[];
      zombies.sort((a, b) => {
        const da = Phaser.Math.Distance.Between(a.x, a.y, coil.x, coil.y);
        const db = Phaser.Math.Distance.Between(b.x, b.y, coil.x, coil.y);
        return da - db;
      });
      let killed = 0;
      zombies.forEach(z => {
        if (killed >= 2) return;
        if (z.getData('isBoss')) return;

        // lightning effect
        const scene = this.player.scene as Phaser.Scene;
        const laser = scene.add.graphics();
        laser.lineStyle(4, 0xffff00);
        laser.beginPath();
        laser.moveTo(coil.x, coil.y);
        laser.lineTo(z.x, z.y);
        laser.strokePath();
        scene.tweens.add({ targets: laser, alpha: 0, duration: 200, onComplete: () => laser.destroy() });

        // instant kill regular/gunner
        const damageFunc = (scene as any).damageZombie?.bind(scene) ?? (() => {});
        damageFunc(z, 999);
        killed++;
      });
    };

    (this.player.scene as Phaser.Scene).time.addEvent({ delay: 3000, callback: blast, loop: true });
  }

  private sceneTextureExists(key: string) {
    return (this.player.scene as Phaser.Scene).textures.exists(key);
  }
} 