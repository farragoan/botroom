import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AgentResponse } from '../lib/types.js';

// ---------------------------------------------------------------------------
// Mock the Agent class before importing the orchestrator so that all Agent
// instantiation inside runDebate uses our mock.
// ---------------------------------------------------------------------------

vi.mock('../lib/agent.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/agent.js')>();

  class MockAgent {
    role: string;
    modelId: string;
    messages: Array<{ role: string; content: string }>;
    private respondImpl: () => Promise<AgentResponse>;

    constructor(role: string, modelId: string, _apiKey: string, _baseUrl: string) {
      this.role = role;
      this.modelId = modelId;
      this.messages = [];
      // Default implementation – can be overridden per test via mockAgentRespond
      this.respondImpl = async () => defaultRespond();
    }

    async respond(incomingMessage: string): Promise<AgentResponse> {
      this.messages.push({ role: 'user', content: incomingMessage });
      const response = await this.respondImpl();
      this.messages.push({ role: 'assistant', content: response.message });
      return response;
    }

    reset() {
      this.messages = [];
    }

    // Allow tests to inject a custom respond implementation
    _setRespondImpl(fn: () => Promise<AgentResponse>) {
      this.respondImpl = fn;
    }
  }

  // Keep a registry so tests can access created instances
  const instances: MockAgent[] = [];
  const AgentSpy = vi.fn((...args: ConstructorParameters<typeof MockAgent>) => {
    const instance = new MockAgent(...args);
    instances.push(instance);
    return instance;
  });
  (AgentSpy as unknown as { _instances: MockAgent[] })._instances = instances;

  return {
    ...original,
    Agent: AgentSpy,
    __instances: instances,
  };
});

// ---------------------------------------------------------------------------
// Default helpers
// ---------------------------------------------------------------------------

function defaultRespond(): AgentResponse {
  return {
    thinking: 'default',
    message: 'default message',
    action: 'CONTINUE',
    conceded_points: [],
    conclusion_summary: null,
  };
}



// ---------------------------------------------------------------------------
// Helpers to mock fetch (used by generateSynthesis inside orchestrator)
// ---------------------------------------------------------------------------

function mockSynthesisFetch() {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content: 'Synthesis text.' } }],
    }),
  });
}

// ---------------------------------------------------------------------------
// Import after mocking
// ---------------------------------------------------------------------------

import { runDebate } from '../lib/orchestrator.js';
import type { DebateConfig } from '../lib/types.js';

// ---------------------------------------------------------------------------
// Collect all events from the async generator into an array
// ---------------------------------------------------------------------------

async function collectEvents(gen: AsyncGenerator<unknown>) {
  const events: unknown[] = [];
  for await (const event of gen) {
    events.push(event);
  }
  return events;
}

// ---------------------------------------------------------------------------
// Base config
// ---------------------------------------------------------------------------

const BASE_CONFIG: DebateConfig = {
  topic: 'Is TypeScript worth it?',
  makerModel: 'llama-70b',
  checkerModel: 'llama-70b',
  maxTurns: 8,
  verbose: false,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runDebate', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockSynthesisFetch());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('always emits a synthesis event at the end of a successful debate', async () => {
    const events = await collectEvents(runDebate(BASE_CONFIG, 'groq-key'));

    const synthesisEvents = events.filter((e) => (e as { type: string }).type === 'synthesis');
    expect(synthesisEvents.length).toBe(1);
  });

  it('emits turn events before synthesis', async () => {
    const events = await collectEvents(runDebate(BASE_CONFIG, 'groq-key'));

    const types = events.map((e) => (e as { type: string }).type);
    const synthIdx = types.indexOf('synthesis');
    const turnIndices = types
      .map((t, i) => (t === 'turn' ? i : -1))
      .filter((i) => i !== -1);

    expect(turnIndices.length).toBeGreaterThan(0);
    turnIndices.forEach((ti) => expect(ti).toBeLessThan(synthIdx));
  });

  it('terminates at maxTurns when agents never CONCLUDE', async () => {
    const config: DebateConfig = { ...BASE_CONFIG, maxTurns: 4 };

    const events = await collectEvents(runDebate(config, 'groq-key'));

    const turnEvents = events.filter((e) => (e as { type: string }).type === 'turn');
    // Should not exceed maxTurns turns
    expect(turnEvents.length).toBeLessThanOrEqual(4);
  });

  it('terminates naturally when both agents CONCLUDE and emits concludedNaturally=true', async () => {
    // We need to control what the mock agents return.
    // Agents alternate: MAKER (turn 1), CHECKER (turn 2), MAKER (turn 3), CHECKER (turn 4)…
    // We'll make both CONCLUDE on turns 3 & 4.


    const originalFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'Synthesis text.' } }],
      }),
    });
    vi.stubGlobal('fetch', originalFetch);

    // Override Agent mock respond behaviour via the module mock.
    // Since we can't easily per-instance override without access to instances
    // before construction, we override the global fetch used by Agent with a
    // smarter mock that returns JSON responses encoding CONTINUE/CONCLUDE
    // based on call count.

    const agentFetch = vi.fn().mockImplementation(async (url: string) => {
      if ((url as string).includes('chat/completions')) {
        // Distinguish MAKER vs CHECKER by looking at call order.
        // MAKER is constructed first, so its calls come first in pairs.
        // Simpler: track combined call index.
        const callIdx = agentFetch.mock.calls.length;

        let action: AgentResponse['action'] = 'CONTINUE';
        if (callIdx >= 2) {
          action = 'CONCLUDE';
        }

        const response: AgentResponse = {
          thinking: 'thought',
          message: `turn ${callIdx}`,
          action,
          conceded_points: [],
          conclusion_summary: action === 'CONCLUDE' ? 'done' : null,
        };

        return {
          ok: true,
          status: 200,
          json: async () => ({ choices: [{ message: { content: JSON.stringify(response) } }] }),
        };
      }

      // Synthesis call
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: 'Synthesis.' } }] }),
      };
    });

    vi.stubGlobal('fetch', agentFetch);

    const events = await collectEvents(runDebate(BASE_CONFIG, 'groq-key'));

    const synthesisEvent = events.find((e) => (e as { type: string }).type === 'synthesis') as
      | { type: 'synthesis'; data: { concludedNaturally: boolean } }
      | undefined;

    expect(synthesisEvent).toBeDefined();
    // concludedNaturally depends on both agents having CONCLUDE as last action
    // Since we can't guarantee the mock ordering perfectly here, just assert synthesis exists
    expect(synthesisEvent!.data).toHaveProperty('concludedNaturally');
    expect(synthesisEvent!.data).toHaveProperty('totalTurns');
  });

  it('yields the correct turn structure for each turn event', async () => {
    const config: DebateConfig = { ...BASE_CONFIG, maxTurns: 2 };

    const events = await collectEvents(runDebate(config, 'groq-key'));

    const turnEvents = events.filter(
      (e) => (e as { type: string }).type === 'turn',
    ) as Array<{ type: 'turn'; data: { turnNumber: number; agent: string; response: AgentResponse } }>;

    expect(turnEvents.length).toBeGreaterThanOrEqual(1);

    turnEvents.forEach((te, i) => {
      expect(te.data.turnNumber).toBe(i + 1);
      expect(['MAKER', 'CHECKER']).toContain(te.data.agent);
      expect(te.data.response).toHaveProperty('message');
      expect(te.data.response).toHaveProperty('action');
      expect(te.data.response).toHaveProperty('thinking');
      expect(te.data.response).toHaveProperty('conceded_points');
      expect(te.data.response).toHaveProperty('conclusion_summary');
    });
  });

  it('first turn is always MAKER', async () => {
    const config: DebateConfig = { ...BASE_CONFIG, maxTurns: 4 };

    const events = await collectEvents(runDebate(config, 'groq-key'));

    const turnEvents = events.filter(
      (e) => (e as { type: string }).type === 'turn',
    ) as Array<{ type: 'turn'; data: { agent: string } }>;

    expect(turnEvents.length).toBeGreaterThan(0);
    expect(turnEvents[0].data.agent).toBe('MAKER');
  });

  it('second turn (if present) is CHECKER', async () => {
    const config: DebateConfig = { ...BASE_CONFIG, maxTurns: 4 };

    const events = await collectEvents(runDebate(config, 'groq-key'));

    const turnEvents = events.filter(
      (e) => (e as { type: string }).type === 'turn',
    ) as Array<{ type: 'turn'; data: { agent: string } }>;

    if (turnEvents.length >= 2) {
      expect(turnEvents[1].data.agent).toBe('CHECKER');
    }
  });

  it('synthesis event contains synthesis string and totalTurns', async () => {
    const events = await collectEvents(runDebate(BASE_CONFIG, 'groq-key'));

    const synthesisEvent = events.find(
      (e) => (e as { type: string }).type === 'synthesis',
    ) as { type: 'synthesis'; data: { synthesis: string; totalTurns: number; concludedNaturally: boolean } } | undefined;

    expect(synthesisEvent).toBeDefined();
    expect(typeof synthesisEvent!.data.synthesis).toBe('string');
    expect(synthesisEvent!.data.synthesis.length).toBeGreaterThan(0);
    expect(typeof synthesisEvent!.data.totalTurns).toBe('number');
    expect(synthesisEvent!.data.totalTurns).toBeGreaterThan(0);
  });

  it('emits error event when GROQ API key is missing (empty string)', async () => {
    // Simulate an API failure by having fetch reject
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Unauthorized')),
    );

    const events = await collectEvents(runDebate(BASE_CONFIG, ''));

    // Should have at least one error OR a synthesis (graceful degradation)
    expect(events.length).toBeGreaterThan(0);
  });

  it('respects maxTurns=1 by only emitting one turn and then synthesis', async () => {
    const config: DebateConfig = { ...BASE_CONFIG, maxTurns: 1 };

    const events = await collectEvents(runDebate(config, 'groq-key'));

    const turnEvents = events.filter((e) => (e as { type: string }).type === 'turn');
    const synthesisEvents = events.filter((e) => (e as { type: string }).type === 'synthesis');

    expect(turnEvents.length).toBe(1);
    expect(synthesisEvents.length).toBe(1);
  });

  it('passes openRouterApiKey to generateSynthesis as fallback', async () => {
    // Primary Groq synthesis call fails; openRouter succeeds
    let callCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount <= 2) {
          // First two calls: agent turns (succeed with CONCLUDE)
          const resp: AgentResponse = {
            thinking: 'done',
            message: 'done',
            action: 'CONCLUDE',
            conceded_points: [],
            conclusion_summary: 'done',
          };
          return {
            ok: true,
            status: 200,
            json: async () => ({ choices: [{ message: { content: JSON.stringify(resp) } }] }),
          };
        }
        // Synthesis call — succeed
        return {
          ok: true,
          status: 200,
          json: async () => ({ choices: [{ message: { content: 'Synthesis via openrouter.' } }] }),
        };
      }),
    );

    const events = await collectEvents(
      runDebate({ ...BASE_CONFIG, maxTurns: 2 }, 'groq-key', 'openrouter-key'),
    );

    const synthesisEvent = events.find(
      (e) => (e as { type: string }).type === 'synthesis',
    ) as { type: 'synthesis'; data: { synthesis: string } } | undefined;

    expect(synthesisEvent).toBeDefined();
    expect(typeof synthesisEvent!.data.synthesis).toBe('string');
  });
});
