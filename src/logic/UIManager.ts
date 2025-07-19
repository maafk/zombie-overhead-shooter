import Phaser from "phaser";

export class UIManager {
  // Scene ref not stored to avoid unused warning
  private scoreText: Phaser.GameObjects.Text;
  private weaponText: Phaser.GameObjects.Text;
  private pauseText: Phaser.GameObjects.Text;
  private saveButton?: Phaser.GameObjects.Text;
  private slotButtons?: Phaser.GameObjects.Text[];

  constructor(scene: Phaser.Scene) {

    this.scoreText = scene.add.text(16, 16, 'Score: 0', {
      fontSize: '32px',
      color: '#ffffff'
    });

    this.weaponText = scene.add.text(16, 60, 'Weapon: Normal (1)', {
      fontSize: '24px',
      color: '#ffffff'
    });
    this.pauseText = scene.add.text(scene.cameras.main.width/2, scene.cameras.main.height/2, 'PAUSED', {fontSize:'48px',color:'#ffffff'}).setOrigin(0.5);
    this.pauseText.setVisible(false);
  }

  updateScore(score: number) {
    this.scoreText.setText('Score: ' + score);
  }

  setWeaponLabel(label: string) {
    this.weaponText.setText(label);
  }

  getScoreText() { return this.scoreText; }
  getWeaponText() { return this.weaponText; }

  // Pause overlay
  showPauseOverlay(onSavePressed: () => void) {
    this.pauseText.setVisible(true);
    const scene = this.pauseText.scene;
    if (!this.saveButton) {
      this.saveButton = scene.add.text(scene.cameras.main.width/2, scene.cameras.main.height/2+60,'SAVE',{fontSize:'32px',color:'#ffff00',backgroundColor:'#000000',padding:{left:20,right:20,top:10,bottom:10}}).setOrigin(0.5).setInteractive({useHandCursor:true});
      this.saveButton.on('pointerdown', onSavePressed);
    }
    this.saveButton.setVisible(true);
  }

  hidePauseOverlay() {
    this.pauseText.setVisible(false);
    if (this.saveButton) this.saveButton.setVisible(false);
    if (this.slotButtons) this.slotButtons.forEach(b=>b.setVisible(false));
  }

  showSaveSlots(onSlotClick:(slot:number)=>void) {
    const scene = this.pauseText.scene;
    const cx = scene.cameras.main.width/2;
    const cy = scene.cameras.main.height/2 + 120;
    if(!this.slotButtons){
      this.slotButtons=[1,2,3].map((slot,idx)=>{
        const btn= scene.add.text(cx, cy+idx*50, `SAVE ${slot}`, {fontSize:'28px',color:'#ffffff',backgroundColor:'#000000',padding:{left:20,right:20,top:5,bottom:5}}).setOrigin(0.5).setInteractive({useHandCursor:true});
        btn.on('pointerdown',()=> onSlotClick(slot));
        return btn;
      });
    }
    this.slotButtons.forEach(b=>b.setVisible(true));
    if(this.saveButton) this.saveButton.setVisible(false);
  }
} 