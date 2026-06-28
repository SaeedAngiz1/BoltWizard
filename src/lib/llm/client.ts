/**
 * Unified streaming chat client across all providers.
 *
 *  - Anthropic:  POST {baseUrl}/v1/messages  (SSE, `anthropic-dangerous-direct-browser-access`)
 *  - OpenAI-compat (openai/ollama/lmstudio): POST {baseUrl}/v1/chat/completions (SSE, `stream: true`)
 *
 * `onToken` fires with raw text deltas as they arrive. `onUsage` (optional)
 * fires once with the provider-reported token usage when available, so callers
 * (e.g. the pipeline resource monitor) can track cost. Existing callers ignore it.
 */
import type { LlmSettings } from './providers';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };
export type Usage = { inputTokens: number; outputTokens: number };

export async function streamChat(
  settings: LlmSettings,
  messages: ChatMessage[],
  onToken: (delta: string) => void,
  signal?: AbortSignal,
  onUsage?: (u: Usage) => void,
  onReasoning?: (delta: string) => void,
): Promise<string> {
  if (settings.provider === 'anthropic') {
    return streamAnthropic(settings, messages, onToken, signal, onUsage);
  }
  return streamOpenAICompatible(settings, messages, onToken, signal, onUsage, onReasoning);
}

// ---- Anthropic -------------------------------------------------------------
async function streamAnthropic(
  s: LlmSettings,
  messages: ChatMessage[],
  onToken: (d: string) => void,
  signal: AbortSignal | undefined,
  onUsage?: (u: Usage) => void,
): Promise<string> {
  const system = messages.find((m) => m.role === 'system')?.content ?? '';
  const turns = messages.filter((m) => m.role !== 'system');
  let inputTokens = 0;
  let outputTokens = 0;
  const res = await fetch(`${s.baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': s.apiKey,
      'anthropic-version': '2023-06-01',
      // Enables browser-direct calls. Key is still exposed in DevTools.
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: s.model,
      max_tokens: 8192,
      system,
      messages: turns.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
    }),
    signal,
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const full = await readSSE(res, (evt) => {
    if (evt.type === 'message_start' && evt.message?.usage) {
      inputTokens = evt.message.usage.input_tokens ?? 0;
    } else if (evt.type === 'message_delta' && evt.usage) {
      outputTokens = evt.usage.output_tokens ?? outputTokens;
    } else if (evt.type === 'content_block_delta' && evt.delta?.text) {
      onToken(evt.delta.text);
    }
    if (evt.type === 'error') throw new Error(evt.error?.message ?? 'stream error');
  });
  if (onUsage) onUsage({ inputTokens, outputTokens });
  return full;
}

// ---- OpenAI-compatible -----------------------------------------------------

/** Local servers (Ollama / LM Studio) are routed through same-origin Vite
 *  proxies to avoid browser CORS/COEP blocks. Cloud (OpenAI) is direct. */
function openAiEndpoint(s: LlmSettings): string {
  if (s.provider === 'lmstudio') return '/__lmstudio/v1/chat/completions';
  if (s.provider === 'ollama') return '/__ollama/v1/chat/completions';
  return `${s.baseUrl}/v1/chat/completions`;
}

function localModelsEndpoint(s: LlmSettings): string {
  if (s.provider === 'lmstudio') return '/__lmstudio/v1/models';
  if (s.provider === 'ollama') return '/__ollama/v1/models';
  return `${s.baseUrl}/v1/models`;
}

const EMBEDDING_HINT = /embed|embedding/i;

/**
 * Heuristic score so we prefer a CAPABLE instruction-tuned chat model over a
 * tiny reasoning one. A 2B "reasoning" model (e.g. gemma-4-e2b) sitting first in
 * LM Studio's /v1/models list used to get auto-picked — but it streams its
 * answer into `reasoning_content`, is too small to author a multi-file project,
 * and produced empty/garbage output that left the sandbox with no files (the
 * "No package.json" failure). We want llama-3.1-8b-instruct, not gemma-e2b.
 * Higher score = preferred. */
function scoreModel(id: string): number {
  const s = id.toLowerCase();
  let score = 0;
  if (/(instruct|chat|\bhf\b|\bit\b|dialogue)/.test(s)) score += 100; // instruction-tuned
  const size = s.match(/(\d{1,3})\s*b/);                              // param count, capped
  if (size) score += Math.min(parseInt(size[1], 10), 70);
  if (/(reason|thinking|\br1\b|qwq|gsm)/.test(s)) score -= 40;        // reasoning-only: weak/verbose for codegen
  if (/(e\d+\s*b|0\.5b|\b1b\b|1\.5b|\b2b\b|\b3b\b|tiny|mini|nano|small)/.test(s)) score -= 30; // very small
  if (/(vision|\bvl\b|multimodal)/.test(s)) score -= 10;              // multimodal — fine, not preferred
  return score;
}

/**
 * List the chat-capable models a local server (LM Studio / Ollama) exposes.
 * Embedding-only models are filtered out, and the rest are sorted best-first by
 * scoreModel() so callers that pick [0] (Settings detect, resolveLocalModel)
 * land on a capable model rather than the first tiny reasoning model. Returns []
 * on any failure so callers can fall back gracefully.
 */
export async function listLocalModels(s: LlmSettings): Promise<string[]> {
  try {
    const res = await fetch(localModelsEndpoint(s), { method: 'GET' });
    if (!res.ok) return [];
    const json = await res.json();
    const ids: unknown[] = Array.isArray(json?.data) ? json.data : Array.isArray(json?.models) ? json.models : [];
    return ids
      .map((m) => {
        if (typeof m === 'string') return m;
        const obj = m as any;
        // OpenAI/LM Studio use `id`; Ollama's native shape uses `name`/`model`.
        return obj?.id ?? obj?.name ?? obj?.model;
      })
      .filter((id): id is string => typeof id === 'string' && id.length > 0 && !EMBEDDING_HINT.test(id))
      .sort((a, b) => scoreModel(b) - scoreModel(a));
  } catch {
    return [];
  }
}

/**
 * Resolve the actual model id to send to a local server (LM Studio / Ollama).
 *
 * LM Studio REJECTS unknown/unloaded ids with "No models loaded", silently
 * breaking every request — so we never fall back to the unusable "local-model"
 * placeholder. Rules:
 *   - If the user set a capable model (scoreModel >= CAPABLE) AND it's loaded,
 *     respect it.
 *   - Otherwise (placeholder, blank, stale, OR a weak/tiny/reasoning model such
 *     as gemma-4-e2b) pick the best-scored available model. A reasoning model
 *     wastes the output budget on chain-of-thought and then truncates the moment
 *     real code begins ("breaks off as soon as it starts coding").
 *   - If no model is loaded at all, throw a clear, actionable error.
 *   The user can still force a specific model by loading ONLY that model.
 */
const CAPABLE_SCORE = 50;

async function resolveLocalModel(s: LlmSettings): Promise<string> {
  const models = await listLocalModels(s); // best-first, see scoreModel
  if (!models.length) {
    const app = s.provider === 'lmstudio' ? 'LM Studio' : 'Ollama';
    throw new Error(
      `${app} has no model loaded. Start its server and load a chat model (e.g. llama-3.1-8b-instruct), then retry.`,
    );
  }
  const want = s.model && s.model !== 'local-model' ? s.model : null;
  if (want && models.includes(want) && scoreModel(want) >= CAPABLE_SCORE) return want;
  return models[0];
}

async function streamOpenAICompatible(
  s: LlmSettings,
  messages: ChatMessage[],
  onToken: (d: string) => void,
  signal: AbortSignal | undefined,
  onUsage?: (u: Usage) => void,
  onReasoning?: (d: string) => void,
): Promise<string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (s.apiKey) headers.authorization = `Bearer ${s.apiKey}`;
  // Resolve the actual loaded model id for local servers (see resolveLocalModel).
  const model =
    s.provider === 'lmstudio' || s.provider === 'ollama'
      ? await resolveLocalModel(s)
      : s.model;
  const res = await fetch(openAiEndpoint(s), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
      temperature: 0.2,
      // Output cap. A full multi-file project needs headroom — 8192 truncated
      // larger apps mid-file ("breaks off as soon as it starts coding"). 16384
      // fits a substantial Vite/React project while still bounding generation
      // time. Tokens stream live to the chat, so a longer generation shows
      // progress rather than looking frozen. (Also bounded by LM Studio's own
      // "max tokens" setting and the model's context window.)
      max_tokens: 16384,
      stream_options: { include_usage: true },
    }),
    signal,
  });
  if (!res.ok) throw new Error(`${s.provider} ${res.status}: ${await res.text()}`);
  let usage: Usage | null = null;
  const full = await readSSE(res, (evt) => {
    const delta = evt.choices?.[0]?.delta;
    if (delta) {
      if (typeof delta.content === 'string' && delta.content) onToken(delta.content);
      // Reasoning models (LM Studio "thinking", DeepSeek-R1-style) stream their
      // chain-of-thought in `reasoning_content` BEFORE the real answer in
      // `content`. Forward it via onReasoning so it can be shown as "thinking";
      // without this those models appear totally silent even while working.
      if (typeof delta.reasoning_content === 'string' && delta.reasoning_content && onReasoning) {
        onReasoning(delta.reasoning_content);
      }
    }
    if (evt.usage) {
      usage = {
        inputTokens: evt.usage.prompt_tokens ?? 0,
        outputTokens: evt.usage.completion_tokens ?? 0,
      };
    }
  });
  if (onUsage && usage) onUsage(usage);
  return full;
}

/** Minimal SSE reader — parses `data: {...}` lines and returns concatenated text. */
async function readSSE(
  res: Response,
  onEvent: (evt: any) => void,
): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') return full;
      try {
        const evt = JSON.parse(payload);
        onEvent(evt);
        const delta =
          evt.delta?.text ?? evt.choices?.[0]?.delta?.content ?? '';
        if (delta) full += delta;
      } catch {
        /* partial JSON across chunk boundary — wait for more */
      }
    }
  }
  return full;
}
