import { describe, it, expect } from 'vitest';
import { TOKEN_PACKS, getPackOrThrow } from '../packs.js';

describe('TOKEN_PACKS', () => {
  it('has small, standard, and power packs', () => {
    expect(TOKEN_PACKS.small).toBeDefined();
    expect(TOKEN_PACKS.standard).toBeDefined();
    expect(TOKEN_PACKS.power).toBeDefined();
  });

  it('all packs have amount_paise > 0', () => {
    for (const pack of Object.values(TOKEN_PACKS)) {
      expect(pack.amount_paise).toBeGreaterThan(0);
    }
  });
});

describe('getPackOrThrow', () => {
  it('returns pack for valid key', () => {
    expect(getPackOrThrow('small')).toBe(TOKEN_PACKS.small);
  });

  it('throws for unknown pack', () => {
    expect(() => getPackOrThrow('unicorn')).toThrow();
  });
});
