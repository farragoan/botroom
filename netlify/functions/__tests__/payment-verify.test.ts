import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';
import handler from '../payment-verify.mts';

const KEY_SECRET = 'test-razorpay-key-secret';

function makeValidSignature(orderId: string, paymentId: string): string {
  return createHmac('sha256', KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
}

describe('payment-verify', () => {
  beforeEach(() => {
    vi.stubEnv('RAZORPAY_KEY_SECRET', KEY_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 204 on OPTIONS preflight', async () => {
    const req = new Request('https://example.com/api/payment/verify', { method: 'OPTIONS' });
    const res = await handler(req);
    expect(res.status).toBe(204);
  });

  it('returns 405 for non-POST methods', async () => {
    const req = new Request('https://example.com/api/payment/verify', { method: 'GET' });
    const res = await handler(req);
    expect(res.status).toBe(405);
  });

  it('returns 500 when RAZORPAY_KEY_SECRET is missing', async () => {
    vi.stubEnv('RAZORPAY_KEY_SECRET', '');
    const req = new Request('https://example.com/api/payment/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpay_order_id: 'order_123',
        razorpay_payment_id: 'pay_456',
        razorpay_signature: 'sig',
      }),
    });
    const res = await handler(req);
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('not configured');
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('https://example.com/api/payment/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    const res = await handler(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when required fields are missing', async () => {
    const req = new Request('https://example.com/api/payment/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ razorpay_order_id: 'order_123' }),
    });
    const res = await handler(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('required');
  });

  it('returns 400 when signature is invalid', async () => {
    const req = new Request('https://example.com/api/payment/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpay_order_id: 'order_123',
        razorpay_payment_id: 'pay_456',
        razorpay_signature: 'invalid-signature',
      }),
    });
    const res = await handler(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { success: boolean; error: string };
    expect(body.success).toBe(false);
    expect(body.error).toContain('verification failed');
  });

  it('returns 200 with success:true for a valid signature', async () => {
    const orderId = 'order_TestOrder123';
    const paymentId = 'pay_TestPayment456';
    const validSig = makeValidSignature(orderId, paymentId);

    const req = new Request('https://example.com/api/payment/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: validSig,
      }),
    });
    const res = await handler(req);
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; message: string };
    expect(body.success).toBe(true);
    expect(body.message).toContain('verified');
  });

  it('rejects a signature computed with a different secret', async () => {
    const orderId = 'order_ABC';
    const paymentId = 'pay_XYZ';
    const wrongSig = createHmac('sha256', 'wrong-secret')
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const req = new Request('https://example.com/api/payment/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: wrongSig,
      }),
    });
    const res = await handler(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(false);
  });
});
