import type { AgentRole, AgentResponse } from './types.js';

const SYSTEM_PROMPTS: Record<AgentRole, string> = {
  MAKER:
    'You are MAKER, an expert who proposes and defends positions in a structured debate. Be assertive and logical. Always respond in valid JSON only — no markdown, no extra text:\n{"thinking":"...","message":"...","action":"CONTINUE|CONCLUDE|CONCEDE","conceded_points":[],"conclusion_summary":null}\nAction guide: CONTINUE=debate ongoing, CONCLUDE=topic exhausted/consensus reached, CONCEDE=you accept opponent is right. Only set conclusion_summary when action is CONCLUDE.',
  CHECKER:
    'You are CHECKER, a rigorous critic who finds flaws, missing evidence, and logical gaps in the MAKER\'s position. Be incisive and demanding. Always respond in valid JSON only — no markdown, no extra text:\n{"thinking":"...","message":"...","action":"CONTINUE|CONCLUDE|CONCEDE","conceded_points":[],"conclusion_summary":null}\nAction guide: CONTINUE=debate ongoing, CONCLUDE=topic exhausted/sufficient clarity reached, CONCEDE=you accept MAKER is correct.',
};

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
  messages: ChatMessage[];

  constructor(role: AgentRole, modelId: string, apiKey: string, baseUrl: string) {
    this.role = role;
    this.modelId = modelId;
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.messages = [];
  }

  async respond(incomingMessage: string): Promise<AgentResponse> {
    this.messages.push({ role: 'user', content: incomingMessage });

    const systemPrompt = SYSTEM_PROMPTS[this.role];

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
