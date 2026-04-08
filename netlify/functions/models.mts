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

/** Friendly display names for known Groq models */
export const GROQ_DISPLAY_NAMES: Record<string, string> = {
  'compound-beta-mini': 'Compound Mini',
  'compound-beta': 'Compound Beta',
  'llama-4-maverick-17b-128e-instruct': 'LLaMA 4 Maverick (GPT OSS)',
  'llama-4-scout-17b-16e-instruct': 'LLaMA 4 Scout',
  'llama-3.3-70b-versatile': 'LLaMA 3.3 70B',
  'llama-3.1-8b-instant': 'LLaMA 3.1 8B (Fast)',
  'deepseek-r1-distill-llama-70b': 'DeepSeek R1 70B',
  'qwen-qwq-32b': 'Qwen QWQ 32B',
  'gemma2-9b-it': 'Gemma 2 9B',
  'mistral-saba-24b': 'Mistral Saba 24B',
  'llama3-70b-8192': 'LLaMA 3 70B',
  'llama3-8b-8192': 'LLaMA 3 8B',
  'mixtral-8x7b-32768': 'Mixtral 8x7B',
};

/**
 * Preferred ordering — models listed here appear first in the UI.
 * compound-beta-mini → default MAKER, llama-4-maverick → default CHECKER.
 */
export const PREFERRED_ORDER = [
  'compound-beta-mini',
  'llama-4-maverick-17b-128e-instruct',
  'llama-4-scout-17b-16e-instruct',
  'llama-3.3-70b-versatile',
  'compound-beta',
  'deepseek-r1-distill-llama-70b',
  'qwen-qwq-32b',
  'gemma2-9b-it',
  'mistral-saba-24b',
  'llama-3.1-8b-instant',
];

export function sortGroqModels(models: ModelInfo[]): ModelInfo[] {
  return [...models].sort((a, b) => {
    const ai = PREFERRED_ORDER.indexOf(a.id);
    const bi = PREFERRED_ORDER.indexOf(b.id);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.name.localeCompare(b.name);
  });
}

async function fetchGroqModels(apiKey: string): Promise<ModelInfo[]> {
  const res = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const errorBody = await res.text();
    console.error(`[models] Groq error ${res.status}:`, errorBody);
    return [];
  }
  const data = (await res.json()) as { data?: Array<{ id: string }> };
  const models: ModelInfo[] = (data.data ?? []).map((m) => ({
    id: m.id,
    name: GROQ_DISPLAY_NAMES[m.id] ?? m.id,
    provider: 'groq',
  }));
  return sortGroqModels(models);
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
  const enableOpenRouter = process.env.ENABLE_OPENROUTER === 'true';
  const enableGroq = process.env.ENABLE_GROQ !== 'false';

  const [groqModels, openRouterModels] = await Promise.allSettled([
    enableGroq ? fetchGroqModels(groqApiKey) : Promise.resolve([] as ModelInfo[]),
    enableOpenRouter ? fetchOpenRouterFreeModels() : Promise.resolve([] as ModelInfo[]),
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
