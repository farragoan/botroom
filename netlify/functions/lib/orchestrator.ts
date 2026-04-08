import { Agent } from './agent.js';
import { Observer } from './observer.js';
import type { AgentResponse, DebateConfig, TokenUsage, Turn } from './types.js';

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

function resolveAgentConfig(
  modelId: string,
  groqApiKey: string,
  openRouterApiKey?: string,
): { modelId: string; apiKey: string; baseUrl: string } {
  // OpenRouter model IDs contain ':' (e.g. "meta-llama/llama-3.1-8b-instruct:free")
  if (modelId.includes(':')) {
    return { modelId, apiKey: openRouterApiKey ?? '', baseUrl: OPENROUTER_BASE_URL };
  }
  return { modelId, apiKey: groqApiKey, baseUrl: GROQ_BASE_URL };
}

export type DebateEvent =
  | { type: 'turn'; data: Turn }
  | { type: 'synthesis'; data: { synthesis: string; concludedNaturally: boolean; totalTurns: number } }
  | { type: 'error'; data: { message: string } };

async function generateSynthesis(
  turns: Turn[],
  groqApiKey: string,
  openRouterApiKey?: string,
): Promise<string> {
  const transcript = turns
    .map(
      (t) =>
        `Turn ${t.turnNumber} - ${t.agent}: ${t.response.message}`,
    )
    .join('\n\n');

  const prompt = `You are a neutral analyst. Summarize the following AI debate transcript, highlighting the key arguments made by both sides, any points of agreement or concession, and an overall synthesis of the discussion.\n\nDebate transcript:\n${transcript}\n\nProvide a concise, balanced synthesis in 2-4 paragraphs.`;

  const apis: Array<{ url: string; key: string; model: string }> = [
    {
      url: GROQ_BASE_URL,
      key: groqApiKey,
      model: 'llama-3.3-70b-versatile',
    },
  ];

  if (openRouterApiKey) {
    apis.push({
      url: OPENROUTER_BASE_URL,
      key: openRouterApiKey,
      model: 'meta-llama/llama-3.3-70b-instruct',
    });
  }

  for (const api of apis) {
    try {
      const response = await fetch(`${api.url}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${api.key}`,
        },
        body: JSON.stringify({
          model: api.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.5,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const content = data?.choices?.[0]?.message?.content ?? '';
      if (content) {
        return content;
      }
    } catch {
      // Try next API
    }
  }

  return 'Synthesis could not be generated.';
}

/**
 * Ask MAKER whether it needs a clarifying question before the debate begins.
 *
 * Returns the question string if clarification is needed, or null if the topic
 * is clear enough to proceed immediately.
 *
 * Callers should append the user's answer to config.topic before calling runDebate:
 *   `topic + "\n\n[User clarification: " + answer + "]"`
 */
export async function getClarificationQuestion(
  config: DebateConfig,
  groqApiKey: string,
  openRouterApiKey?: string,
): Promise<string | null> {
  const cfg = resolveAgentConfig(config.makerModel, groqApiKey, openRouterApiKey);

  const prompt =
    `You will soon debate the following topic as MAKER (proposing and defending a position):\n\n` +
    `"${config.topic}"\n\n` +
    `Before the debate begins, do you need any clarification from the user to stake a precise, ` +
    `well-scoped position?\n\n` +
    `If the topic is clear and unambiguous enough to argue immediately, respond with ONLY:\n` +
    `{"needs_clarification":false,"question":null}\n\n` +
    `If the topic is genuinely ambiguous or scope-dependent in a way that would significantly ` +
    `change your position, respond with ONLY:\n` +
    `{"needs_clarification":true,"question":"<your single most important clarifying question>"}\n\n` +
    `Return ONLY valid JSON. No preamble, no explanation.`;

  try {
    const response = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.modelId,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      }),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data?.choices?.[0]?.message?.content ?? '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as {
      needs_clarification?: boolean;
      question?: string | null;
    };

    if (parsed.needs_clarification === true && typeof parsed.question === 'string') {
      return parsed.question.trim() || null;
    }
  } catch {
    // Clarification is optional — fall through to null
  }

  return null;
}

export async function* runDebate(
  config: DebateConfig,
  groqApiKey: string,
  openRouterApiKey?: string,
  tavilyApiKey?: string,
): AsyncGenerator<DebateEvent> {
  const turns: Turn[] = [];

  // Observer enforces minimum turns before CONCLUDE/CONCEDE is allowed.
  // Default 0 (disabled) to preserve backward compatibility with existing callers.
  const minTurns = config.minTurnsBeforeConclusion ?? 0;
  const observer = new Observer({ minTurns });

  /**
   * Apply observer veto: if the agent wants to CONCLUDE/CONCEDE too early,
   * override the action to CONTINUE and append a moderator note to the message.
   */
  function applyObserver(response: AgentResponse, turnNumber: number): AgentResponse {
    if (response.action === 'CONTINUE') return response;
    const verdict = observer.evaluateTermination(response.action, turnNumber);
    if (verdict.allow) return response;
    return {
      ...response,
      action: 'CONTINUE',
      message: response.message + '\n\n' + verdict.reason,
      conclusion_summary: null,
    };
  }

  // Resolve web-search capability
  const effectiveTavilyKey = config.enableWebSearch ? (tavilyApiKey ?? process.env.TAVILY_API_KEY) : undefined;

  try {
    const makerCfg = resolveAgentConfig(config.makerModel, groqApiKey, openRouterApiKey);
    const checkerCfg = resolveAgentConfig(config.checkerModel, groqApiKey, openRouterApiKey);

    const maker = new Agent(
      'MAKER',
      makerCfg.modelId,
      makerCfg.apiKey,
      makerCfg.baseUrl,
      config.topic,
      effectiveTavilyKey,
    );
    const checker = new Agent(
      'CHECKER',
      checkerCfg.modelId,
      checkerCfg.apiKey,
      checkerCfg.baseUrl,
      config.topic,
      effectiveTavilyKey,
    );

    let turnNumber = 0;
    let lastMakerAction: AgentResponse['action'] = 'CONTINUE';
    let lastCheckerAction: AgentResponse['action'] = 'CONTINUE';
    let concludedNaturally = false;

    // Turn 1: MAKER opens
    turnNumber++;
    const makerOpeningMessage = `Begin your opening position on: ${config.topic}`;
    let makerResponse: AgentResponse;
    let makerUsage: TokenUsage;

    try {
      const result = await maker.respond(makerOpeningMessage);
      makerResponse = result.response;
      makerUsage = result.usage;
    } catch (err) {
      yield {
        type: 'error',
        data: { message: `MAKER failed on turn 1: ${err instanceof Error ? err.message : String(err)}` },
      };
      return;
    }

    makerResponse = applyObserver(makerResponse, turnNumber);
    lastMakerAction = makerResponse.action;

    const makerTurn: Turn = {
      turnNumber,
      agent: 'MAKER',
      response: makerResponse,
      tokenUsage: makerUsage,
    };
    turns.push(makerTurn);
    yield { type: 'turn', data: makerTurn };

    if (config.maxTurns < 1) {
      const synthesis = await generateSynthesis(turns, groqApiKey, openRouterApiKey);
      yield {
        type: 'synthesis',
        data: { synthesis, concludedNaturally: false, totalTurns: turns.length },
      };
      return;
    }

    // Turn 2: CHECKER responds
    if (turnNumber < config.maxTurns) {
      turnNumber++;
      let checkerResponse: AgentResponse;
      let checkerUsage: TokenUsage;

      try {
        const result = await checker.respond(makerResponse.message);
        checkerResponse = result.response;
        checkerUsage = result.usage;
      } catch (err) {
        yield {
          type: 'error',
          data: { message: `CHECKER failed on turn 2: ${err instanceof Error ? err.message : String(err)}` },
        };
        const synthesis = await generateSynthesis(turns, groqApiKey, openRouterApiKey);
        yield {
          type: 'synthesis',
          data: { synthesis, concludedNaturally: false, totalTurns: turns.length },
        };
        return;
      }

      checkerResponse = applyObserver(checkerResponse, turnNumber);
      lastCheckerAction = checkerResponse.action;

      const checkerTurn: Turn = {
        turnNumber,
        agent: 'CHECKER',
        response: checkerResponse,
        tokenUsage: checkerUsage,
      };
      turns.push(checkerTurn);
      yield { type: 'turn', data: checkerTurn };

      // Termination helper: CONCLUDE or CONCEDE ends the debate (after observer approval)
      const isTerminal = (action: AgentResponse['action']) =>
        action === 'CONCLUDE' || action === 'CONCEDE';

      // Check if either agent concluded/conceded after turn 2
      if (isTerminal(lastMakerAction) || isTerminal(lastCheckerAction)) {
        concludedNaturally = true;
      } else {
        // Main debate loop: alternate MAKER/CHECKER
        let lastCheckerMessage = checkerResponse.message;

        while (turnNumber < config.maxTurns) {
          // MAKER's turn
          turnNumber++;
          let mResponse: AgentResponse;
          let mUsage: TokenUsage;

          try {
            const result = await maker.respond(lastCheckerMessage);
            mResponse = result.response;
            mUsage = result.usage;
          } catch (err) {
            yield {
              type: 'error',
              data: { message: `MAKER failed on turn ${turnNumber}: ${err instanceof Error ? err.message : String(err)}` },
            };
            break;
          }

          mResponse = applyObserver(mResponse, turnNumber);
          lastMakerAction = mResponse.action;
          const mTurn: Turn = { turnNumber, agent: 'MAKER', response: mResponse, tokenUsage: mUsage };
          turns.push(mTurn);
          yield { type: 'turn', data: mTurn };

          // If MAKER concluded or conceded, debate closes — don't call CHECKER
          if (isTerminal(lastMakerAction)) {
            concludedNaturally = true;
            break;
          }

          if (turnNumber >= config.maxTurns) break;

          // CHECKER's turn
          turnNumber++;
          let cResponse: AgentResponse;
          let cUsage: TokenUsage;

          try {
            const result = await checker.respond(mResponse.message);
            cResponse = result.response;
            cUsage = result.usage;
          } catch (err) {
            yield {
              type: 'error',
              data: { message: `CHECKER failed on turn ${turnNumber}: ${err instanceof Error ? err.message : String(err)}` },
            };
            break;
          }

          cResponse = applyObserver(cResponse, turnNumber);
          lastCheckerAction = cResponse.action;
          const cTurn: Turn = { turnNumber, agent: 'CHECKER', response: cResponse, tokenUsage: cUsage };
          turns.push(cTurn);
          yield { type: 'turn', data: cTurn };

          lastCheckerMessage = cResponse.message;

          // If CHECKER concluded or conceded, debate closes
          if (isTerminal(lastCheckerAction)) {
            concludedNaturally = true;
            break;
          }
        }
      }
    }

    const synthesis = await generateSynthesis(turns, groqApiKey, openRouterApiKey);
    yield {
      type: 'synthesis',
      data: { synthesis, concludedNaturally, totalTurns: turns.length },
    };
  } catch (err) {
    yield {
      type: 'error',
      data: { message: err instanceof Error ? err.message : String(err) },
    };
  }
}
