/**
 * Chat panel — hero empty-state, streaming message log, and prompt input.
 *
 * - Assistant messages render Markdown prose (actions stripped) plus a list of
 *   ActionCards parsed from the raw content.
 * - User messages render as plain-text bubbles.
 * - System messages render as compact mono log rows with a ▶ / exit badge.
 * - A blinking caret shows on the latest assistant message while busy.
 * - Enter sends, Shift+Enter inserts a newline. Disabled while busy or empty.
 */
import { useEffect, useRef, useState } from 'react';
import { Eraser, Send, Settings, Sparkles, Wand2 } from 'lucide-react';
import { useStore, type ChatEntry } from '../store';
import { runAgent, stripActions } from '../lib/agent';
import { parseActions } from '../lib/llm/tools';
import { PROVIDERS } from '../lib/llm/providers';
import Markdown from './Markdown';
import { ActionCard } from './ActionCard';

const EXAMPLES = [
  'Build a Vite + React counter app styled with Tailwind CSS.',
  'Make a todo list app with localStorage persistence and dark mode.',
  'Create a landing page for a SaaS product with a hero and pricing section.',
];

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Render a single chat entry. */
function Message({ msg, isLast, busy }: { msg: ChatEntry; isLast: boolean; busy: boolean }) {
  if (msg.role === 'user') {
    return (
      <div className="msg msg--user">
        <div className="msg__body">{msg.content}</div>
        <div className="msg__time faint">{fmtTime(msg.ts)}</div>
      </div>
    );
  }

  if (msg.role === 'system') {
    // System rows are command/output logs: ▶ prefix, [exit N] suffix.
    const text = msg.content;
    const running = !/\[exit \d+\]/.test(text);
    const exit = /exit (-?\d+)/.exec(text)?.[1];
    const ok = exit !== undefined && exit === '0';
    return (
      <div className="msg msg--system">
        <span className={`badge ${running ? 'badge--run' : ok ? 'badge--ok' : 'badge--err'}`}>
          {running ? '▶' : ok ? '✓' : '✕'}
        </span>
        <pre className="msg__body mono">{text}</pre>
      </div>
    );
  }

  // assistant
  const prose = stripActions(msg.content);
  const actions = parseActions(msg.content);
  const showCaret = busy && isLast;
  return (
    <div className="msg msg--assistant">
      <div className="msg__role">
        <Wand2 size={13} />
        <span>assistant</span>
      </div>
      <div className="msg__body">
        {prose && <Markdown>{prose}</Markdown>}
        {showCaret && !prose && <span className="msg__caret" aria-label="generating" />}
        {actions.length > 0 && (
          <div className="msg__actions">
            {actions.map((a, i) => (
              <ActionCard key={i} action={a} index={i} />
            ))}
          </div>
        )}
        {showCaret && prose && <span className="msg__caret" aria-label="generating" />}
      </div>
      <div className="msg__time faint">{fmtTime(msg.ts)}</div>
    </div>
  );
}

export function Chat() {
  const messages = useStore((s) => s.messages);
  const busy = useStore((s) => s.busy);
  const settings = useStore((s) => s.settings);
  const toggleSettings = useStore((s) => s.toggleSettings);
  const clearChat = useStore((s) => s.clearChat);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom as content streams in.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Auto-grow the textarea up to a cap.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [input]);

  const send = () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    void runAgent(text);
  };

  const providerNeedsKey = PROVIDERS[settings.provider].needsKey && !settings.apiKey;
  const placeholder = providerNeedsKey
    ? 'Add your API key in settings before prompting…'
    : 'Ask the agent to build something…';

  const example = (text: string) => {
    if (busy) return;
    setInput(text);
    taRef.current?.focus();
  };

  return (
    <div className="chat">
      <div className="chat__head">
        <span className="chat__title">
          <Sparkles size={15} />
          <span>Assistant</span>
        </span>
        <div className="chat__actions">
          <button
            className="icon-btn btn--sm"
            onClick={clearChat}
            disabled={messages.length === 0 || busy}
            aria-label="Clear chat"
            title="Clear chat"
          >
            <Eraser size={15} />
          </button>
          <button
            className="icon-btn btn--sm"
            onClick={() => toggleSettings()}
            aria-label="LLM settings"
            title="LLM settings"
          >
            <Settings size={15} />
          </button>
        </div>
      </div>

      <div className="chat__log" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="chat__empty">
            <div className="chat__hero">
              <div className="chat__mark">
                <Sparkles size={26} />
              </div>
              <h2>Build full-stack apps in your browser</h2>
              <p className="muted">
                No local setup. The agent writes files, runs npm, and previews the result live.
              </p>
            </div>
            <div className="chat__examples">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  className="chat__example"
                  onClick={() => example(ex)}
                  disabled={busy}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <Message
              key={m.id}
              msg={m}
              isLast={i === messages.length - 1}
              busy={busy}
            />
          ))
        )}
      </div>

      <div className="chat__input">
        {providerNeedsKey && (
          <div className="chat__hint">
            <span>⚠</span>
            <span>
              The <strong>{PROVIDERS[settings.provider].label}</strong> provider needs an API key.
            </span>
            <button className="btn-link" onClick={() => toggleSettings(true)}>
              Add key
            </button>
          </div>
        )}
        <div className="chat__input-row">
          <textarea
            ref={taRef}
            value={input}
            placeholder={placeholder}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            aria-label="Message the agent"
          />
          <button
            className="btn btn--primary chat__send"
            disabled={busy || !input.trim()}
            onClick={send}
            aria-label="Send message"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default Chat;
