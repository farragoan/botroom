import type { Config } from '@netlify/functions';
import { getClarificationQuestion } from './lib/orchestrator.js';
import type { DebateConfig } from './lib/types.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    return new Response(JSON.stringify({ error: 'GROQ_API_KEY is not configured' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  let body: { config?: Partial<DebateConfig> };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const cfg = body.config;
  if (!cfg?.topic || typeof cfg.topic !== 'string' || cfg.topic.trim() === '') {
    return new Response(JSON.stringify({ error: 'config.topic is required' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const enableOpenRouter = process.env.ENABLE_OPENROUTER === 'true';
  const openRouterApiKey = enableOpenRouter ? process.env.OPENROUTER_API_KEY : undefined;

  const config: DebateConfig = {
    topic: cfg.topic.trim(),
    makerModel: cfg.makerModel ?? 'llama-3.3-70b-versatile',
    checkerModel: cfg.checkerModel ?? 'llama-3.3-70b-versatile',
    maxTurns: cfg.maxTurns ?? 8,
    verbose: cfg.verbose ?? false,
  };

  const question = await getClarificationQuestion(config, groqApiKey, openRouterApiKey);

  return new Response(JSON.stringify({ question }), {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
};

export const config: Config = {
  path: '/api/clarify',
};
