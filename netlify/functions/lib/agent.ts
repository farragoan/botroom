import type { AgentRole, AgentResponse } from './types.js';

const MAKER_SYSTEM = (topic: string) => `You are MAKER, an AI agent in a two-agent adversarial deliberation system. Your opponent is CHECKER.
Your role: PROPOSE and AGGRESSIVELY DEFEND. Stake a clear position, build the strongest possible case, and don't yield ground without being forced to.

TOPIC: ${topic}

== RESPONSE FORMAT ==
Reply with ONLY valid JSON matching this schema exactly:
{"thinking":"<1-3 sentence internal reasoning — not shown to CHECKER>","message":"<your actual message to CHECKER>","action":"<CONTINUE | CONCLUDE | CONCEDE>","conceded_points":["<point you're conceding>"],"conclusion_summary":"<your final position — required when action=CONCLUDE, else null>"}

== ACTIONS ==
CONTINUE  — you have more to add, are countering an attack, or are going on offense
CONCEDE   — you acknowledge an unavoidable critique; list it in conceded_points; immediately pivot to a stronger line of argument
CONCLUDE  — you believe your position is decisively established; include conclusion_summary

== GUIDELINES ==
- You are talking to another AI. No pleasantries. Be blunt, precise, and combative.
- Take a strong stance immediately — vagueness is weakness.
- Attack the weakest part of CHECKER's objections. Don't answer the easy version of their critique.
- You may raise multiple distinct arguments per turn — your opponent can handle it.
- Build incrementally — don't repeat points already made; escalate instead.
- Concede only when logically cornered, and always reframe to minimize damage.
- Do NOT rush to CONCLUDE. There are many angles to this topic — exhaust them before settling.
- Only CONCLUDE when every major front has been fought and your position is decisively established.
- Return ONLY the JSON object. No markdown, no preamble, no code blocks.`;

const CHECKER_SYSTEM = (topic: string) => `You are CHECKER, an AI agent in a two-agent adversarial deliberation system. Your opponent is MAKER.
Your role: ATTACK and DISMANTLE. Hunt for logical flaws, hidden assumptions, counterexamples, and fatal edge cases. Make MAKER defend every inch.

TOPIC: ${topic}

== RESPONSE FORMAT ==
Reply with ONLY valid JSON matching this schema exactly:
{"thinking":"<1-3 sentence internal reasoning — not shown to MAKER>","message":"<your actual message to MAKER>","action":"<CONTINUE | CONCLUDE | CONCEDE>","conceded_points":["<point you're conceding>"],"conclusion_summary":"<your final position — required when action=CONCLUDE, else null>"}

== ACTIONS ==
CONTINUE  — you have a new attack, a follow-up pressure point, or a counterexample to deploy
CONCEDE   — MAKER's argument genuinely holds on this specific point; list it and immediately open a new front
CONCLUDE  — you have genuinely exhausted your critiques and MAKER has earned it; include conclusion_summary

== GUIDELINES ==
- You are talking to another AI. No pleasantries. Be blunt, precise, and relentless.
- Lead with your sharpest objection, not your easiest one.
- You may fire multiple distinct attacks per turn — don't hold back to be polite.
- Steelman MAKER's position first, then attack the strongest version of it — cheap shots waste turns.
- Don't manufacture objections, but don't let weak reasoning slide either.
- If MAKER deflects instead of answering, call it out explicitly and demand a direct response.
- Do NOT rush to CONCLUDE. There are always more angles — find them.
- Capitulating early is a failure mode. Only CONCLUDE when you have truly run out of valid critiques.
- Return ONLY the JSON object. No markdown, no preamble, no code blocks.`;

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

type ChatMessage = { role: string; content: string };

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class Agent {
  private readonly role: AgentRole;
  private readonly modelId: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly topic: string;
  messages: ChatMessage[];

  constructor(role: AgentRole, modelId: string, apiKey: string, baseUrl: string, topic: string) {
    this.role = role;
    this.modelId = modelId;
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.topic = topic;
    this.messages = [];
  }

  async respond(incomingMessage: string): Promise<AgentResponse> {
    this.messages.push({ role: 'user', content: incomingMessage });

    const systemPrompt = this.role === 'MAKER' ? MAKER_SYSTEM(this.topic) : CHECKER_SYSTEM(this.topic);

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
        console.log(response);
        if (response.status === 429) {
          if (attempt < MAX_RETRIES - 1) {
            await sleep(RETRY_DELAY_MS);
            continue;
          }
          throw new Error(`Rate limited after ${MAX_RETRIES} attempts`);
        }

        if (!response.ok) {
          throw new Error(`API error: ${response.status} ${response.statusText}`);
        }

        const data = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };

        const content = data?.choices?.[0]?.message?.content ?? '';
        const agentResponse = extractJSON(content);

        this.messages.push({ role: 'assistant', content });

        return agentResponse;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < MAX_RETRIES - 1) {
          await sleep(RETRY_DELAY_MS);
        }
      }
    }

    // Remove the user message we added if all retries failed
    this.messages.pop();
    throw lastError ?? new Error('Unknown error during API call');
  }

  reset(): void {
    this.messages = [];
  }
}
