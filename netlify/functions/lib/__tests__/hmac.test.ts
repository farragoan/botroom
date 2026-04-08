import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { verifyRazorpaySignature } from '../hmac.js';

describe('verifyRazorpaySignature', () => {
  const secret = 'test_secret';
  const body = '{"event":"payment.captured"}';

  it('returns true for valid signature', () => {
    const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
    expect(verifyRazorpaySignature(body, sig, secret)).toBe(true);
  });

  it('returns false for wrong signature', () => {
    expect(verifyRazorpaySignature(body, 'badsig', secret)).toBe(false);
  });

  it('returns false for empty signature', () => {
    expect(verifyRazorpaySignature(body, '', secret)).toBe(false);
  });
});
