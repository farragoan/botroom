import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebate } from '@/features/debate/hooks/useDebate';
import { useDebateStore } from '@/features/debate/store/debateStore';
import type { DebateConfig, Turn } from '@/types/debate';

// Mock the streamDebate API function
vi.mock('@/lib/api', () => ({
  streamDebate: vi.fn(),
}));

// Mock Clerk useAuth
vi.mock('@clerk/react', () => ({
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue('mock-token') }),
}));

import { streamDebate } from '@/lib/api';

const mockStreamDebate = vi.mocked(streamDebate);

const mockConfig: DebateConfig = {
  topic: 'Is TypeScript better than JavaScript?',
  makerModel: 'llama-70b',
  checkerModel: 'llama4-maverick',
  maxTurns: 8,
  verbose: false,
};

const mockTurn: Turn = {
  turnNumber: 1,
  agent: 'MAKER',
  response: {
    thinking: 'Some reasoning',
    message: 'My argument',
    action: 'CONTINUE',
    conceded_points: [],
    conclusion_summary: null,
  },
};

const mockTurn2: Turn = {
  turnNumber: 2,
  agent: 'CHECKER',
  response: {
    thinking: 'Counter reasoning',
    message: 'My counter-argument',
    action: 'CONCLUDE',
    conceded_points: ['Point A'],
    conclusion_summary: 'A summary',
  },
};

async function* makeAsyncGenerator<T>(items: T[]): AsyncGenerator<T> {
  for (const item of items) {
    yield item;
  }
}

beforeEach(() => {
  useDebateStore.getState().reset();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useDebate()', () => {
  describe('startDebate() — turn events', () => {
    it('processes a single turn event and adds it to the store', async () => {
      mockStreamDebate.mockReturnValue(
        makeAsyncGenerator([{ type: 'turn', data: mockTurn }])
      );

      const { result } = renderHook(() => useDebate());

      await act(async () => {
        await result.current.startDebate(mockConfig);
      });

      expect(result.current.turns).toHaveLength(1);
      expect(result.current.turns[0]).toEqual(mockTurn);
    });

    it('processes multiple turn events in order', async () => {
      mockStreamDebate.mockReturnValue(
        makeAsyncGenerator([
          { type: 'turn', data: mockTurn },
          { type: 'turn', data: mockTurn2 },
        ])
      );

      const { result } = renderHook(() => useDebate());

      await act(async () => {
        await result.current.startDebate(mockConfig);
      });

      expect(result.current.turns).toHaveLength(2);
      expect(result.current.turns[0].turnNumber).toBe(1);
      expect(result.current.turns[1].turnNumber).toBe(2);
    });

    it('ignores turn events with invalid data shape', async () => {
      mockStreamDebate.mockReturnValue(
        makeAsyncGenerator([
          { type: 'turn', data: { invalid: true } },
          { type: 'turn', data: mockTurn },
        ])
      );

      const { result } = renderHook(() => useDebate());

      await act(async () => {
        await result.current.startDebate(mockConfig);
      });

      // Only the valid turn should be added
      expect(result.current.turns).toHaveLength(1);
      expect(result.current.turns[0]).toEqual(mockTurn);
    });
  });

  describe('startDebate() — synthesis event', () => {
    it('sets synthesis and concludedNaturally from synthesis event', async () => {
      mockStreamDebate.mockReturnValue(
        makeAsyncGenerator([
          { type: 'turn', data: mockTurn },
          {
            type: 'synthesis',
            data: { synthesis: 'Final summary', concludedNaturally: true },
          },
        ])
      );

      const { result } = renderHook(() => useDebate());

      await act(async () => {
        await result.current.startDebate(mockConfig);
      });

      expect(result.current.synthesis).toBe('Final summary');
      expect(result.current.concludedNaturally).toBe(true);
    });

    it('sets concludedNaturally to false when value is false', async () => {
      mockStreamDebate.mockReturnValue(
        makeAsyncGenerator([
          {
            type: 'synthesis',
            data: { synthesis: 'Summary', concludedNaturally: false },
          },
        ])
      );

      const { result } = renderHook(() => useDebate());

      await act(async () => {
        await result.current.startDebate(mockConfig);
      });

      expect(result.current.concludedNaturally).toBe(false);
    });

    it('sets status to complete after all events are processed', async () => {
      mockStreamDebate.mockReturnValue(
        makeAsyncGenerator([
          {
            type: 'synthesis',
            data: { synthesis: 'Done', concludedNaturally: true },
          },
        ])
      );

      const { result } = renderHook(() => useDebate());

      await act(async () => {
        await result.current.startDebate(mockConfig);
      });

      expect(result.current.status).toBe('complete');
    });
  });

  describe('startDebate() — lifecycle', () => {
    it('sets status to running when debate starts', async () => {
      let capturedStatus: string | undefined;

      mockStreamDebate.mockImplementation(async function* () {
        // Capture status during streaming
        capturedStatus = useDebateStore.getState().status;
        yield { type: 'turn', data: mockTurn };
      });

      const { result } = renderHook(() => useDebate());

      await act(async () => {
        await result.current.startDebate(mockConfig);
      });

      expect(capturedStatus).toBe('running');
    });

    it('resets store state before starting a new debate', async () => {
      // First debate
      mockStreamDebate.mockReturnValueOnce(
        makeAsyncGenerator([{ type: 'turn', data: mockTurn }])
      );

      const { result } = renderHook(() => useDebate());

      await act(async () => {
        await result.current.startDebate(mockConfig);
      });

      expect(result.current.turns).toHaveLength(1);

      // Second debate — should reset turns
      mockStreamDebate.mockReturnValueOnce(
        makeAsyncGenerator([{ type: 'turn', data: mockTurn2 }])
      );

      await act(async () => {
        await result.current.startDebate(mockConfig);
      });

      expect(result.current.turns).toHaveLength(1);
      expect(result.current.turns[0].turnNumber).toBe(2);
    });

    it('sets config from provided debate config', async () => {
      mockStreamDebate.mockReturnValue(makeAsyncGenerator([]));

      const { result } = renderHook(() => useDebate());

      await act(async () => {
        await result.current.startDebate(mockConfig);
      });

      expect(result.current.config).toEqual(mockConfig);
    });
  });

  describe('startDebate() — error handling', () => {
    it('sets error and status to error when streamDebate throws', async () => {
      mockStreamDebate.mockImplementation(async function* () {
        throw new Error('500: Internal Server Error');
      });

      const { result } = renderHook(() => useDebate());

      await act(async () => {
        await result.current.startDebate(mockConfig);
      });

      expect(result.current.status).toBe('error');
      expect(result.current.error).toBe('500: Internal Server Error');
    });

    it('handles error SSE event from stream', async () => {
      mockStreamDebate.mockReturnValue(
        makeAsyncGenerator([
          { type: 'error', data: { message: 'Upstream model failure' } },
        ])
      );

      const { result } = renderHook(() => useDebate());

      await act(async () => {
        await result.current.startDebate(mockConfig);
      });

      expect(result.current.status).toBe('error');
      expect(result.current.error).toBe('Upstream model failure');
    });

    it('falls back to stringified data for error events without message field', async () => {
      mockStreamDebate.mockReturnValue(
        makeAsyncGenerator([{ type: 'error', data: 'plain error string' }])
      );

      const { result } = renderHook(() => useDebate());

      await act(async () => {
        await result.current.startDebate(mockConfig);
      });

      expect(result.current.status).toBe('error');
      expect(result.current.error).toBe('plain error string');
    });

    it('sets a fallback message for non-Error exceptions', async () => {
      mockStreamDebate.mockImplementation(async function* () {
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
        throw 'some non-error value';
      });

      const { result } = renderHook(() => useDebate());

      await act(async () => {
        await result.current.startDebate(mockConfig);
      });

      expect(result.current.status).toBe('error');
      expect(result.current.error).toBe('An unknown error occurred');
    });
  });

  describe('cancelDebate()', () => {
    it('aborts the stream by rejecting with AbortError', async () => {
      let abortSignal: AbortSignal | undefined;

      mockStreamDebate.mockImplementation(async function* (_config, _token, signal) {
        abortSignal = signal;
        // Simulate a long-running stream by waiting for abort
        await new Promise<void>((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
      });

      const { result } = renderHook(() => useDebate());

      // Start debate without awaiting
      let debatePromise: Promise<void>;
      act(() => {
        debatePromise = result.current.startDebate(mockConfig);
      });

      // Wait for getToken() to resolve so streamDebate is called and signal is captured
      await act(async () => {
        await Promise.resolve();
      });

      // Cancel it
      act(() => {
        result.current.cancelDebate();
      });

      await act(async () => {
        await debatePromise!;
      });

      // AbortError should NOT set error status — it's user-initiated
      expect(result.current.status).toBe('running');
      expect(result.current.error).toBeNull();
      // Signal should have been aborted
      expect(abortSignal?.aborted).toBe(true);
    });

    it('does not crash when called before any debate has started', () => {
      const { result } = renderHook(() => useDebate());
      expect(() => result.current.cancelDebate()).not.toThrow();
    });
  });

  describe('return values', () => {
    it('exposes all expected fields', () => {
      const { result } = renderHook(() => useDebate());
      expect(result.current).toHaveProperty('turns');
      expect(result.current).toHaveProperty('synthesis');
      expect(result.current).toHaveProperty('status');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('config');
      expect(result.current).toHaveProperty('concludedNaturally');
      expect(result.current).toHaveProperty('startDebate');
      expect(result.current).toHaveProperty('cancelDebate');
    });

    it('returns initial values before any debate', () => {
      const { result } = renderHook(() => useDebate());
      expect(result.current.turns).toEqual([]);
      expect(result.current.synthesis).toBeNull();
      expect(result.current.status).toBe('idle');
      expect(result.current.error).toBeNull();
      expect(result.current.config).toBeNull();
      expect(result.current.concludedNaturally).toBe(false);
    });
  });
});
