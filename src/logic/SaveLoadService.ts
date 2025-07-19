export interface SaveData {
  score: number;
  playerHealth: number;
  playerShield: number;
  playerMaxShield: number;
  zombieKillCount: number;
  bouncyUnlocked: boolean;
  swordUnlocked: boolean;
  sawUnlocked: boolean;
  teslaUnlocked: boolean;
  boss1Alive: boolean;
  boss1Health: number | null;
  boss2Alive: boolean;
  boss2Health: number | null;
  boss1Defeated: boolean;
  boss2Defeated: boolean;
  boss3Defeated: boolean;
  boss4Defeated: boolean;
}

export class SaveLoadService {
  static save(slot: number, data: SaveData) {
    const key = `save${slot}`;
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn('Save failed', e);
    }
  }

  static load(slot: number): SaveData | null {
    const key = `save${slot}`;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw) as SaveData;
    } catch (e) {
      console.warn('Load failed', e);
      return null;
    }
  }
} 