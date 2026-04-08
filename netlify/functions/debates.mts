// netlify/functions/debates.mts
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
    const result = await db.execute({
      sql: `SELECT id, topic, maker_model, checker_model, status, total_tokens, total_cost_paise, created_at
            FROM debates WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
      args: [userId],
    });
    return new Response(JSON.stringify(result.rows), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    if (err instanceof AuthError)
      return new Response(JSON.stringify({ error: err.message }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } });
    console.error('/api/debates error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
};

export const config: Config = { path: '/api/debates' };
