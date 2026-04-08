// src/lib/auth.ts
import { useAuth } from '@clerk/react';

/** Call inside async functions to get the Bearer token for Netlify Function calls */
export async function getAuthHeader(
  getToken: ReturnType<typeof useAuth>['getToken']
): Promise<{ Authorization: string }> {
  const token = await getToken();
  if (!token) throw new Error('Not authenticated');
  return { Authorization: `Bearer ${token}` };
}
