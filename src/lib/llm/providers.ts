/**
 * LLM provider definitions + settings.
 *
 * Supports two access paths, per the user's choice:
 *   1. User-supplied API key in-browser (Anthropic / OpenAI) — stored in localStorage.
 *   2. Local models via Ollama / LM Studio (OpenAI-compatible endpoints).
 *
 * Keys live only in this browser (localStorage). They are visible to anyone with
 * DevTools open on this tab — fine for a personal/local tool, not for hosting.
 */

export type ProviderKind = 'anthropic' | 'openai' | 'ollama' | 'lmstudio';

export type Provider = {
  id: ProviderKind;
  label: string;
  baseUrl: string;          // origin only, no trailing slash
  needsKey: boolean;
  defaultModel: string;
  docs: string;
};

export const PROVIDERS: Record<ProviderKind, Provider> = {
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    baseUrl: 'https://api.anthropic.com',
    needsKey: true,
    defaultModel: 'claude-sonnet-4-6',
    docs: 'https://console.anthropic.com/settings/keys',
  },
  openai: {
    id: 'openai',
    label: 'OpenAI (GPT)',
    baseUrl: 'https://api.openai.com',
    needsKey: true,
    defaultModel: 'gpt-4o',
    docs: 'https://platform.openai.com/api-keys',
  },
  ollama: {
    id: 'ollama',
    label: 'Ollama (local)',
    baseUrl: 'http://localhost:11434',
    needsKey: false,
    defaultModel: 'llama3.1',
    docs: 'https://ollama.com/download  (set OLLAMA_ORIGINS=*)',
  },
  lmstudio: {
    id: 'lmstudio',
    label: 'LM Studio (local)',
    baseUrl: 'http://localhost:1234',
    needsKey: false,
    defaultModel: 'local-model',
    docs: 'https://lmstudio.ai  (start local server)',
  },
};

export type LlmSettings = {
  provider: ProviderKind;
  apiKey: string;
  model: string;
  baseUrl: string;
};

const STORAGE_KEY = 'boltglm.llm.settings';

export function loadSettings(): LlmSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { provider: 'anthropic', apiKey: '', model: PROVIDERS.anthropic.defaultModel, baseUrl: PROVIDERS.anthropic.baseUrl };
}

export function saveSettings(s: LlmSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}
