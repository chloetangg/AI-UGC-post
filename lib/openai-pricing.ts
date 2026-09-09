/**
 * OpenAI list prices in USD per 1,000,000 tokens.
 * Update this file when OpenAI changes pricing.
 * Source snapshot: OpenAI API pricing (gpt-4o / gpt-4o-mini / gpt-4.1 family).
 */
export type ModelTokenPricing = {
  inputPerMillion: number;
  outputPerMillion: number;
  cachedInputPerMillion: number;
};

export const DEFAULT_OPENAI_MODEL = "gpt-4o";

export const OPENAI_MODEL_PRICING: Record<string, ModelTokenPricing> = {
  "gpt-4o": {
    inputPerMillion: 2.5,
    outputPerMillion: 10,
    cachedInputPerMillion: 1.25,
  },
  "gpt-4o-2024-11-20": {
    inputPerMillion: 2.5,
    outputPerMillion: 10,
    cachedInputPerMillion: 1.25,
  },
  "gpt-4o-2024-08-06": {
    inputPerMillion: 2.5,
    outputPerMillion: 10,
    cachedInputPerMillion: 1.25,
  },
  "gpt-4o-mini": {
    inputPerMillion: 0.15,
    outputPerMillion: 0.6,
    cachedInputPerMillion: 0.075,
  },
  "gpt-4o-mini-2024-07-18": {
    inputPerMillion: 0.15,
    outputPerMillion: 0.6,
    cachedInputPerMillion: 0.075,
  },
  "gpt-4.1": {
    inputPerMillion: 2,
    outputPerMillion: 8,
    cachedInputPerMillion: 0.5,
  },
  "gpt-4.1-mini": {
    inputPerMillion: 0.4,
    outputPerMillion: 1.6,
    cachedInputPerMillion: 0.1,
  },
};

export function pricingForModel(model: string): ModelTokenPricing {
  const exact = OPENAI_MODEL_PRICING[model];
  if (exact) return exact;

  const aliases = Object.keys(OPENAI_MODEL_PRICING).sort((a, b) => b.length - a.length);
  const prefix = aliases.find((id) => model === id || model.startsWith(`${id}-`));
  if (prefix) return OPENAI_MODEL_PRICING[prefix];

  return OPENAI_MODEL_PRICING[DEFAULT_OPENAI_MODEL];
}

export function costFromTokens(tokens: number, usdPerMillion: number) {
  return (tokens / 1_000_000) * usdPerMillion;
}
