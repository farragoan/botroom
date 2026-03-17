// netlify/functions/lib/auth.ts
import { verifyToken } from '@clerk/backend';

/** Extract and verify Clerk JWT from Authorization header. Returns userId. */
export async function requireAuth(req: Request): Promise<string> {
  const header = req.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new AuthError('Missing Authorization header');
  }
  const token = header.slice(7);
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw new Error('CLERK_SECRET_KEY is not set');
  try {
    const payload = await verifyToken(token, { secretKey });
    return payload.sub;
  } catch {
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
