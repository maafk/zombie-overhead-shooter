import { Scene } from 'phaser';

export class MenuScene extends Scene {
  private instructionsText?: Phaser.GameObjects.Text;

  constructor() {
    super('menu');
  }

  create() {
    // Ensure previous reference cleared when scene restarts
    this.instructionsText = undefined;
    // Reset save/load slot UI references so they rebuild fresh on every scene restart
    this.saveSlotTexts = undefined;
    this.saveInfoTexts = undefined;

    const { width, height } = this.cameras.main;

    // Title
    this.add.text(width / 2, height * 0.2, 'Zombie Shooter', {
      fontSize: '48px',
      color: '#ffffff'
    }).setOrigin(0.5);

    // Start Button
    const startBtn = this.add.text(width / 2, height * 0.4, 'START', {
      fontSize: '36px',
      color: '#00ff00',
      backgroundColor: '#000000',
      padding: { left: 20, right: 20, top: 10, bottom: 10 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    startBtn.on('pointerdown', () => {
      this.scene.start('play');
    });

    // Instructions Button
    const instrBtn = this.add.text(width / 2, height * 0.55, 'INSTRUCTIONS', {
      fontSize: '36px',
      color: '#00ffff',
      backgroundColor: '#000000',
      padding: { left: 20, right: 20, top: 10, bottom: 10 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    instrBtn.on('pointerdown', () => {
      this.toggleInstructions();
    });

    // Save / Load Button
    const saveBtn = this.add.text(width / 2, height * 0.7, 'SAVE', {
      fontSize: '36px',
      color: '#ffaa00',
      backgroundColor: '#000000',
      padding: { left: 20, right: 20, top: 10, bottom: 10 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    saveBtn.on('pointerdown', () => {
      this.showSaveSlots();
    });

    // Leaderboard display
    this.displayLeaderboard();

    // Sandbox Button
    const sandboxBtn = this.add.text(width / 2, height * 0.85, 'SANDBOX', {
      fontSize: '36px',
      color: '#ff00ff',
      backgroundColor: '#000000',
      padding: { left: 20, right: 20, top: 10, bottom: 10 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    sandboxBtn.on('pointerdown', () => {
      const rawScore = window.prompt('Enter starting score (0-5000):', '0');
      if (rawScore === null) return; // user cancelled
      const parsed = parseInt(rawScore, 10);
      const initialScore = isNaN(parsed) ? 0 : Phaser.Math.Clamp(parsed, 0, 5000);
      this.scene.start('play', { sandbox: true, initialScore });
    });
  }

  /** Load leaderboard and render top 5 on right side */
  private displayLeaderboard() {
    const { width, height } = this.cameras.main;
    let scores: number[] = [];
    try {
      const raw = localStorage.getItem('leaderboard');
      scores = raw ? JSON.parse(raw) : [];
    } catch {
      scores = [];
    }

    this.add.text(width - 150, height * 0.25, 'LEADERBOARD', {
      fontSize: '32px',
      color: '#ffffff'
    }).setOrigin(0.5);

    scores.slice(0, 5).forEach((score, idx) => {
      this.add.text(width - 150, height * 0.3 + idx * 40, `${idx + 1}. ${score}`, {
        fontSize: '28px',
        color: '#ffffaa'
      }).setOrigin(0.5);
    });
  }

  private saveSlotTexts?: Phaser.GameObjects.Text[];
  private saveInfoTexts?: Phaser.GameObjects.Text[];

  private showSaveSlots() {
    const { width, height } = this.cameras.main;

    // Hide main buttons by setting visible=false for all existing children except title
    this.children.each(child => {
      if (child instanceof Phaser.GameObjects.Text && child.text !== 'Zombie Shooter') {
        child.setVisible(false);
      }
    });

    const yBase = height * 0.4;

    if (!this.saveSlotTexts) {
      this.saveSlotTexts = [];
      this.saveInfoTexts = [];

      [1, 2, 3].forEach((slot, idx) => {
        const btnY = yBase + idx * 80;

        const btn = this.add.text(width / 2, btnY, `SAVE ${slot}`, {
          fontSize: '32px',
          color: '#ffffff',
          backgroundColor: '#000000',
          padding: { left: 20, right: 20, top: 10, bottom: 10 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        const info = this.getSaveInfo(slot);
        const infoText = this.add.text(width / 2, btnY + 30, info, {
          fontSize: '20px',
          color: '#aaaaaa',
          align: 'center'
        }).setOrigin(0.5);

        btn.on('pointerdown', () => {
          const raw = localStorage.getItem(`save${slot}`);
          if (raw) {
            this.scene.start('play', { loadSlot: slot });
          } else {
            this.scene.start('play');
          }
        });

        this.saveSlotTexts!.push(btn);
        this.saveInfoTexts!.push(infoText);
      });
    } else {
      this.saveSlotTexts.forEach((t, idx) => {
        t.setVisible(true);
        if (this.saveInfoTexts && this.saveInfoTexts[idx]) {
          this.saveInfoTexts[idx].setText(this.getSaveInfo(idx + 1));
          this.saveInfoTexts[idx].setVisible(true);
        }
      });
    }
  }

  /** Generate text summary for a save slot */
  private getSaveInfo(slot: number): string {
    const raw = localStorage.getItem(`save${slot}`);
    if (!raw) return 'Empty';

    try {
      const data = JSON.parse(raw);
      const score = data.score ?? 0;
      const unlocked: string[] = [];
      if (data.bouncyUnlocked) unlocked.push('Bouncy');
      const unlockedStr = unlocked.length ? unlocked.join(', ') : 'None';
      return `Score: ${score}\nUnlocked: ${unlockedStr}`;
    } catch {
      return 'Corrupt';
    }
  }

  private toggleInstructions() {
    const { width, height } = this.cameras.main;
    if (this.instructionsText) {
      // Toggle visibility
      this.instructionsText.setVisible(!this.instructionsText.visible);
      return;
    }

    // Create instructions text
    const text = `Use ARROW KEYS to move\nSPACE BAR to shoot\n1-5 to switch weapons`;
    this.instructionsText = this.add.text(width / 2, height * 0.75, text, {
      fontSize: '28px',
      color: '#ffffff',
      align: 'center',
      backgroundColor: '#000000',
      padding: { left: 10, right: 10, top: 10, bottom: 10 }
    }).setOrigin(0.5);
  }
} 