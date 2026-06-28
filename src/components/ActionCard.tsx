/**
 * Action card — renders a parsed <boltAction> as a styled, collapsible card.
 *
 *   file  → FileCode icon, path as title, collapsible code body.
 *   shell → Terminal icon, command as title, monospace command body.
 *
 * Each card has a copy-to-clipboard button.
 */
import { useState } from 'react';
import { Check, ChevronRight, Copy, FileCode, Terminal as TerminalIcon } from 'lucide-react';
import type { ParsedAction } from '../lib/llm/tools';

type ActionCardProps = {
  action: ParsedAction;
  index: number;
};

export function ActionCard({ action, index }: ActionCardProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const isFile = action.kind === 'file';
  const title = isFile ? (action as Extract<ParsedAction, { kind: 'file' }>).path : 'shell command';
  const body = isFile
    ? (action as Extract<ParsedAction, { kind: 'file' }>).content
    : (action as Extract<ParsedAction, { kind: 'shell' }>).command;

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable */
    }
  };

  const Icon = isFile ? FileCode : TerminalIcon;

  return (
    <div className={`action-card action-card--${action.kind}`}>
      <button
        type="button"
        className="action-card__head"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <Icon size={15} className="action-card__icon" />
        <span className="badge">{isFile ? 'file' : 'shell'}</span>
        <span className="action-card__title mono" title={title}>
          {title}
        </span>
        <span className="faint action-card__index">#{index + 1}</span>
        <ChevronRight
          size={15}
          className="action-card__chevron"
          style={{ transform: open ? 'rotate(90deg)' : 'none' }}
        />
      </button>

      {open && (
        <div className="action-card__body">
          <div className="action-card__code-wrap">
            <pre className="action-card__code">
              <code>{body}</code>
            </pre>
            <button
              type="button"
              className="action-card__copy icon-btn btn--sm"
              onClick={copy}
              aria-label="Copy to clipboard"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ActionCard;
