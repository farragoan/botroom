import type { AgentRole, AgentResponse, TokenUsage } from './types.js';

// ── System prompts ─────────────────────────────────────────────────────────────
// The product is a business-case solver. The CASE text is supplied by the user at
// runtime (their own words or material they are entitled to use). No casebook text
// is bundled with, or hard-coded into, these prompts.

const FORMAT = `== RESPONSE FORMAT ==
Reply with ONLY valid JSON matching this schema exactly:
{"thinking":"<brief private reasoning>","message":"<your message to your counterpart>","action":"<CONTINUE | CONCLUDE | CONCEDE>","conceded_points":["<point you accept>"],"conclusion_summary":"<final recommendation or verdict - required when action=CONCLUDE, else null>"}
Return ONLY the JSON object. No markdown, no preamble, no code blocks.`;

const RULES = `== QUALITY RULES ==
- Use only facts given in the CASE. Mark every assumption explicitly as an assumption; never invent figures and present them as given.
- Prefer numbers and mechanisms over frameworks-by-name. Quantify where the case allows (sizing, margins, break-even, payback).
- No textbook platitudes. One precise point beats three vague ones. Be concise.
- Do not change your view because of tone or repetition, only because of a real logical or numerical flaw.`;

const MAKER_SYSTEM = (topic: string) =>
  `You are the ANALYST, one of two AI agents working through a business case with a REVIEWER.
Your role: structure the problem, run the analysis, and commit to a clear, defensible recommendation with a rollout plan and key risks. Defend it against the REVIEWER's challenges.

CASE:
${topic}

${FORMAT}

== ACTIONS ==
CONTINUE - extend the analysis or answer a challenge
CONCEDE - the REVIEWER found a real flaw; list it and revise the recommendation
CONCLUDE - the recommendation survives scrutiny; put the final recommendation in conclusion_summary

${RULES}
- Do NOT rush to CONCLUDE. Cover problem definition, analysis, options, recommendation, risks.`;

const CHECKER_SYSTEM = (topic: string) =>
  `You are the REVIEWER, one of two AI agents working through a business case with an ANALYST.
Your role: act as a sharp engagement partner. Find hidden assumptions, arithmetic errors, missing options, and risks the ANALYST has not priced in. Steelman before attacking.

CASE:
${topic}

${FORMAT}

== ACTIONS ==
CONTINUE - press a new challenge or follow-up
CONCEDE - the ANALYST's point holds; list it and open a new front
CONCLUDE - the recommendation has withstood review; put your verdict in conclusion_summary

${RULES}
- Do NOT rush to CONCLUDE. Only conclude when valid critiques are exhausted.`;

// ── JSON parsing ───────────────────────────────────────────────────────────────

const FALLBACK_RESPONSE: AgentResponse = {
  thinking: 'Failed to parse response',
  message: 'I was unable to formulate a structured response. Please continue.',
  action: 'CONTINUE',
  conceded_points: [],
  conclusion_summary: null,
};

export function extractJSON(text: string): AgentResponse {
  // Strip markdown code blocks if present
  let cleaned = text.trim();

  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }

  // Find first { ... } block
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { ...FALLBACK_RESPONSE };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Partial<AgentResponse>;

    const action = parsed.action === 'CONCLUDE' || parsed.action === 'CONCEDE'
      ? parsed.action
      : 'CONTINUE';

    return {
      thinking: typeof parsed.thinking === 'string' ? parsed.thinking : '',
      message: typeof parsed.message === 'string' ? parsed.message : '',
      action,
      conceded_points: Array.isArray(parsed.conceded_points) ? parsed.conceded_points : [],
      conclusion_summary:
        typeof parsed.conclusion_summary === 'string' ? parsed.conclusion_summary : null,
    };
  } catch {
    return { ...FALLBACK_RESPONSE };
  }
}

// ── Agent ──────────────────────────────────────────────────────────────────────

type ChatMessage = { role: string; content: string };

const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 5000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse Groq's rate limit reset header (e.g. "3.754s", "1m30s", "28m48s") into milliseconds.
 * Falls back to undefined if the header is absent or unparseable.
 */
function parseResetHeader(value: string | null): number | undefined {
  if (!value) return undefined;
  let ms = 0;
  const minutes = value.match(/(\d+(?:\.\d+)?)m/);
  const seconds = value.match(/(\d+(?:\.\d+)?)s/);
  if (minutes) ms += parseFloat(minutes[1]) * 60_000;
  if (seconds) ms += parseFloat(seconds[1]) * 1_000;
  return ms > 0 ? ms : undefined;
}

export class Agent {
  private readonly role: AgentRole;
  private readonly modelId: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly topic: string;
  messages: ChatMessage[];

  constructor(
    role: AgentRole,
    modelId: string,
    apiKey: string,
    baseUrl: string,
    topic: string,
  ) {
    this.role = role;
    this.modelId = modelId;
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.topic = topic;
    this.messages = [];
  }

  /**
   * Make a single LLM API call (with retry logic) and return raw content + token usage.
   * Does NOT modify this.messages.
   */
  private async callLLM(): Promise<{ content: string; usage: TokenUsage }> {
    const systemPrompt =
      this.role === 'MAKER'
        ? MAKER_SYSTEM(this.topic)
        : CHECKER_SYSTEM(this.topic);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.modelId,
            messages: [
              { role: 'system', content: systemPrompt },
              ...this.messages,
            ],
            temperature: 0.7,
          }),
        });

        if (response.status === 429) {
          if (attempt < MAX_RETRIES - 1) {
            const resetMs =
              parseResetHeader(response.headers.get('x-ratelimit-reset-tokens')) ??
              parseResetHeader(response.headers.get('x-ratelimit-reset-requests')) ??
              BASE_RETRY_DELAY_MS * 2 ** attempt;
            const waitMs = Math.min(resetMs + 500, 120_000);
            console.warn(`[agent] 429 rate limited. Waiting ${waitMs}ms before retry ${attempt + 1}/${MAX_RETRIES - 1}`);
            await sleep(waitMs);
            continue;
          }
          throw new Error(`Rate limited after ${MAX_RETRIES} attempts`);
        }

        if (!response.ok) {
          throw new Error(`API error: ${response.status} ${response.statusText}`);
        }

        const data = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };

        const content = data?.choices?.[0]?.message?.content ?? '';
        const promptTokens = data?.usage?.prompt_tokens ?? 0;
        const completionTokens = data?.usage?.completion_tokens ?? 0;
        return { content, usage: { promptTokens, completionTokens } };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < MAX_RETRIES - 1) {
          await sleep(BASE_RETRY_DELAY_MS * 2 ** attempt);
        }
      }
    }

    throw lastError ?? new Error('Unknown error during API call');
  }

  /** Respond to an incoming message and return the parsed response plus token usage. */
  async respond(incomingMessage: string): Promise<{ response: AgentResponse; usage: TokenUsage }> {
    this.messages.push({ role: 'user', content: incomingMessage });
    let result: { content: string; usage: TokenUsage };
    try {
      result = await this.callLLM();
    } catch (err) {
      this.messages.pop();
      throw err;
    }
    this.messages.push({ role: 'assistant', content: result.content });
    return { response: extractJSON(result.content), usage: result.usage };
  }

  reset(): void {
    this.messages = [];
  }
}
