// netlify/functions/lib/auth.ts
import { verifyToken } from '@clerk/backend';

let _secretKey: string | null = null;

function getSecretKey(): string {
  if (!_secretKey) {
    const key = process.env.CLERK_SECRET_KEY;
    if (!key) throw new Error('CLERK_SECRET_KEY is not set');
    _secretKey = key;
  }
  return _secretKey;
}

/** Extract and verify Clerk JWT from Authorization header. Returns userId. */
export async function requireAuth(req: Request): Promise<string> {
  const header = req.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new AuthError('Missing Authorization header');
  }
  const token = header.slice(7);
  try {
    const payload = await verifyToken(token, { secretKey: getSecretKey() });
    return payload.sub;
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw new AuthError('Invalid or expired token');
  }
}

export class AuthError extends Error {
  readonly status = 401;
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}
