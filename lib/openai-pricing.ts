/** Token prices in USD per 1,000,000 tokens. */
export type ModelTokenPricing = {
  inputPerMillion: number;
  outputPerMillion: number;
  cachedInputPerMillion: number;
};

export const DEFAULT_OPENAI_MODEL = "gpt-4o";

/**
 * OpenAI list prices.
 * Update this table when OpenAI changes pricing.
 * Source snapshot: OpenAI API pricing (gpt-4o / gpt-4o-mini / gpt-4.1 family).
 */
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

/**
 * BytePlus ModelArk "Online inference (standard)" prices, keyed by the model family id the price page lists.
 * Versioned ids such as dola-seed-2-1-turbo-260628 match their family by prefix.
 * Source: https://docs.byteplus.com/docs/ModelArk/1099320 (page updated 2026-10-08), prompt length [0, 256K].
 * Flex and Batch are cheaper; /api/generate calls neither, so their prices must not be used here.
 * Cache storage (USD 0.0083 / M tokens / hour) only applies to explicit context caches, which this app never creates.
 * Cache-hit tokens come from usage.input_tokens_details.cached_tokens; when a response omits it, every input token
 * is billed at the full input price, so the estimate can only be high, never low.
 */
export const MODELARK_MODEL_PRICING: Record<string, ModelTokenPricing> = {
  "dola-seed-2-1-turbo": {
    inputPerMillion: 0.5,
    outputPerMillion: 2.5,
    cachedInputPerMillion: 0.1,
  },
};

const MODEL_PRICING: Record<string, ModelTokenPricing> = {
  ...OPENAI_MODEL_PRICING,
  ...MODELARK_MODEL_PRICING,
};

export function knownPricingForModel(model: string): ModelTokenPricing | null {
  const exact = MODEL_PRICING[model];
  if (exact) return exact;

  const aliases = Object.keys(MODEL_PRICING).sort((a, b) => b.length - a.length);
  const prefix = aliases.find((id) => model === id || model.startsWith(`${id}-`));
  return prefix ? MODEL_PRICING[prefix] : null;
}

export function pricingForModel(model: string): ModelTokenPricing {
  return knownPricingForModel(model) ?? OPENAI_MODEL_PRICING[DEFAULT_OPENAI_MODEL];
}

export function costFromTokens(tokens: number, usdPerMillion: number) {
  return (tokens / 1_000_000) * usdPerMillion;
}
