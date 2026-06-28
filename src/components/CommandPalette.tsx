import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { startDevServer } from '../lib/webcontainer';
import {
  Sun,
  Moon,
  Settings as SettingsIcon,
  Play,
  Eraser,
  Wand2,
  Search,
  CornerDownLeft,
} from 'lucide-react';

type Action = {
  id: string;
  label: string;
  hint?: string;
  icon: typeof Sun;
  run: () => void;
};

/** Command palette overlay: ⌘K. Arrow-key navigation + Enter to run. */
export function CommandPalette() {
  const open = useStore((s) => s.paletteOpen);
  const setPaletteOpen = useStore((s) => s.setPaletteOpen);
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const toggleSettings = useStore((s) => s.toggleSettings);
  const clearChat = useStore((s) => s.clearChat);
  const pushToast = useStore((s) => s.pushToast);

  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const actions = useMemo<Action[]>(
    () => [
      {
        id: 'theme',
        label: 'Toggle theme',
        hint: `to ${theme === 'dark' ? 'light' : 'dark'}`,
        icon: theme === 'dark' ? Sun : Moon,
        run: () => toggleTheme(),
      },
      {
        id: 'settings',
        label: 'Open settings',
        icon: SettingsIcon,
        run: () => toggleSettings(true),
      },
      {
        id: 'dev',
        label: 'Run dev server',
        icon: Play,
        run: () => {
          void startDevServer();
          pushToast('info', 'Starting dev server…');
        },
      },
      {
        id: 'clear',
        label: 'Clear chat',
        icon: Eraser,
        run: () => {
          clearChat();
          pushToast('success', 'Chat cleared');
        },
      },
      {
        id: 'prompt',
        label: 'New prompt',
        icon: Wand2,
        run: () => {
          window.dispatchEvent(new CustomEvent('chat:focus'));
        },
      },
    ],
    [theme, toggleTheme, toggleSettings, clearChat, pushToast],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter((a) => a.label.toLowerCase().includes(q));
  }, [actions, query]);

  // Reset state whenever the palette opens/closes.
  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      // focus on next tick so the input is mounted.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Keep active index in bounds as the filtered list changes.
  useEffect(() => {
    if (active > filtered.length - 1) setActive(Math.max(0, filtered.length - 1));
  }, [filtered.length, active]);

  // Scroll the active item into view.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const el = list.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const close = () => setPaletteOpen(false);

  const run = (a: Action) => {
    a.run();
    close();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const a = filtered[active];
      if (a) run(a);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={close} role="presentation">
      <div
        className="palette"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <div className="palette__search">
          <Search size={16} aria-hidden="true" />
          <input
            ref={inputRef}
            className="palette__input"
            placeholder="Type a command…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            aria-label="Search commands"
          />
          <span className="kbd" aria-hidden="true">esc</span>
        </div>

        <div className="palette__list" ref={listRef}>
          {filtered.length === 0 ? (
            <div className="palette__empty muted">No matching commands.</div>
          ) : (
            filtered.map((a, i) => {
              const Icon = a.icon;
              return (
                <button
                  type="button"
                  key={a.id}
                  data-idx={i}
                  className={`palette__item${i === active ? ' palette__item--active' : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => run(a)}
                >
                  <span className="palette__icon">
                    <Icon size={16} />
                  </span>
                  <span className="palette__label">{a.label}</span>
                  {a.hint ? <span className="palette__shortcut muted">{a.hint}</span> : null}
                  {i === active ? (
                    <span className="palette__shortcut" aria-hidden="true">
                      <CornerDownLeft size={13} />
                    </span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
