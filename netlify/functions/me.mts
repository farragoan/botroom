// netlify/functions/me.mts
import type { Config } from '@netlify/functions';
import { requireAuth, AuthError } from './lib/auth.js';
import { getDb } from './lib/db.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  try {
    const userId = await requireAuth(req);
    const db = getDb();

    // Upsert user row — idempotent on repeated calls
    await db.execute({
      sql: `INSERT INTO users (id, email, wallet_balance_paise)
            VALUES (?, '', 50000)
            ON CONFLICT(id) DO NOTHING`,
      args: [userId],
    });

    const result = await db.execute({
      sql: 'SELECT id, email, wallet_balance_paise, created_at FROM users WHERE id = ?',
      args: [userId],
    });

    const user = result.rows[0];
    return new Response(JSON.stringify(user), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    console.error('/api/me error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
};

export const config: Config = { path: '/api/me' };
