import { describe, it, expect } from 'vitest';
import { calculateCostPaise, MODEL_RATES, OVERDRAFT_LIMIT_PAISE } from '../pricing.js';

describe('calculateCostPaise', () => {
  it('calculates cost for a known model', () => {
    // llama-3.3-70b-versatile: input=6, output=8 paise/1k tokens
    const cost = calculateCostPaise('llama-3.3-70b-versatile', 1000, 1000);
    expect(cost).toBe(14); // (6 + 8) paise
  });

  it('uses default rate for unknown model', () => {
    const cost = calculateCostPaise('some-unknown-model', 1000, 1000);
    const defaultRate = MODEL_RATES['default'];
    expect(cost).toBe(defaultRate.input + defaultRate.output);
  });

  it('rounds up to nearest paise (minimum 1)', () => {
    const cost = calculateCostPaise('llama-3.3-70b-versatile', 1, 1);
    expect(cost).toBeGreaterThanOrEqual(1);
  });

  it('handles zero tokens', () => {
    expect(calculateCostPaise('llama-3.3-70b-versatile', 0, 0)).toBe(0);
  });
});

describe('OVERDRAFT_LIMIT_PAISE', () => {
  it('is -5000 (negative ₹50)', () => {
    expect(OVERDRAFT_LIMIT_PAISE).toBe(-5000);
  });
});
