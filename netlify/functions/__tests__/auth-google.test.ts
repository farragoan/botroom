import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from '../auth-google.mts';

describe('auth-google', () => {
  beforeEach(() => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client-id.apps.googleusercontent.com');
    vi.stubEnv('GOOGLE_REDIRECT_URI', 'https://example.netlify.app/api/auth/google/callback');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 204 on OPTIONS preflight', async () => {
    const req = new Request('https://example.com/api/auth/google', { method: 'OPTIONS' });
    const res = await handler(req);
    expect(res.status).toBe(204);
  });

  it('redirects to Google OAuth URL with correct params', async () => {
    const req = new Request('https://example.com/api/auth/google', { method: 'GET' });
    const res = await handler(req);

    expect(res.status).toBe(302);
    const location = res.headers.get('location');
    expect(location).toBeTruthy();

    const redirectUrl = new URL(location!);
    expect(redirectUrl.hostname).toBe('accounts.google.com');
    expect(redirectUrl.searchParams.get('client_id')).toBe('test-client-id.apps.googleusercontent.com');
    expect(redirectUrl.searchParams.get('redirect_uri')).toBe(
      'https://example.netlify.app/api/auth/google/callback',
    );
    expect(redirectUrl.searchParams.get('response_type')).toBe('code');
    expect(redirectUrl.searchParams.get('scope')).toContain('openid');
    expect(redirectUrl.searchParams.get('scope')).toContain('email');
    expect(redirectUrl.searchParams.get('scope')).toContain('profile');
  });

  it('returns 500 when GOOGLE_CLIENT_ID is missing', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', '');
    const req = new Request('https://example.com/api/auth/google', { method: 'GET' });
    const res = await handler(req);
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('not configured');
  });

  it('returns 500 when GOOGLE_REDIRECT_URI is missing', async () => {
    vi.stubEnv('GOOGLE_REDIRECT_URI', '');
    const req = new Request('https://example.com/api/auth/google', { method: 'GET' });
    const res = await handler(req);
    expect(res.status).toBe(500);
  });
});
