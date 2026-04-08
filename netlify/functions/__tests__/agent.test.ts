import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Agent, extractJSON } from '../lib/agent.js';
import type { AgentResponse } from '../lib/types.js';

// ---------------------------------------------------------------------------
// extractJSON
// ---------------------------------------------------------------------------

describe('extractJSON', () => {
  it('parses clean JSON', () => {
    const input = JSON.stringify({
      thinking: 'My reasoning',
      message: 'My argument',
      action: 'CONTINUE',
      conceded_points: [],
      conclusion_summary: null,
    });

    const result = extractJSON(input);

    expect(result.thinking).toBe('My reasoning');
    expect(result.message).toBe('My argument');
    expect(result.action).toBe('CONTINUE');
    expect(result.conceded_points).toEqual([]);
    expect(result.conclusion_summary).toBeNull();
  });

  it('parses JSON wrapped in ```json markdown block', () => {
    const json = {
      thinking: 'Deep thought',
      message: 'Counter-argument',
      action: 'CONCLUDE',
      conceded_points: ['point A'],
      conclusion_summary: 'We agree on X',
    };
    const input = `\`\`\`json\n${JSON.stringify(json)}\n\`\`\``;

    const result = extractJSON(input);

    expect(result.action).toBe('CONCLUDE');
    expect(result.conclusion_summary).toBe('We agree on X');
    expect(result.conceded_points).toEqual(['point A']);
  });

  it('parses JSON wrapped in plain ``` markdown block', () => {
    const json = {
      thinking: 'thought',
      message: 'msg',
      action: 'CONCEDE',
      conceded_points: ['p1', 'p2'],
      conclusion_summary: null,
    };
    const input = `\`\`\`\n${JSON.stringify(json)}\n\`\`\``;

    const result = extractJSON(input);

    expect(result.action).toBe('CONCEDE');
    expect(result.conceded_points).toEqual(['p1', 'p2']);
  });

  it('returns fallback response for plain text with no JSON', () => {
    const result = extractJSON('This is just plain text with no JSON at all.');

    expect(result.action).toBe('CONTINUE');
    expect(result.message).toContain('unable');
  });

  it('returns fallback response for invalid JSON', () => {
    const result = extractJSON('{ not valid json :::');

    expect(result.action).toBe('CONTINUE');
  });

  it('defaults invalid action to CONTINUE', () => {
    const input = JSON.stringify({
      thinking: 'x',
      message: 'y',
      action: 'INVALID_ACTION',
      conceded_points: [],
      conclusion_summary: null,
    });

    const result = extractJSON(input);

    expect(result.action).toBe('CONTINUE');
  });

  it('handles missing fields gracefully', () => {
    const input = JSON.stringify({ action: 'CONCLUDE' });

    const result = extractJSON(input);

    expect(result.action).toBe('CONCLUDE');
    expect(result.thinking).toBe('');
    expect(result.message).toBe('');
    expect(result.conceded_points).toEqual([]);
    expect(result.conclusion_summary).toBeNull();
  });

  it('coerces non-array conceded_points to empty array', () => {
    const input = JSON.stringify({
      thinking: 'x',
      message: 'y',
      action: 'CONTINUE',
      conceded_points: 'not-an-array',
      conclusion_summary: null,
    });

    const result = extractJSON(input);

    expect(result.conceded_points).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

function makeMockResponse(agentResponse: AgentResponse) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({
      choices: [{ message: { content: JSON.stringify(agentResponse) } }],
    }),
  };
}

const VALID_RESPONSE: AgentResponse = {
  thinking: 'I think carefully',
  message: 'Here is my position',
  action: 'CONTINUE',
  conceded_points: [],
  conclusion_summary: null,
};

describe('Agent', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('calls the correct API endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeMockResponse(VALID_RESPONSE));
    vi.stubGlobal('fetch', mockFetch);

    const agent = new Agent('MAKER', 'llama-3.3-70b-versatile', 'test-key', 'https://api.groq.com/openai/v1', 'test topic');
    await agent.respond('Hello');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(options.method).toBe('POST');
    expect((options.headers as Record<string, string>)['Authorization']).toBe('Bearer test-key');
  });

  it('sends the MAKER system prompt for MAKER role', async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeMockResponse(VALID_RESPONSE));
    vi.stubGlobal('fetch', mockFetch);

    const agent = new Agent('MAKER', 'some-model', 'key', 'https://api.groq.com/openai/v1', 'test topic');
    await agent.respond('Argue this');

    const body = JSON.parse((mockFetch.mock.calls[0] as [string, RequestInit & { body: string }])[1].body);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).toContain('You are MAKER');
    expect(body.messages[0].content).not.toContain('You are CHECKER');
  });

  it('sends the CHECKER system prompt for CHECKER role', async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeMockResponse(VALID_RESPONSE));
    vi.stubGlobal('fetch', mockFetch);

    const agent = new Agent('CHECKER', 'some-model', 'key', 'https://api.groq.com/openai/v1', 'test topic');
    await agent.respond('Critique this');

    const body = JSON.parse((mockFetch.mock.calls[0] as [string, RequestInit & { body: string }])[1].body);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).toContain('CHECKER');
    expect(body.messages[0].content).not.toContain('You are MAKER');
  });

  it('returns parsed AgentResponse', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeMockResponse(VALID_RESPONSE)));

    const agent = new Agent('MAKER', 'model', 'key', 'https://api.groq.com/openai/v1', 'test topic');
    const result = await agent.respond('Start');

    expect(result.response.thinking).toBe(VALID_RESPONSE.thinking);
    expect(result.response.message).toBe(VALID_RESPONSE.message);
    expect(result.response.action).toBe('CONTINUE');
  });

  it('maintains conversation history across multiple calls', async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeMockResponse(VALID_RESPONSE));
    vi.stubGlobal('fetch', mockFetch);

    const agent = new Agent('MAKER', 'model', 'key', 'https://api.groq.com/openai/v1', 'test topic');

    await agent.respond('First message');
    await agent.respond('Second message');

    expect(mockFetch).toHaveBeenCalledTimes(2);

    // On the second call the history should contain both user messages and the
    // first assistant reply (system prompt is prepended separately).
    const secondCallBody = JSON.parse(
      (mockFetch.mock.calls[1] as [string, RequestInit & { body: string }])[1].body,
    );
    const nonSystemMessages: Array<{ role: string; content: string }> = secondCallBody.messages.filter(
      (m: { role: string }) => m.role !== 'system',
    );

    expect(nonSystemMessages.length).toBe(3); // user, assistant, user
    expect(nonSystemMessages[0].role).toBe('user');
    expect(nonSystemMessages[0].content).toBe('First message');
    expect(nonSystemMessages[1].role).toBe('assistant');
    expect(nonSystemMessages[2].role).toBe('user');
    expect(nonSystemMessages[2].content).toBe('Second message');
  });

  it('reset() clears message history', async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeMockResponse(VALID_RESPONSE));
    vi.stubGlobal('fetch', mockFetch);

    const agent = new Agent('MAKER', 'model', 'key', 'https://api.groq.com/openai/v1', 'test topic');
    await agent.respond('First message');

    expect(agent.messages.length).toBeGreaterThan(0);

    agent.reset();
    expect(agent.messages).toHaveLength(0);
  });

  it('retries on 429 rate limit and succeeds on retry', async () => {
    const rateLimitResponse = {
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      json: async () => ({}),
    };

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(rateLimitResponse)
      .mockResolvedValueOnce(makeMockResponse(VALID_RESPONSE));
    vi.stubGlobal('fetch', mockFetch);

    // Speed up retries in tests
    vi.useFakeTimers();

    const agent = new Agent('MAKER', 'model', 'key', 'https://api.groq.com/openai/v1', 'test topic');
    const responsePromise = agent.respond('Hello');

    // Advance past the 2s retry delay
    await vi.runAllTimersAsync();

    const result = await responsePromise;

    vi.useRealTimers();

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.response.action).toBe('CONTINUE');
  });

  it('throws after exhausting all retries on persistent errors', async () => {
    const errorResponse = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({}),
    };

    const mockFetch = vi.fn().mockResolvedValue(errorResponse);
    vi.stubGlobal('fetch', mockFetch);

    vi.useFakeTimers();

    const agent = new Agent('MAKER', 'model', 'key', 'https://api.groq.com/openai/v1', 'test topic');
    // Attach rejection handler immediately to avoid unhandledRejection warning
    const assertion = expect(agent.respond('Hello')).rejects.toThrow();

    await vi.runAllTimersAsync();
    await assertion;

    vi.useRealTimers();
  });

  it('falls back to CONTINUE response when API returns unparseable content', async () => {
    const badResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        choices: [{ message: { content: 'I am just plain text, no JSON here.' } }],
      }),
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(badResponse));

    const agent = new Agent('CHECKER', 'model', 'key', 'https://api.groq.com/openai/v1', 'test topic');
    const result = await agent.respond('What do you think?');

    expect(result.response.action).toBe('CONTINUE');
  });
});
