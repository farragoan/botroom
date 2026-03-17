import { Agent } from './agent.js';
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

export async function* runDebate(
  config: DebateConfig,
  groqApiKey: string,
  openRouterApiKey?: string,
): AsyncGenerator<DebateEvent> {
  const turns: Turn[] = [];

  try {
    const makerCfg = resolveAgentConfig(config.makerModel, groqApiKey, openRouterApiKey);
    const checkerCfg = resolveAgentConfig(config.checkerModel, groqApiKey, openRouterApiKey);

    const maker = new Agent('MAKER', makerCfg.modelId, makerCfg.apiKey, makerCfg.baseUrl, config.topic);
    const checker = new Agent('CHECKER', checkerCfg.modelId, checkerCfg.apiKey, checkerCfg.baseUrl, config.topic);

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

      lastCheckerAction = checkerResponse.action;

      const checkerTurn: Turn = {
        turnNumber,
        agent: 'CHECKER',
        response: checkerResponse,
        tokenUsage: checkerUsage,
      };
      turns.push(checkerTurn);
      yield { type: 'turn', data: checkerTurn };

      // Check if both concluded after turn 2
      if (lastMakerAction === 'CONCLUDE' && lastCheckerAction === 'CONCLUDE') {
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

          lastMakerAction = mResponse.action;
          const mTurn: Turn = { turnNumber, agent: 'MAKER', response: mResponse, tokenUsage: mUsage };
          turns.push(mTurn);
          yield { type: 'turn', data: mTurn };

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

          lastCheckerAction = cResponse.action;
          const cTurn: Turn = { turnNumber, agent: 'CHECKER', response: cResponse, tokenUsage: cUsage };
          turns.push(cTurn);
          yield { type: 'turn', data: cTurn };

          lastCheckerMessage = cResponse.message;

          // Termination: both agents CONCLUDE in their last turns
          if (lastMakerAction === 'CONCLUDE' && lastCheckerAction === 'CONCLUDE') {
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
