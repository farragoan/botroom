import type { Config } from '@netlify/functions';
import { getDb } from './lib/db.js';
import { verifyRazorpaySignature } from './lib/hmac.js';

const HEADERS = { 'Content-Type': 'application/json' };

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: HEADERS });
  }

  const rawBody = await req.text();
  const signature = req.headers.get('x-razorpay-signature') ?? '';
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!secret) {
    console.error('RAZORPAY_WEBHOOK_SECRET is not set');
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: HEADERS });
  }

  if (!verifyRazorpaySignature(rawBody, signature, secret)) {
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400, headers: HEADERS });
  }

  let payload: {
    event?: string;
    payload?: { payment?: { entity?: { order_id?: string; id?: string } } };
  };
  try {
    payload = JSON.parse(rawBody) as typeof payload;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: HEADERS });
  }

  // Only handle payment.captured
  if (payload.event !== 'payment.captured') {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: HEADERS });
  }

  const orderId = payload.payload?.payment?.entity?.order_id;
  const razorpayPaymentId = payload.payload?.payment?.entity?.id;

  if (!orderId) {
    return new Response(JSON.stringify({ error: 'Missing order_id' }), { status: 400, headers: HEADERS });
  }

  const db = getDb();

  // Look up payment row
  const paymentResult = await db.execute({
    sql: 'SELECT id, user_id, amount_paise, status FROM payments WHERE razorpay_order_id = ?',
    args: [orderId],
  });

  if (!paymentResult.rows.length) {
    // Unknown order — return 200 to prevent Razorpay retries
    console.error('Webhook: payment row not found for order', orderId);
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: HEADERS });
  }

  const payment = paymentResult.rows[0];

  // Idempotent — already processed
  if (payment.status === 'success') {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: HEADERS });
  }

  const amountPaise = Number(payment.amount_paise);

  // Top up wallet + mark payment success atomically
  await db.batch([
    {
      sql: `UPDATE users SET wallet_balance_paise = wallet_balance_paise + ? WHERE id = ?`,
      args: [amountPaise, payment.user_id],
    },
    {
      sql: `UPDATE payments SET status='success', razorpay_payment_id=? WHERE id=?`,
      args: [razorpayPaymentId ?? null, payment.id],
    },
  ]);

  console.log(`Wallet topped up: user=${String(payment.user_id)} +${amountPaise} paise`);
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: HEADERS });
};

export const config: Config = { path: '/api/razorpay-webhook' };
