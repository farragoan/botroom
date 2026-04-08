// netlify/functions/lib/db.ts
import { createClient } from '@libsql/client';

let _db: ReturnType<typeof createClient> | null = null;

export function getDb() {
  if (!_db) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url) throw new Error('TURSO_DATABASE_URL is not set');
    _db = createClient({ url, authToken });
  }
  return _db;
}
