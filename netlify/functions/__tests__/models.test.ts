import { describe, it, expect } from 'vitest';
import {
  GROQ_DISPLAY_NAMES,
  PREFERRED_ORDER,
  sortGroqModels,
} from '../models.mts';

type ModelInfo = { id: string; name: string; provider: 'groq' | 'openrouter' };

describe('models — curated display names', () => {
  it('compound-beta-mini has friendly name "Compound Mini"', () => {
    expect(GROQ_DISPLAY_NAMES['compound-beta-mini']).toBe('Compound Mini');
  });

  it('llama-4-maverick has "GPT OSS" in its label', () => {
    expect(GROQ_DISPLAY_NAMES['llama-4-maverick-17b-128e-instruct']).toMatch(/GPT OSS/i);
  });

  it('compound-beta-mini is first in preferred order', () => {
    expect(PREFERRED_ORDER[0]).toBe('compound-beta-mini');
  });

  it('llama-4-maverick is second in preferred order (default CHECKER)', () => {
    expect(PREFERRED_ORDER[1]).toBe('llama-4-maverick-17b-128e-instruct');
  });
});

describe('sortGroqModels', () => {
  const makeModel = (id: string): ModelInfo => ({
    id,
    name: GROQ_DISPLAY_NAMES[id] ?? id,
    provider: 'groq',
  });

  it('sorts preferred models to the front', () => {
    const input: ModelInfo[] = [
      makeModel('llama3-8b-8192'),
      makeModel('llama-4-maverick-17b-128e-instruct'),
      makeModel('compound-beta-mini'),
    ];
    const sorted = sortGroqModels(input);
    expect(sorted[0].id).toBe('compound-beta-mini');
    expect(sorted[1].id).toBe('llama-4-maverick-17b-128e-instruct');
  });

  it('places unprioritised models after preferred ones', () => {
    const input: ModelInfo[] = [
      makeModel('some-unknown-model'),
      makeModel('compound-beta-mini'),
    ];
    const sorted = sortGroqModels(input);
    expect(sorted[0].id).toBe('compound-beta-mini');
    expect(sorted[1].id).toBe('some-unknown-model');
  });

  it('sorts multiple unprioritised models alphabetically by name', () => {
    const input: ModelInfo[] = [
      { id: 'z-model', name: 'Z Model', provider: 'groq' },
      { id: 'a-model', name: 'A Model', provider: 'groq' },
    ];
    const sorted = sortGroqModels(input);
    expect(sorted[0].id).toBe('a-model');
    expect(sorted[1].id).toBe('z-model');
  });

  it('does not mutate the original array', () => {
    const input: ModelInfo[] = [makeModel('compound-beta-mini'), makeModel('llama3-8b-8192')];
    const original = [...input];
    sortGroqModels(input);
    expect(input).toEqual(original);
  });
});
