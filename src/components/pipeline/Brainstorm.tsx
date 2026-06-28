/**
 * Brainstorm — referent dialogue + PIF generation entry point.
 *
 * Reuses the app's .msg / .msg--user / .msg--assistant message styling so the
 * pipeline chat feels native. When the dialogue is empty it shows a "Begin"
 * prompt that seeds startBrainstorm(idea); otherwise it shows the running
 * dialogue plus a Send input (continueBrainstorm). A "Generate PIF" primary
 * button appears once the referent has replied at least once.
 */
import { useEffect, useRef, useState } from 'react';
import { Brain, Send, Sparkles, Wand2 } from 'lucide-react';
import { useStore } from '../../store';
import { startBrainstorm, continueBrainstorm, generatePlan } from '../../lib/pipeline/pipeline';

const SEED_EXAMPLES = [
  'A markdown note app with tags and full-text search.',
  'A pomodoro timer with stats and ambient sounds.',
  'A personal expense tracker with charts and CSV export.',
];

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function BeginPrompt({ busy }: { busy: boolean }) {
  const [idea, setIdea] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [idea]);

  const begin = () => {
    const text = idea.trim();
    if (!text || busy) return;
    void startBrainstorm(text);
  };

  return (
    <div className="brainstorm__begin">
      <div className="brainstorm__hero">
        <div className="brainstorm__mark">
          <Brain size={26} />
        </div>
        <h3>Brainstorm with the Referent</h3>
        <p className="muted">
          Describe what you want to build. The referent will ask clarifying questions and then author a
          Project Instruction File for the coder.
        </p>
      </div>

      <div className="brainstorm__seed">
        {SEED_EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            className="brainstorm__seedchip"
            disabled={busy}
            onClick={() => setIdea(ex)}
          >
            {ex}
          </button>
        ))}
      </div>

      <div className="brainstorm__inputrow">
        <textarea
          ref={taRef}
          className="brainstorm__textarea"
          value={idea}
          rows={1}
          placeholder="Describe your project idea…"
          onChange={(e) => setIdea(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              begin();
            }
          }}
          aria-label="Project idea"
        />
        <button
          type="button"
          className="btn btn--primary"
          onClick={begin}
          disabled={busy || !idea.trim()}
        >
          <Sparkles size={15} aria-hidden="true" />
          Begin
        </button>
      </div>
    </div>
  );
}

function Dialogue({ busy }: { busy: boolean }) {
  const messages = useStore((s) => s.messages);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [input]);

  const send = () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    void continueBrainstorm(text);
  };

  const hasAssistantReply = messages.some((m) => m.role === 'assistant');

  return (
    <div className="brainstorm__dialogue">
      <div className="brainstorm__log" ref={scrollRef}>
        {messages.map((m, i) => {
          if (m.role === 'user') {
            return (
              <div className="msg msg--user" key={m.id}>
                <div className="msg__body">{m.content}</div>
                <div className="msg__time faint">{fmtTime(m.ts)}</div>
              </div>
            );
          }
          if (m.role === 'system') {
            return (
              <div className="msg msg--system" key={m.id}>
                <pre className="msg__body mono">{m.content}</pre>
              </div>
            );
          }
          return (
            <div className="msg msg--assistant" key={m.id}>
              <div className="msg__role">
                <Wand2 size={13} />
                <span>referent</span>
              </div>
              <div className="msg__body">
                {m.content}
                {busy && i === messages.length - 1 && <span className="msg__caret" aria-label="generating" />}
              </div>
              <div className="msg__time faint">{fmtTime(m.ts)}</div>
            </div>
          );
        })}
      </div>

      <div className="brainstorm__footer">
        {hasAssistantReply && (
          <button
            type="button"
            className="btn btn--primary brainstorm__genpif"
            onClick={() => void generatePlan()}
            disabled={busy}
          >
            <Wand2 size={15} aria-hidden="true" />
            Generate PIF
          </button>
        )}
        <div className="brainstorm__inputrow">
          <textarea
            ref={taRef}
            className="brainstorm__textarea"
            value={input}
            rows={1}
            placeholder="Reply to the referent…"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            aria-label="Message the referent"
          />
          <button
            type="button"
            className="btn btn--primary"
            onClick={send}
            disabled={busy || !input.trim()}
            aria-label="Send message"
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Brainstorm() {
  const messages = useStore((s) => s.messages);
  const busy = useStore((s) => s.busy);

  return (
    <div className="brainstorm">
      {messages.length === 0 ? <BeginPrompt busy={busy} /> : <Dialogue busy={busy} />}
    </div>
  );
}

export default Brainstorm;
