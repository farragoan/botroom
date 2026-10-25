import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AgentResponse } from '../../netlify/functions/lib/types.js';

// ---------------------------------------------------------------------------
// Mock runDebate before importing the module under test
// ---------------------------------------------------------------------------

vi.mock('../../netlify/functions/lib/orchestrator.js', () => ({
  runDebate: vi.fn(),
}));

import { runDebate } from '../../netlify/functions/lib/orchestrator.js';
import { parseArgs, printHumanTurn, main } from '../debate.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type DebateAction = AgentResponse['action'];

function makeTurn(
  agent: 'MAKER' | 'CHECKER',
  turnNumber: number,
  action: DebateAction,
  opts: Partial<AgentResponse> = {},
) {
  return {
    turnNumber,
    agent,
    response: {
      thinking: opts.thinking ?? 'some thinking',
      message: opts.message ?? 'some message',
      action,
      conceded_points: opts.conceded_points ?? [],
      conclusion_summary: opts.conclusion_summary ?? null,
    },
  };
}

async function* makeGenerator<T>(items: T[]): AsyncGenerator<T> {
  for (const item of items) yield item;
}

// ---------------------------------------------------------------------------
// parseArgs
// ---------------------------------------------------------------------------

describe('parseArgs', () => {
  it('extracts topic from first positional arg', () => {
    const { topic } = parseArgs(['node', 'debate.ts', 'Is TypeScript worth it?']);
    expect(topic).toBe('Is TypeScript worth it?');
  });

  it('defaults to human-readable mode', () => {
    const { jsonMode } = parseArgs(['node', 'debate.ts', 'topic']);
    expect(jsonMode).toBe(false);
  });

  it('enables json mode with --json flag', () => {
    const { jsonMode } = parseArgs(['node', 'debate.ts', 'topic', '--json']);
    expect(jsonMode).toBe(true);
  });

  it('sets default maker model', () => {
    const { config } = parseArgs(['node', 'debate.ts', 'topic']);
    expect(config.makerModel).toBe('llama-3.3-70b-versatile');
  });

  it('sets custom maker model via --maker-model', () => {
    const { config } = parseArgs(['node', 'debate.ts', 'topic', '--maker-model', 'custom-model']);
    expect(config.makerModel).toBe('custom-model');
  });

  it('sets custom checker model via --checker-model', () => {
    const { config } = parseArgs(['node', 'debate.ts', 'topic', '--checker-model', 'other-model']);
    expect(config.checkerModel).toBe('other-model');
  });

  it('sets max turns via --max-turns', () => {
    const { config } = parseArgs(['node', 'debate.ts', 'topic', '--max-turns', '4']);
    expect(config.maxTurns).toBe(4);
  });

  it('defaults max turns to 8', () => {
    const { config } = parseArgs(['node', 'debate.ts', 'topic']);
    expect(config.maxTurns).toBe(8);
  });

  it('sets verbose via --verbose', () => {
    const { config } = parseArgs(['node', 'debate.ts', 'topic', '--verbose']);
    expect(config.verbose).toBe(true);
  });

  it('defaults verbose to false', () => {
    const { config } = parseArgs(['node', 'debate.ts', 'topic']);
    expect(config.verbose).toBe(false);
  });

  it('topic is mirrored into config', () => {
    const { config, topic } = parseArgs(['node', 'debate.ts', 'my topic']);
    expect(config.topic).toBe('my topic');
    expect(topic).toBe('my topic');
  });

  it('exits with code 0 when no topic is provided', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as never);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    expect(() => parseArgs(['node', 'debate.ts'])).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(0);

    exitSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('exits with code 0 for --help flag', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as never);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    expect(() => parseArgs(['node', 'debate.ts', '--help'])).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(0);

    exitSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('exits with code 0 for -h flag', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as never);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    expect(() => parseArgs(['node', 'debate.ts', '-h'])).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(0);

    exitSpy.mockRestore();
    logSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// printHumanTurn
// ---------------------------------------------------------------------------

describe('printHumanTurn', () => {
  let logs: string[];
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logs = [];
    logSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.join(' '));
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('prints agent name and turn number', () => {
    printHumanTurn({ type: 'turn', data: makeTurn('MAKER', 1, 'CONTINUE') }, false);
    const output = logs.join('\n');
    expect(output).toContain('MAKER');
    expect(output).toContain('T1');
  });

  it('prints the message content', () => {
    printHumanTurn({ type: 'turn', data: makeTurn('CHECKER', 2, 'CONTINUE', { message: 'My argument here' }) }, false);
    expect(logs.join('\n')).toContain('My argument here');
  });

  it('prints action tag', () => {
    printHumanTurn({ type: 'turn', data: makeTurn('MAKER', 1, 'CONCLUDE') }, false);
    expect(logs.join('\n')).toContain('CONCLUDE');
  });

  it('does not print thinking when verbose=false', () => {
    printHumanTurn({ type: 'turn', data: makeTurn('MAKER', 1, 'CONTINUE', { thinking: 'secret thought' }) }, false);
    expect(logs.join('\n')).not.toContain('secret thought');
  });

  it('prints thinking when verbose=true', () => {
    printHumanTurn({ type: 'turn', data: makeTurn('MAKER', 1, 'CONTINUE', { thinking: 'secret thought' }) }, true);
    expect(logs.join('\n')).toContain('secret thought');
  });

  it('prints conceded points when present', () => {
    printHumanTurn(
      { type: 'turn', data: makeTurn('CHECKER', 2, 'CONCEDE', { conceded_points: ['point A', 'point B'] }) },
      false,
    );
    expect(logs.join('\n')).toContain('point A');
    expect(logs.join('\n')).toContain('point B');
  });

  it('does not print conceded line when conceded_points is empty', () => {
    printHumanTurn({ type: 'turn', data: makeTurn('MAKER', 1, 'CONTINUE', { conceded_points: [] }) }, false);
    expect(logs.join('\n')).not.toContain('conceded');
  });

  it('prints conclusion summary when present', () => {
    printHumanTurn(
      { type: 'turn', data: makeTurn('MAKER', 3, 'CONCLUDE', { conclusion_summary: 'Position proven.' }) },
      false,
    );
    expect(logs.join('\n')).toContain('Position proven.');
  });

  it('does not print summary line when conclusion_summary is null', () => {
    printHumanTurn({ type: 'turn', data: makeTurn('MAKER', 1, 'CONTINUE', { conclusion_summary: null }) }, false);
    expect(logs.join('\n')).not.toContain('summary');
  });

  it('uses CHECKER label for CHECKER turns', () => {
    printHumanTurn({ type: 'turn', data: makeTurn('CHECKER', 3, 'CONTINUE') }, false);
    expect(logs.join('\n')).toContain('CHECKER');
    expect(logs.join('\n')).toContain('T3');
  });
});

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

describe('main', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(runDebate).mockReset();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    errorSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  it('exits with code 1 when GROQ_API_KEY is not set', async () => {
    vi.stubEnv('GROQ_API_KEY', '');
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('exit 1');
    }) as never);

    await expect(main(['node', 'debate.ts', 'some topic'])).rejects.toThrow('exit 1');
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
  });

  it('emits JSON lines for turn events in --json mode', async () => {
    vi.stubEnv('GROQ_API_KEY', 'test-key');
    const turn = makeTurn('MAKER', 1, 'CONTINUE');
    vi.mocked(runDebate).mockReturnValue(
      makeGenerator([{ type: 'turn', data: turn }]) as ReturnType<typeof runDebate>,
    );

    const lines: string[] = [];
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      lines.push(String(chunk));
      return true;
    });

    await main(['node', 'debate.ts', 'topic', '--json']);

    writeSpy.mockRestore();
    expect(lines.some((l) => l.includes('"type":"turn"'))).toBe(true);
  });

  it('emits JSON lines for synthesis events in --json mode', async () => {
    vi.stubEnv('GROQ_API_KEY', 'test-key');
    vi.mocked(runDebate).mockReturnValue(
      makeGenerator([
        { type: 'synthesis', data: { synthesis: 'final thought', concludedNaturally: false, totalTurns: 2 } },
      ]) as ReturnType<typeof runDebate>,
    );

    const lines: string[] = [];
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      lines.push(String(chunk));
      return true;
    });

    await main(['node', 'debate.ts', 'topic', '--json']);

    writeSpy.mockRestore();
    expect(lines.some((l) => l.includes('"type":"synthesis"'))).toBe(true);
  });

  it('prints human-readable header in default mode', async () => {
    vi.stubEnv('GROQ_API_KEY', 'test-key');
    vi.mocked(runDebate).mockReturnValue(makeGenerator([]) as ReturnType<typeof runDebate>);

    await main(['node', 'debate.ts', 'my topic']);

    const output = consoleSpy.mock.calls.flat().join('\n');
    expect(output).toContain('my topic');
  });

  it('prints human-readable turn in default mode', async () => {
    vi.stubEnv('GROQ_API_KEY', 'test-key');
    const turn = makeTurn('CHECKER', 1, 'CONTINUE', { message: 'challenge!' });
    vi.mocked(runDebate).mockReturnValue(
      makeGenerator([{ type: 'turn', data: turn }]) as ReturnType<typeof runDebate>,
    );

    await main(['node', 'debate.ts', 'topic']);

    const output = consoleSpy.mock.calls.flat().join('\n');
    expect(output).toContain('challenge!');
  });

  it('prints synthesis section in default mode', async () => {
    vi.stubEnv('GROQ_API_KEY', 'test-key');
    vi.mocked(runDebate).mockReturnValue(
      makeGenerator([
        { type: 'synthesis', data: { synthesis: 'summarized', concludedNaturally: true, totalTurns: 4 } },
      ]) as ReturnType<typeof runDebate>,
    );

    await main(['node', 'debate.ts', 'topic']);

    const output = consoleSpy.mock.calls.flat().join('\n');
    expect(output).toContain('summarized');
    expect(output).toContain('SYNTHESIS');
  });

  it('exits with code 1 on error event', async () => {
    vi.stubEnv('GROQ_API_KEY', 'test-key');
    vi.mocked(runDebate).mockReturnValue(
      makeGenerator([{ type: 'error', data: { message: 'something broke' } }]) as ReturnType<typeof runDebate>,
    );

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('exit 1');
    }) as never);

    await expect(main(['node', 'debate.ts', 'topic'])).rejects.toThrow('exit 1');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy.mock.calls.flat().join(' ')).toContain('something broke');

    exitSpy.mockRestore();
  });

  it('exits with code 1 on fatal thrown Error from runDebate', async () => {
    vi.stubEnv('GROQ_API_KEY', 'test-key');
    vi.mocked(runDebate).mockImplementation(() => {
      throw new Error('fatal crash');
    });

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('exit 1');
    }) as never);

    await expect(main(['node', 'debate.ts', 'topic'])).rejects.toThrow('exit 1');
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
  });

  it('exits with code 1 on fatal thrown non-Error from runDebate', async () => {
    vi.stubEnv('GROQ_API_KEY', 'test-key');
    vi.mocked(runDebate).mockImplementation(() => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw 'string error';
    });

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('exit 1');
    }) as never);

    await expect(main(['node', 'debate.ts', 'topic'])).rejects.toThrow('exit 1');
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
  });

  it('passes OPENROUTER_API_KEY to runDebate when set', async () => {
    vi.stubEnv('GROQ_API_KEY', 'groq-key');
    vi.stubEnv('OPENROUTER_API_KEY', 'or-key');
    vi.mocked(runDebate).mockReturnValue(makeGenerator([]) as ReturnType<typeof runDebate>);

    await main(['node', 'debate.ts', 'topic']);

    expect(vi.mocked(runDebate)).toHaveBeenCalledWith(
      expect.any(Object),
      'groq-key',
      'or-key',
    );
  });
});
