// netlify/functions/debate-detail.mts
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
    const url = new URL(req.url);
    const debateId = url.pathname.split('/').pop();

    if (!debateId) {
      return new Response(JSON.stringify({ error: 'Missing debate ID' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const db = getDb();
    const debateResult = await db.execute({
      sql: 'SELECT * FROM debates WHERE id = ? AND user_id = ?',
      args: [debateId, userId],
    });
    if (!debateResult.rows.length) {
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const turnsResult = await db.execute({
      sql: 'SELECT * FROM turns WHERE debate_id = ? ORDER BY turn_number ASC',
      args: [debateId],
    });

    return new Response(JSON.stringify({ debate: debateResult.rows[0], turns: turnsResult.rows }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    if (err instanceof AuthError)
      return new Response(JSON.stringify({ error: err.message }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } });
    console.error('/api/debates/:id error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
};

export const config: Config = { path: '/api/debates/:id' };
