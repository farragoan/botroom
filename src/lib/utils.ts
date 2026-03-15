import type { AgentRole } from '@/types/debate';

export function cn(...args: (string | undefined | null | false)[]): string {
  return args.filter(Boolean).join(' ');
}

export interface SSEEvent {
  type: string;
  data: unknown;
}

export function parseSSEBuffer(
  buffer: string
): { parsed: SSEEvent[]; remaining: string } {
  const parsed: SSEEvent[] = [];
  // SSE messages are delimited by double newlines
  const chunks = buffer.split('\n\n');
  // The last element may be an incomplete chunk
  const remaining = chunks.pop() ?? '';

  for (const chunk of chunks) {
    if (!chunk.trim()) continue;

    let eventType = 'message';
    let dataLine = '';

    for (const line of chunk.split('\n')) {
      if (line.startsWith('event:')) {
        eventType = line.slice('event:'.length).trim();
      } else if (line.startsWith('data:')) {
        dataLine = line.slice('data:'.length).trim();
      }
    }

    if (!dataLine) continue;

    let data: unknown;
    try {
      data = JSON.parse(dataLine);
    } catch {
      data = dataLine;
    }

    parsed.push({ type: eventType, data });
  }

  return { parsed, remaining };
}

export function formatTurnLabel(turnNumber: number, agent: AgentRole): string {
  return `Turn ${turnNumber} · ${agent}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
