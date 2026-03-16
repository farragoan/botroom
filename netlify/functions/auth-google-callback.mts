import type { Config } from '@netlify/functions';
import { createHmac } from 'node:crypto';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function base64url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function createSessionJWT(
  payload: Record<string, unknown>,
  secret: string,
  expiresInSeconds = 7 * 24 * 3600,
): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const claims = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  };
  const body = base64url(JSON.stringify(claims));
  const signature = base64url(
    createHmac('sha256', secret).update(`${header}.${body}`).digest(),
  );
  return `${header}.${body}.${signature}`;
}

interface GoogleTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
}

export default async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  const jwtSecret = process.env.JWT_SECRET;

  if (!clientId || !clientSecret || !redirectUri || !jwtSecret) {
    return new Response(JSON.stringify({ error: 'Google OAuth is not configured' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const oauthError = url.searchParams.get('error');

  if (oauthError) {
    return new Response(
      JSON.stringify({ error: `Google OAuth error: ${oauthError}` }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  if (!code) {
    return new Response(
      JSON.stringify({ error: 'Missing authorization code' }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  // Exchange authorization code for access tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    const detail = await tokenRes.text();
    return new Response(
      JSON.stringify({ error: 'Token exchange failed', detail }),
      { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  const tokens = (await tokenRes.json()) as GoogleTokenResponse;

  // Fetch the user's profile from Google
  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!userRes.ok) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch user info from Google' }),
      { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  const user = (await userRes.json()) as GoogleUserInfo;

  // Issue a signed session JWT (HS256, expires in 7 days)
  const sessionToken = createSessionJWT(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      email_verified: user.verified_email,
    },
    jwtSecret,
  );

  return new Response(
    JSON.stringify({
      token: sessionToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        email_verified: user.verified_email,
      },
    }),
    { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
  );
};

export const config: Config = {
  path: '/api/auth/google/callback',
};
