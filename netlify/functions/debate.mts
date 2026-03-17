import type { Config } from '@netlify/functions';
import { runDebate } from './lib/orchestrator.js';
import type { DebateConfig } from './lib/types.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
  'Access-Control-Allow-Origin': '*',
};

function sseMessage(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export default async (req: Request): Promise<Response> => {
  // Handle CORS preflight
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

  let body: {
    topic?: string;
    makerModel?: string;
    checkerModel?: string;
    maxTurns?: number;
    verbose?: boolean;
  };

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const { topic, makerModel = 'llama-70b', checkerModel = 'llama-70b', maxTurns = 8, verbose = false } = body;

  if (!topic || typeof topic !== 'string' || topic.trim() === '') {
    return new Response(JSON.stringify({ error: 'topic is required' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const enableOpenRouter = process.env.ENABLE_OPENROUTER === 'true';
  const openRouterApiKey = enableOpenRouter ? process.env.OPENROUTER_API_KEY : undefined;

  const config: DebateConfig = {
    topic: topic.trim(),
    makerModel,
    checkerModel,
    maxTurns: Math.max(1, Math.min(Number(maxTurns) || 8, 30)),
    verbose: Boolean(verbose),
  };

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function enqueue(chunk: string): void {
        controller.enqueue(encoder.encode(chunk));
      }

      try {
        for await (const event of runDebate(config, groqApiKey, openRouterApiKey)) {
          if (event.type === 'turn') {
            enqueue(sseMessage('turn', event.data));
          } else if (event.type === 'synthesis') {
            enqueue(sseMessage('synthesis', event.data));
          } else if (event.type === 'error') {
            enqueue(sseMessage('error', event.data));
          }
        }

        enqueue(sseMessage('done', {}));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        enqueue(sseMessage('error', { message }));
        enqueue(sseMessage('done', {}));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
};

export const config: Config = {
  path: '/api/debate',

};
