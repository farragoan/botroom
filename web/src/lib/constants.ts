export const MODELS = [
  { id: 'llama-70b', name: 'Llama 3.3 70B', provider: 'groq' as const },
  { id: 'llama-8b', name: 'Llama 3.1 8B', provider: 'groq' as const },
  { id: 'llama4-maverick', name: 'Llama 4 Maverick 17B', provider: 'groq' as const },
  { id: 'qwen3-32b', name: 'Qwen QwQ 32B', provider: 'groq' as const },
  { id: 'kimi-k2', name: 'Kimi K2', provider: 'groq' as const },
] as const;

export const DEFAULT_MAKER_MODEL = 'llama-70b';
export const DEFAULT_CHECKER_MODEL = 'llama4-maverick';
export const DEFAULT_MAX_TURNS = 8;
export const API_BASE = '/api';
