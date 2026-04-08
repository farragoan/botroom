// Paise per 1k tokens (input / output), at 2× OpenRouter markup, USD→INR @85
export const MODEL_RATES: Record<string, { input: number; output: number }> = {
  // Groq
  'llama-3.3-70b-versatile':         { input: 6,    output: 8    },
  'llama-3.1-8b-instant':            { input: 1,    output: 1    },
  'mixtral-8x7b-32768':              { input: 4,    output: 4    },
  'gemma2-9b-it':                    { input: 2,    output: 2    },
  // OpenRouter — free models
  'meta-llama/llama-3.3-70b-instruct:free':  { input: 0, output: 0 },
  'google/gemma-3-27b-it:free':             { input: 0, output: 0 },
  // OpenRouter — paid models
  'openai/gpt-4o':                         { input: 430, output: 1290 },
  'openai/gpt-4o-mini':                    { input: 13,  output: 52   },
  'anthropic/claude-3.5-sonnet':           { input: 260, output: 1020 },
  'anthropic/claude-3-haiku':              { input: 21,  output: 107  },
  'google/gemini-flash-1.5':               { input: 14,  output: 42   },
  'mistralai/mistral-large':               { input: 170, output: 510  },
  // Fallback
  'default':                               { input: 50,  output: 100  },
};

export const OVERDRAFT_LIMIT_PAISE = -5000; // −₹50

export function calculateCostPaise(
  modelId: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const rate = MODEL_RATES[modelId] ?? MODEL_RATES['default'];
  const cost = (promptTokens / 1000) * rate.input + (completionTokens / 1000) * rate.output;
  return cost === 0 ? 0 : Math.max(1, Math.ceil(cost));
}
