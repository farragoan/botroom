import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from '../payment-create-order.mts';

const MOCK_RAZORPAY_ORDER = {
  id: 'order_TestABC123',
  entity: 'order',
  amount: 50000,
  amount_paid: 0,
  amount_due: 50000,
  currency: 'INR',
  receipt: 'rcpt_test',
  status: 'created',
  attempts: 0,
  created_at: 1700000000,
};

describe('payment-create-order', () => {
  beforeEach(() => {
    vi.stubEnv('RAZORPAY_KEY_ID', 'rzp_test_testKeyId');
    vi.stubEnv('RAZORPAY_KEY_SECRET', 'testKeySecret');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('returns 204 on OPTIONS preflight', async () => {
    const req = new Request('https://example.com/api/payment/create-order', { method: 'OPTIONS' });
    const res = await handler(req);
    expect(res.status).toBe(204);
  });

  it('returns 405 for non-POST methods', async () => {
    const req = new Request('https://example.com/api/payment/create-order', { method: 'GET' });
    const res = await handler(req);
    expect(res.status).toBe(405);
  });

  it('returns 500 when Razorpay keys are missing', async () => {
    vi.stubEnv('RAZORPAY_KEY_ID', '');
    const req = new Request('https://example.com/api/payment/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 50000 }),
    });
    const res = await handler(req);
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('not configured');
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('https://example.com/api/payment/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    const res = await handler(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when amount is missing', async () => {
    const req = new Request('https://example.com/api/payment/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currency: 'INR' }),
    });
    const res = await handler(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('amount');
  });

  it('returns 400 when amount is zero or negative', async () => {
    const req = new Request('https://example.com/api/payment/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: -100 }),
    });
    const res = await handler(req);
    expect(res.status).toBe(400);
  });

  it('calls Razorpay API with Basic Auth and correct body', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_RAZORPAY_ORDER,
    });
    vi.stubGlobal('fetch', mockFetch);

    const req = new Request('https://example.com/api/payment/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 50000, currency: 'INR', receipt: 'rcpt_test' }),
    });
    const res = await handler(req);
    expect(res.status).toBe(200);

    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit & { body: string }];
    expect(url).toBe('https://api.razorpay.com/v1/orders');
    const authHeader = (options.headers as Record<string, string>)['Authorization'];
    expect(authHeader).toMatch(/^Basic /);

    // Decode Basic Auth credentials
    const credentials = atob(authHeader.replace('Basic ', ''));
    expect(credentials).toBe('rzp_test_testKeyId:testKeySecret');

    const reqBody = JSON.parse(options.body);
    expect(reqBody.amount).toBe(50000);
    expect(reqBody.currency).toBe('INR');
  });

  it('returns the Razorpay order on success', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_RAZORPAY_ORDER,
    });

    const req = new Request('https://example.com/api/payment/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 50000 }),
    });
    const res = await handler(req);
    expect(res.status).toBe(200);

    const order = await res.json() as typeof MOCK_RAZORPAY_ORDER;
    expect(order.id).toBe('order_TestABC123');
    expect(order.amount).toBe(50000);
    expect(order.status).toBe('created');
  });

  it('forwards Razorpay error status on failure', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: { description: 'Bad request' } }),
    });

    const req = new Request('https://example.com/api/payment/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 50000 }),
    });
    const res = await handler(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('Failed to create Razorpay order');
  });

  it('auto-generates receipt when not provided', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_RAZORPAY_ORDER,
    });
    vi.stubGlobal('fetch', mockFetch);

    const req = new Request('https://example.com/api/payment/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 10000 }),
    });
    await handler(req);

    const reqBody = JSON.parse((mockFetch.mock.calls[0] as [string, RequestInit & { body: string }])[1].body);
    expect(reqBody.receipt).toMatch(/^rcpt_\d+$/);
  });
});
