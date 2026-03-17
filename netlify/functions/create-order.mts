// netlify/functions/create-order.mts
import type { Config } from '@netlify/functions';
import Razorpay from 'razorpay';
import { requireAuth, AuthError } from './lib/auth.js';
import { getDb } from './lib/db.js';
import { getPackOrThrow } from './lib/packs.js';
import { v4 as uuidv4 } from 'uuid';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  try {
    const userId = await requireAuth(req);
    const body = (await req.json()) as { pack?: string };

    if (!body.pack) {
      return new Response(JSON.stringify({ error: 'pack is required' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const packDef = getPackOrThrow(body.pack);

    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!razorpayKeyId || !razorpayKeySecret) {
      console.error('RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not set');
      return new Response(JSON.stringify({ error: 'Payment service not configured' }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const razorpay = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret,
    });

    const order = await razorpay.orders.create({
      amount: packDef.amount_paise,
      currency: 'INR',
      receipt: uuidv4(),
    });

    const db = getDb();
    await db.execute({
      sql: `INSERT INTO payments (id, user_id, razorpay_order_id, amount_paise, status) VALUES (?, ?, ?, ?, 'pending')`,
      args: [uuidv4(), userId, order.id, packDef.amount_paise],
    });

    return new Response(JSON.stringify({ order_id: order.id, amount: packDef.amount_paise, currency: 'INR' }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    if (err instanceof AuthError)
      return new Response(JSON.stringify({ error: err.message }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } });
    console.error('/api/create-order error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
};

export const config: Config = { path: '/api/create-order' };
