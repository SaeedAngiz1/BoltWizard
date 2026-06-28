/**
 * Token cost estimation. USD per 1,000,000 tokens as [input, output].
 * Local models (Ollama / LM Studio) are free → 0. Unknown models → 0 to avoid
 * false precision. Numbers are approximate, for the resource monitor only.
 */
import type { ProviderKind } from '../llm/providers';

const TABLE: Record<string, [number, number]> = {
  // Anthropic
  'claude-opus-4-8': [15, 75],
  'claude-opus-4-7': [15, 75],
  'claude-sonnet-4-6': [3, 15],
  'claude-sonnet-4-5': [3, 15],
  'claude-3-5-sonnet': [3, 15],
  'claude-3-5-haiku': [1, 5],
  'claude-haiku-4-5': [1, 5],
  // OpenAI
  'gpt-4o': [2.5, 10],
  'gpt-4o-mini': [0.15, 0.6],
  'gpt-4-turbo': [10, 30],
  'gpt-4.1': [2, 8],
  'o3-mini': [1.1, 4.4],
};

export function priceFor(provider: ProviderKind, model: string): [number, number] {
  if (provider === 'ollama' || provider === 'lmstudio') return [0, 0];
  const key = (model || '').toLowerCase();
  for (const k of Object.keys(TABLE)) {
    if (key.includes(k)) return TABLE[k];
  }
  return [0, 0];
}

export function estimateCost(
  provider: ProviderKind,
  model: string,
  inTokens: number,
  outTokens: number,
): number {
  const [pi, po] = priceFor(provider, model);
  return (inTokens / 1e6) * pi + (outTokens / 1e6) * po;
}

/** Rough token estimate when a provider doesn't report usage. ~4 chars/token. */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil((text || '').length / 4));
}
