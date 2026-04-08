import type { Config } from '@netlify/functions';
import { runDebate } from './lib/orchestrator.js';
import type { DebateConfig } from './lib/types.js';
import { requireAuth, AuthError } from './lib/auth.js';
import { getDb } from './lib/db.js';
import { calculateCostPaise, OVERDRAFT_LIMIT_PAISE } from './lib/pricing.js';
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
    enableWebSearch?: boolean;
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
    enableWebSearch = false,
  } = body;

  if (!topic?.trim()) {
    return new Response(JSON.stringify({ error: 'topic is required' }), {
      status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const db = getDb();

  // Upsert user (in case /api/me was never called)
  await db.execute({
    sql: `INSERT INTO users (id, email, wallet_balance_paise) VALUES (?, '', 50000) ON CONFLICT(id) DO NOTHING`,
    args: [userId],
  });

  // Check overdraft limit
  const userRow = await db.execute({
    sql: 'SELECT wallet_balance_paise FROM users WHERE id = ?',
    args: [userId],
  });
  const balance = Number(userRow.rows[0]?.wallet_balance_paise ?? 0);
  if (balance <= OVERDRAFT_LIMIT_PAISE) {
    return new Response(JSON.stringify({ error: 'Insufficient balance. Please top up your wallet.' }), {
      status: 402, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const enableOpenRouter = process.env.ENABLE_OPENROUTER === 'true';
  const openRouterApiKey = enableOpenRouter ? process.env.OPENROUTER_API_KEY : undefined;
  const tavilyApiKey = process.env.TAVILY_API_KEY;

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
    enableWebSearch: Boolean(enableWebSearch),
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
      let totalCostPaise = 0;

      try {
        for await (const event of runDebate(config, groqApiKey, openRouterApiKey, tavilyApiKey)) {
          if (event.type === 'turn') {
            enqueue(sseMessage('turn', event.data));

            const turn = event.data;
            const usage = turn.tokenUsage ?? { promptTokens: 0, completionTokens: 0 };
            const modelId = turn.agent === 'MAKER' ? config.makerModel : config.checkerModel;
            const costPaise = calculateCostPaise(modelId, usage.promptTokens, usage.completionTokens);
            const turnId = uuidv4();

            await db.execute({
              sql: `INSERT INTO turns (id, debate_id, turn_number, agent, content, prompt_tokens, completion_tokens, cost_paise) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              args: [turnId, debateId, turn.turnNumber, turn.agent, JSON.stringify(turn.response), usage.promptTokens, usage.completionTokens, costPaise],
            });

            // Atomic deduction
            const deductResult = await db.execute({
              sql: `UPDATE users SET wallet_balance_paise = wallet_balance_paise - ? WHERE id = ? RETURNING wallet_balance_paise`,
              args: [costPaise, userId],
            });
            const balanceAfter = Number(deductResult.rows[0]?.wallet_balance_paise ?? 0);

            await db.execute({
              sql: `INSERT INTO usage_events (id, user_id, debate_id, turn_id, tokens_used, cost_paise, balance_after_paise) VALUES (?, ?, ?, ?, ?, ?, ?)`,
              args: [uuidv4(), userId, debateId, turnId, usage.promptTokens + usage.completionTokens, costPaise, balanceAfter],
            });

            totalTokens += usage.promptTokens + usage.completionTokens;
            totalCostPaise += costPaise;

            // Stop the stream if overdraft limit exceeded
            if (balanceAfter <= OVERDRAFT_LIMIT_PAISE) {
              enqueue(sseMessage('error', { message: 'Wallet balance exhausted. Please top up to continue.' }));
              enqueue(sseMessage('done', { debateId }));
              await db.execute({ sql: `UPDATE debates SET status='failed' WHERE id=?`, args: [debateId] });
              return; // exits the ReadableStream start() function, closing the stream
            }

          } else if (event.type === 'synthesis') {
            enqueue(sseMessage('synthesis', event.data));

            await db.execute({
              sql: `UPDATE debates SET status='completed', synthesis=?, concluded_naturally=?, total_tokens=?, total_cost_paise=? WHERE id=?`,
              args: [event.data.synthesis, event.data.concludedNaturally ? 1 : 0, totalTokens, totalCostPaise, debateId],
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
