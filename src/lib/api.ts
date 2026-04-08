import type { DebateConfig } from '@/types/debate';
import { API_BASE } from '@/lib/constants';
import { parseSSEBuffer } from '@/lib/utils';

export interface ModelInfo {
  id: string;
  name: string;
  provider: 'groq' | 'openrouter';
}

export interface ModelsResponse {
  groq: ModelInfo[];
  openrouter: ModelInfo[];
}

export async function fetchModels(): Promise<ModelsResponse> {
  const res = await fetch(`${API_BASE}/models`);
  if (!res.ok) throw new Error(`Failed to fetch models: ${res.status}`);
  return res.json() as Promise<ModelsResponse>;
}

/**
 * Ask the backend whether a clarifying question is needed before the debate.
 * Returns the question string if MAKER wants clarification, or null if none needed.
 */
export async function fetchClarificationQuestion(config: DebateConfig): Promise<string | null> {
  const res = await fetch(`${API_BASE}/clarify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config }),
  });
  if (!res.ok) throw new Error(`Clarification fetch failed: ${res.status}`);
  const data = (await res.json()) as { question: string | null };
  return data.question ?? null;
}

export async function* streamDebate(
  config: DebateConfig,
  token: string,
  signal?: AbortSignal
): AsyncGenerator<{ type: string; data: unknown }> {
  const response = await fetch(`${API_BASE}/debate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
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
