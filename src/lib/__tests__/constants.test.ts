import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('base path', () => {
  it('has no prefix at root', async () => {
    vi.stubEnv('BASE_URL', '/');
    const { BASE, API_BASE } = await import('@/lib/constants');
    expect(BASE).toBe('');
    expect(API_BASE).toBe('/api');
  });

  it('prefixes API calls under /botroom/', async () => {
    vi.stubEnv('BASE_URL', '/botroom/');
    const { BASE, API_BASE } = await import('@/lib/constants');
    expect(BASE).toBe('/botroom');
    expect(API_BASE).toBe('/botroom/api');
  });
});
