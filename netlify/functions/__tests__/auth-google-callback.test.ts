import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from '../auth-google-callback.mts';

const MOCK_TOKENS = { access_token: 'ya29.mock-access-token', token_type: 'Bearer', expires_in: 3600 };
const MOCK_USER = {
  id: 'google-user-123',
  email: 'test@example.com',
  verified_email: true,
  name: 'Test User',
  given_name: 'Test',
  family_name: 'User',
  picture: 'https://example.com/photo.jpg',
};

describe('auth-google-callback', () => {
  beforeEach(() => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client-id.apps.googleusercontent.com');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'test-client-secret');
    vi.stubEnv('GOOGLE_REDIRECT_URI', 'https://example.netlify.app/api/auth/google/callback');
    vi.stubEnv('JWT_SECRET', 'a'.repeat(64));
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('returns 204 on OPTIONS preflight', async () => {
    const req = new Request('https://example.com/api/auth/google/callback', { method: 'OPTIONS' });
    const res = await handler(req);
    expect(res.status).toBe(204);
  });

  it('returns 500 when env vars are missing', async () => {
    vi.stubEnv('JWT_SECRET', '');
    const req = new Request('https://example.com/api/auth/google/callback?code=abc', { method: 'GET' });
    const res = await handler(req);
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('not configured');
  });

  it('returns 400 when OAuth error param is present', async () => {
    const req = new Request(
      'https://example.com/api/auth/google/callback?error=access_denied',
      { method: 'GET' },
    );
    const res = await handler(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('access_denied');
  });

  it('returns 400 when code param is missing', async () => {
    const req = new Request('https://example.com/api/auth/google/callback', { method: 'GET' });
    const res = await handler(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('authorization code');
  });

  it('returns 502 when token exchange fails', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'invalid_grant',
    });

    const req = new Request('https://example.com/api/auth/google/callback?code=bad-code', {
      method: 'GET',
    });
    const res = await handler(req);
    expect(res.status).toBe(502);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('Token exchange failed');
  });

  it('returns 502 when userinfo fetch fails', async () => {
    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => MOCK_TOKENS })
      .mockResolvedValueOnce({ ok: false, status: 401 });

    const req = new Request('https://example.com/api/auth/google/callback?code=valid-code', {
      method: 'GET',
    });
    const res = await handler(req);
    expect(res.status).toBe(502);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('user info');
  });

  it('returns token and user on successful auth', async () => {
    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => MOCK_TOKENS })
      .mockResolvedValueOnce({ ok: true, json: async () => MOCK_USER });

    const req = new Request('https://example.com/api/auth/google/callback?code=valid-code', {
      method: 'GET',
    });
    const res = await handler(req);
    expect(res.status).toBe(200);

    const body = await res.json() as { token: string; user: { email: string; name: string } };
    expect(typeof body.token).toBe('string');
    // JWT format: three base64url segments separated by dots
    expect(body.token.split('.').length).toBe(3);
    expect(body.user.email).toBe(MOCK_USER.email);
    expect(body.user.name).toBe(MOCK_USER.name);
  });

  it('exchanges code using correct token endpoint params', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => MOCK_TOKENS })
      .mockResolvedValueOnce({ ok: true, json: async () => MOCK_USER });
    vi.stubGlobal('fetch', mockFetch);

    const req = new Request('https://example.com/api/auth/google/callback?code=my-auth-code', {
      method: 'GET',
    });
    await handler(req);

    const [tokenUrl, tokenOptions] = mockFetch.mock.calls[0] as [string, RequestInit & { body: string }];
    expect(tokenUrl).toBe('https://oauth2.googleapis.com/token');
    const params = new URLSearchParams(tokenOptions.body);
    expect(params.get('code')).toBe('my-auth-code');
    expect(params.get('grant_type')).toBe('authorization_code');
    expect(params.get('client_id')).toBe('test-client-id.apps.googleusercontent.com');
  });
});
