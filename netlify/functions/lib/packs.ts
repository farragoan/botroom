export const TOKEN_PACKS = {
  small:    { amount_paise:  4900, label: '₹49'  },
  standard: { amount_paise: 14900, label: '₹149' },
  power:    { amount_paise: 39900, label: '₹399' },
} as const;

export type PackKey = keyof typeof TOKEN_PACKS;

export function getPackOrThrow(key: string): (typeof TOKEN_PACKS)[PackKey] {
  if (!(key in TOKEN_PACKS)) throw new Error(`Unknown pack: ${key}`);
  return TOKEN_PACKS[key as PackKey];
}
