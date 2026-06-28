/**
 * Role-scoped streaming chat for the pipeline. Resolves which provider/model/key
 * a role uses, streams the response, and records token usage + cost. When the
 * provider reports real usage (Anthropic message_delta / OpenAI stream_options)
 * it is used; otherwise tokens are estimated from text length.
 */
import { streamChat, type ChatMessage } from '../llm/client';
import { resolveSettings } from './roles';
import { recordUsage } from './resources';
import { estimateTokens } from './costs';
import type { RoleKey } from './types';
import { useStore } from '../../store';

export async function chat(
  role: RoleKey,
  messages: ChatMessage[],
  onToken?: (delta: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const st = useStore.getState();
  const settings = resolveSettings(role, st.roles, st.settings);

  let reportedIn = 0;
  let reportedOut = 0;
  let reported = false;

  const text = await streamChat(
    settings,
    messages,
    (d) => onToken?.(d),
    signal,
    (u) => {
      reportedIn = u.inputTokens;
      reportedOut = u.outputTokens;
      reported = true;
    },
  );

  if (!reported) {
    reportedIn = estimateTokens(messages.map((m) => m.content).join('\n'));
    reportedOut = estimateTokens(text);
  }

  recordUsage(role, settings.provider, settings.model, reportedIn, reportedOut);
  return text;
}

/** Ask a model for a strict-JSON object. Strips code fences and parses defensively. */
export async function chatJSON<T = unknown>(
  role: RoleKey,
  messages: ChatMessage[],
  onToken?: (delta: string) => void,
): Promise<T> {
  const raw = await chat(role, messages, onToken);
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : raw).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Model did not return JSON');
  return JSON.parse(candidate.slice(start, end + 1)) as T;
}
