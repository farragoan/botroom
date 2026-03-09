import type { Config } from '@netlify/functions';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const MODELS = {
  groq: [
    { id: 'llama-70b', name: 'Llama 3.3 70B', provider: 'groq', default: true },
    { id: 'llama-8b', name: 'Llama 3.1 8B', provider: 'groq' },
    { id: 'llama4-maverick', name: 'Llama 4 Maverick 17B', provider: 'groq' },
    { id: 'qwen3-32b', name: 'Qwen QwQ 32B', provider: 'groq' },
    { id: 'kimi-k2', name: 'Kimi K2', provider: 'groq' },
  ],
};

export default async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(MODELS), {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};

export const config: Config = {
  path: '/api/models',
};
