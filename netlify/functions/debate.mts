import type { Config } from '@netlify/functions';
import { runDebate } from './lib/orchestrator.js';
import type { DebateConfig } from './lib/types.js';
import { requireAuth, AuthError } from './lib/auth.js';
import { getDb } from './lib/db.js';
import { v4 as uuidv4 } from 'uuid';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

// Billing is permanently off in this build (Razorpay removed). Kept as an explicit flag so
// nothing downstream accidentally re-enables metering.
const BILLING_ENABLED = false as boolean;

export default async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // Auth
  let userId: string;
  try {
    userId = await requireAuth(req);
  } catch (err) {
    if (err instanceof AuthError) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
    throw err;
  }

  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    return new Response(JSON.stringify({ error: 'GROQ_API_KEY is not configured' }), {
      status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  let body: {
    topic?: string;
    makerModel?: string;
    checkerModel?: string;
    maxTurns?: number;
    verbose?: boolean;
    allowClarification?: boolean;
    minTurnsBeforeConclusion?: number;
  };

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const {
    topic,
    makerModel = 'llama-3.3-70b-versatile',
    checkerModel = 'llama-3.3-70b-versatile',
    maxTurns = 8,
    verbose = false,
    allowClarification = false,
    minTurnsBeforeConclusion,
  } = body;

  if (!topic?.trim()) {
    return new Response(JSON.stringify({ error: 'topic is required' }), {
      status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const db = getDb();
  if (BILLING_ENABLED) throw new Error('Billing is not supported in this build');

  // Ensure the user row exists (debates.user_id references users.id)
  await db.execute({
    sql: `INSERT INTO users (id, email) VALUES (?, '') ON CONFLICT(id) DO NOTHING`,
    args: [userId],
  });

  const enableOpenRouter = process.env.ENABLE_OPENROUTER === 'true';
  const openRouterApiKey = enableOpenRouter ? process.env.OPENROUTER_API_KEY : undefined;

  const config: DebateConfig = {
    topic: topic.trim(),
    makerModel,
    checkerModel,
    maxTurns: Math.max(1, Math.min(Number(maxTurns) || 8, 30)),
    verbose: Boolean(verbose),
    allowClarification: Boolean(allowClarification),
    minTurnsBeforeConclusion: minTurnsBeforeConclusion !== undefined
      ? Math.max(0, Number(minTurnsBeforeConclusion) || 0)
      : undefined,
  };

  // Create debate row
  const debateId = uuidv4();
  await db.execute({
    sql: `INSERT INTO debates (id, user_id, topic, maker_model, checker_model, status) VALUES (?, ?, ?, ?, ?, 'running')`,
    args: [debateId, userId, config.topic, config.makerModel, config.checkerModel],
  });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const enqueue = (chunk: string) => controller.enqueue(encoder.encode(chunk));

      let totalTokens = 0;

      try {
        for await (const event of runDebate(config, groqApiKey, openRouterApiKey)) {
          if (event.type === 'turn') {
            enqueue(sseMessage('turn', event.data));

            const turn = event.data;
            const usage = turn.tokenUsage ?? { promptTokens: 0, completionTokens: 0 };
            const turnId = uuidv4();

            await db.execute({
              sql: `INSERT INTO turns (id, debate_id, turn_number, agent, content, prompt_tokens, completion_tokens, cost_paise) VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
              args: [turnId, debateId, turn.turnNumber, turn.agent, JSON.stringify(turn.response), usage.promptTokens, usage.completionTokens],
            });

            totalTokens += usage.promptTokens + usage.completionTokens;

          } else if (event.type === 'synthesis') {
            enqueue(sseMessage('synthesis', event.data));

            await db.execute({
              sql: `UPDATE debates SET status='completed', synthesis=?, concluded_naturally=?, total_tokens=?, total_cost_paise=0 WHERE id=?`,
              args: [event.data.synthesis, event.data.concludedNaturally ? 1 : 0, totalTokens, debateId],
            });

          } else if (event.type === 'error') {
            enqueue(sseMessage('error', event.data));
            await db.execute({
              sql: `UPDATE debates SET status='failed' WHERE id=?`,
              args: [debateId],
            });
          }
        }

        enqueue(sseMessage('done', { debateId }));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        enqueue(sseMessage('error', { message }));
        enqueue(sseMessage('done', { debateId }));
        await db.execute({ sql: `UPDATE debates SET status='failed' WHERE id=?`, args: [debateId] }).catch(() => {});
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
};

export const config: Config = { path: '/api/debate' };
