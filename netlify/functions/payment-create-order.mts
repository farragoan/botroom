import type { Config } from '@netlify/functions';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface CreateOrderBody {
  amount?: number;
  currency?: string;
  receipt?: string;
  notes?: Record<string, string>;
}

interface RazorpayOrder {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  attempts: number;
  created_at: number;
}

export default async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return new Response(JSON.stringify({ error: 'Razorpay is not configured' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  let body: CreateOrderBody;
  try {
    body = (await req.json()) as CreateOrderBody;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const { amount, currency = 'INR', receipt, notes } = body;

  // amount must be a positive integer in the smallest currency unit (paise for INR)
  if (amount === undefined || typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return new Response(
      JSON.stringify({
        error: 'amount is required and must be a positive number in the smallest currency unit (e.g. paise for INR)',
      }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

  const razorpayRes = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${credentials}`,
    },
    body: JSON.stringify({
      amount: Math.round(amount), // must be an integer
      currency,
      receipt: receipt ?? `rcpt_${Date.now()}`,
      ...(notes && { notes }),
    }),
  });

  if (!razorpayRes.ok) {
    const detail = await razorpayRes.json().catch(() => ({ message: 'Unknown error' }));
    return new Response(
      JSON.stringify({ error: 'Failed to create Razorpay order', detail }),
      { status: razorpayRes.status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  const order = (await razorpayRes.json()) as RazorpayOrder;

  return new Response(JSON.stringify(order), {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
};

export const config: Config = {
  path: '/api/payment/create-order',
};
