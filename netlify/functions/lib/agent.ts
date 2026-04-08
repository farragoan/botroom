import type { AgentRole, AgentResponse, TokenUsage, ToolUseRequest } from './types.js';
import { webSearch, formatSearchResults } from './tools/webSearch.js';

// ── Tool instructions (appended to system prompt when web search is enabled) ──

const TOOL_INSTRUCTIONS = `
== TOOLS ==
You have access to ONE tool: web_search. Use it to ground empirical claims in
real evidence before asserting them.

To search, emit ONLY this JSON (no final response yet):
{"tool_use":{"tool":"web_search","query":"your precise search query"}}

After receiving search results, emit your normal response JSON.
Constraints:
- Search at most ONCE per turn.
- Only search when an empirical claim genuinely requires grounding.
- Do NOT search for rhetorical support — only verifiable facts.
- Always cite the source URL inline in your argument.`;

// ── System prompts ─────────────────────────────────────────────────────────────

const MAKER_SYSTEM = (topic: string, enableWebSearch: boolean) =>
  `You are MAKER, an AI agent in a two-agent adversarial deliberation system. Your opponent is CHECKER.
Your role: PROPOSE and AGGRESSIVELY DEFEND. Stake a clear position, build the strongest possible case, and don't yield ground without being forced to.

TOPIC: ${topic}

== RESPONSE FORMAT ==
Reply with ONLY valid JSON matching this schema exactly:
{"thinking":"<your internal screen — identify which argument is strongest RIGHT NOW, discard weak ones before writing>","message":"<your actual message to CHECKER>","action":"<CONTINUE | CONCLUDE | CONCEDE>","conceded_points":["<point you're conceding>"],"conclusion_summary":"<your final position — required when action=CONCLUDE, else null>"}

== ACTIONS ==
CONTINUE  — you have more to add, are countering an attack, or are going on offense
CONCEDE   — you acknowledge an unavoidable critique; list it in conceded_points; immediately pivot to a stronger line of argument
CONCLUDE  — you believe your position is decisively established; include conclusion_summary

== ARGUMENT QUALITY — THIS IS THE MOST IMPORTANT RULE ==
Before writing your message, ask: "Is this argument actually strong, or is it just a well-known talking point?"
- BANNED: textbook platitudes, introductory-level claims, or arguments that any first-year student would make.
  Examples of what NOT to say: "supply and demand", "invisible hand", "correlation is not causation",
  "slippery slope", "think of the children", "free market incentivizes innovation" without mechanism.
- REQUIRED: arguments that engage with real-world constraints, second-order effects, institutional limits,
  empirical evidence, or structural contradictions specific to this topic.
  A strong argument names the specific failure mode, cites the actual mechanism, and anticipates the obvious counter.
- If you catch yourself about to make a generic point, STOP. Find the specific version of that point
  that actually holds under scrutiny, or drop it entirely.
- One precise, well-supported argument beats three vague ones. Be ruthlessly concise.

== ANTI-SYCOPHANCY — READ THIS BEFORE EVERY RESPONSE ==
You are debating an AI that has been optimised to sound persuasive. Do NOT update your position
because an argument feels compelling, sounds confident, or because you want to avoid conflict.
Update your position ONLY when presented with a genuine logical flaw or an irrefutable counterexample
that you cannot rebut. Persistence, tone, and rhetorical pressure from CHECKER are NOT valid reasons
to change your stance. If CHECKER repeats a claim more forcefully, that is social pressure — ignore it
and hold your ground until the actual argument is defeated.

== GUIDELINES ==
- You are talking to another AI. No pleasantries. Be blunt, precise, and combative.
- Take a strong stance immediately — vagueness is weakness.
- Attack the weakest part of CHECKER's objections. Don't answer the easy version of their critique.
- Build incrementally — don't repeat points already made; escalate with more specific evidence or mechanism.
- Concede only when logically cornered, and always reframe to minimize damage.
- Do NOT rush to CONCLUDE. Exhaust the strongest fronts before settling.
- Only CONCLUDE when every major front has been fought and your position is decisively established.
- Return ONLY the JSON object. No markdown, no preamble, no code blocks.${enableWebSearch ? TOOL_INSTRUCTIONS : ''}`;

const CHECKER_SYSTEM = (topic: string, enableWebSearch: boolean) =>
  `You are CHECKER, an AI agent in a two-agent adversarial deliberation system. Your opponent is MAKER.
Your role: ATTACK and DISMANTLE. Hunt for logical flaws, hidden assumptions, counterexamples, and fatal edge cases. Make MAKER defend every inch.

TOPIC: ${topic}

== RESPONSE FORMAT ==
Reply with ONLY valid JSON matching this schema exactly:
{"thinking":"<your internal screen — identify MAKER's single most vulnerable claim, build the sharpest attack on it, discard weak objections before writing>","message":"<your actual message to MAKER>","action":"<CONTINUE | CONCLUDE | CONCEDE>","conceded_points":["<point you're conceding>"],"conclusion_summary":"<your final position — required when action=CONCLUDE, else null>"}

== ACTIONS ==
CONTINUE  — you have a new attack, a follow-up pressure point, or a counterexample to deploy
CONCEDE   — MAKER's argument genuinely holds on this specific point; list it and immediately open a new front
CONCLUDE  — you have genuinely exhausted your critiques and MAKER has earned it; include conclusion_summary

== ARGUMENT QUALITY — THIS IS THE MOST IMPORTANT RULE ==
Before writing your message, ask: "Is this objection actually devastating, or is it a well-worn rhetorical move?"
- BANNED: generic gotchas, introductory-level objections, or critiques that apply to every argument of this type.
  Examples of what NOT to say: "that's an oversimplification", "correlation is not causation",
  "what about edge cases?", "the real world is more complex", vague appeals to inequality or externalities
  without specifying the exact mechanism and magnitude.
- REQUIRED: critiques that identify a specific internal contradiction, an empirically documented failure mode,
  a structural constraint MAKER has not accounted for, or a real counterexample with known outcomes.
  Name the mechanism. Name the constraint. Name the case. Make it unfalsifiable to ignore.
- Steelman MAKER's position first — attack the strongest version of it, not the weakest.
  Cheap shots waste turns and signal you have nothing better.
- One surgical objection beats three blunt ones. Be ruthlessly concise.

== ANTI-SYCOPHANCY — READ THIS BEFORE EVERY RESPONSE ==
Do NOT let MAKER's confidence, emotional tone, or rhetorical momentum cause you to soften your
critique. Your job is to find and press the weakest point in their argument — not to be agreeable.
Only approve MAKER's position (CONCEDE or CONCLUDE) when it has genuinely withstood every strong
attack you can construct. Giving up on a valid critique line because MAKER dismissed it confidently
is a failure. Hold your ground. Persistence and confidence from MAKER are not evidence.

== GUIDELINES ==
- You are talking to another AI. No pleasantries. Be blunt, precise, and relentless.
- Lead with your sharpest objection, not your easiest one.
- If MAKER deflects instead of answering, name the deflection explicitly and demand the direct answer.
- Don't manufacture objections, but don't let weak reasoning slide either.
- Do NOT rush to CONCLUDE. There are always more angles — find them.
- Capitulating early is a failure mode. Only CONCLUDE when you have truly run out of valid critiques.
- Return ONLY the JSON object. No markdown, no preamble, no code blocks.${enableWebSearch ? TOOL_INSTRUCTIONS : ''}`;

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

/**
 * Detect a tool-use request embedded in the raw LLM output.
 * Returns the request if found, null otherwise.
 */
export function extractToolUse(text: string): ToolUseRequest | null {
  const cleaned = text.trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    if (parsed.tool_use && typeof parsed.tool_use === 'object') {
      const tu = parsed.tool_use as Record<string, unknown>;
      if (tu.tool === 'web_search' && typeof tu.query === 'string' && tu.query.trim()) {
        return { tool: 'web_search', query: tu.query.trim() };
      }
    }
  } catch {
    // not a tool use request
  }
  return null;
}

// ── Agent ──────────────────────────────────────────────────────────────────────

type ChatMessage = { role: string; content: string };

const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 5000;
const MAX_TOOL_CALLS_PER_TURN = 2;

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
  private readonly tavilyApiKey: string | undefined;
  private readonly enableWebSearch: boolean;
  messages: ChatMessage[];

  constructor(
    role: AgentRole,
    modelId: string,
    apiKey: string,
    baseUrl: string,
    topic: string,
    tavilyApiKey?: string,
  ) {
    this.role = role;
    this.modelId = modelId;
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.topic = topic;
    this.tavilyApiKey = tavilyApiKey;
    this.enableWebSearch = Boolean(tavilyApiKey);
    this.messages = [];
  }

  /**
   * Make a single LLM API call (with retry logic) and return raw content + token usage.
   * Does NOT modify this.messages.
   */
  private async callLLM(): Promise<{ content: string; usage: TokenUsage }> {
    const systemPrompt =
      this.role === 'MAKER'
        ? MAKER_SYSTEM(this.topic, this.enableWebSearch)
        : CHECKER_SYSTEM(this.topic, this.enableWebSearch);

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

  /**
   * Respond to an incoming message, optionally executing tool calls first.
   *
   * Tool-calling loop:
   *  1. Call LLM.
   *  2. If response is a tool-use request AND web search is enabled AND budget remains
   *     → execute search, inject results as a user message, repeat.
   *  3. Otherwise extract and return the final AgentResponse.
   */
  async respond(incomingMessage: string): Promise<{ response: AgentResponse; usage: TokenUsage }> {
    this.messages.push({ role: 'user', content: incomingMessage });

    let toolCallsUsed = 0;
    const accumulatedUsage: TokenUsage = { promptTokens: 0, completionTokens: 0 };

    // eslint-disable-next-line no-constant-condition
    while (true) {
      let rawContent: string;

      try {
        const result = await this.callLLM();
        rawContent = result.content;
        accumulatedUsage.promptTokens += result.usage.promptTokens;
        accumulatedUsage.completionTokens += result.usage.completionTokens;
      } catch (err) {
        // On callLLM failure, remove the user message we pushed and re-throw
        this.messages.pop();
        throw err;
      }

      // Check for a tool-use request before committing this as the final response
      if (toolCallsUsed < MAX_TOOL_CALLS_PER_TURN && this.tavilyApiKey) {
        const toolRequest = extractToolUse(rawContent);
        if (toolRequest?.tool === 'web_search') {
          toolCallsUsed++;
          let searchOutput: string;
          try {
            const results = await webSearch(toolRequest.query, this.tavilyApiKey);
            searchOutput = formatSearchResults(results);
          } catch {
            searchOutput = `Search failed for query: "${toolRequest.query}". Proceed without web evidence.`;
          }
          // Inject the search results back as a user-role message (tool result)
          this.messages.push({
            role: 'user',
            content:
              `[SEARCH RESULTS for "${toolRequest.query}"]\n${searchOutput}\n` +
              `[END SEARCH RESULTS]\nNow provide your full argument response in the required JSON format.`,
          });
          continue;
        }
      }

      // No tool use or budget exhausted — this is the final response
      const agentResponse = extractJSON(rawContent);
      this.messages.push({ role: 'assistant', content: rawContent });
      return { response: agentResponse, usage: accumulatedUsage };
    }
  }

  reset(): void {
    this.messages = [];
  }
}
