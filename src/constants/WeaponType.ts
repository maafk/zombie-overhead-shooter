export const WeaponType = {
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

/** Numeric id union of WeaponType values */
export type WeaponId = typeof WeaponType[keyof typeof WeaponType]; 