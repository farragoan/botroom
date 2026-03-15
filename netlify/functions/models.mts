import type { Config } from '@netlify/functions';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

interface ModelInfo {
  id: string;
  name: string;
  provider: 'groq' | 'openrouter';
}

async function fetchGroqModels(apiKey: string): Promise<ModelInfo[]> {
  const res = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { data?: Array<{ id: string }> };
  return (data.data ?? []).map((m) => ({
    id: m.id,
    name: m.id,
    provider: 'groq',
  }));
}

async function fetchOpenRouterFreeModels(): Promise<ModelInfo[]> {
  const res = await fetch('https://openrouter.ai/api/v1/models');
  if (!res.ok) return [];
  const data = (await res.json()) as {
    data?: Array<{ id: string; name?: string }>;
  };
  return (data.data ?? [])
    .filter((m) => m.id.endsWith(':free'))
    .map((m) => ({
      id: m.id,
      name: m.name ?? m.id,
      provider: 'openrouter',
    }));
}

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

  const groqApiKey = process.env.GROQ_API_KEY ?? '';

  const [groqModels, openRouterModels] = await Promise.allSettled([
    fetchGroqModels(groqApiKey),
    fetchOpenRouterFreeModels(),
  ]);

  const models = {
    groq: groqModels.status === 'fulfilled' ? groqModels.value : [],
    openrouter: openRouterModels.status === 'fulfilled' ? openRouterModels.value : [],
  };

  return new Response(JSON.stringify(models), {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
    },
  });
};

export const config: Config = {
  path: '/api/models',
};
