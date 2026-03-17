import { useRef } from 'react';
import { useDebateStore } from '@/features/debate/store/debateStore';
import { streamDebate } from '@/lib/api';
import type { DebateConfig, Turn } from '@/types/debate';

interface SynthesisEventData {
  synthesis: string;
  concluded_naturally: boolean;
}

function isSynthesisData(data: unknown): data is SynthesisEventData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'synthesis' in data &&
    typeof (data as SynthesisEventData).synthesis === 'string'
  );
}

function isTurnData(data: unknown): data is Turn {
  return (
    typeof data === 'object' &&
    data !== null &&
    'turnNumber' in data &&
    'agent' in data &&
    'response' in data
  );
}

function isErrorData(data: unknown): data is { message: string } {
  return (
    typeof data === 'object' &&
    data !== null &&
    'message' in data &&
    typeof (data as { message: string }).message === 'string'
  );
}

export function useDebate() {
  const store = useDebateStore();
  const abortControllerRef = useRef<AbortController | null>(null);

  async function startDebate(config: DebateConfig): Promise<void> {
    store.reset();
    store.setConfig(config);
    store.setStatus('running');

    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const generator = streamDebate(config, controller.signal);

      for await (const event of generator) {
        if (event.type === 'turn') {
          if (isTurnData(event.data)) {
            store.addTurn(event.data);
          }
        } else if (event.type === 'synthesis') {
          if (isSynthesisData(event.data)) {
            store.setSynthesis(event.data.synthesis);
            store.setConcludedNaturally(
              Boolean(event.data.concluded_naturally)
            );
          }
        } else if (event.type === 'error') {
          const message = isErrorData(event.data)
            ? event.data.message
            : String(event.data);
          store.setError(message);
          store.setStatus('error');
          return;
        }
      }

      store.setStatus('complete');
      if (Notification.permission === 'granted') {
        new Notification('Debate complete', {
          body: `The debate has concluded after ${store.turns.length} turns.`,
        });
      }
    } catch (err: unknown) {
      // Ignore AbortError — user-initiated cancel
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      const message =
        err instanceof Error ? err.message : 'An unknown error occurred';
      store.setError(message);
      store.setStatus('error');
    }
  }

  function cancelDebate(): void {
    abortControllerRef.current?.abort();
  }

  return {
    turns: store.turns,
    synthesis: store.synthesis,
    status: store.status,
    error: store.error,
    config: store.config,
    concludedNaturally: store.concludedNaturally,
    startDebate,
    cancelDebate,
  };
}
