import type { DebateConfig } from '@/types/debate';
import { API_BASE } from '@/lib/constants';
import { parseSSEBuffer } from '@/lib/utils';

export async function* streamDebate(
  config: DebateConfig,
  signal?: AbortSignal
): AsyncGenerator<{ type: string; data: unknown }> {
  const response = await fetch(`${API_BASE}/debate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
    signal,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status}: ${text}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { parsed, remaining } = parseSSEBuffer(buffer);
    buffer = remaining;
    for (const event of parsed) {
      yield event;
    }
  }
}
