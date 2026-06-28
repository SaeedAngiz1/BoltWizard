import { useStore } from '../store';
import { PROVIDERS } from '../lib/llm/providers';
import { useResources } from '../lib/pipeline/resources';
import { Zap, Sun, Moon, Settings as SettingsIcon, Command, Brain, Cpu } from 'lucide-react';
import type { BootStatus } from '../store';

const BOOT_LABEL: Record<BootStatus, string> = {
  idle: 'Idle',
  booting: 'Booting…',
  ready: 'Ready',
  'dev-running': 'Dev running',
  error: 'Error',
};

const BOOT_DOT: Record<BootStatus, string> = {
  idle: 'status-dot',
  booting: 'status-dot status-dot--booting',
  ready: 'status-dot status-dot--ready',
  'dev-running': 'status-dot status-dot--ready',
  error: 'status-dot status-dot--error',
};

/** Compact resource monitor pill: total tokens + cost (or "local"). */
function ResourceMonitor() {
  const resources = useResources();
  const setPipelineOpen = useStore((s) => s.setPipelineOpen);
  const totalTokens = resources.totalIn + resources.totalOut;
  const tokenLabel =
    totalTokens >= 1000 ? `${(totalTokens / 1000).toFixed(1)}k` : String(totalTokens);
  const costLabel = resources.totalCost > 0 ? `$${resources.totalCost.toFixed(2)}` : 'local';
  return (
    <button
      type="button"
      className="resource-chip"
      onClick={() => setPipelineOpen(true)}
      aria-label={`Pipeline resources: ${totalTokens} tokens, ${costLabel}`}
      title="Pipeline resource usage — click to open"
    >
      <Cpu size={13} aria-hidden="true" />
      <span className="mono">{tokenLabel}</span>
      <span className="faint" aria-hidden="true">·</span>
      <span className="mono">{costLabel}</span>
    </button>
  );
}

/** Top application bar: brand, boot status pill, provider chip, actions. */
export function TopBar() {
  const boot = useStore((s) => s.boot);
  const theme = useStore((s) => s.theme);
  const settings = useStore((s) => s.settings);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const togglePalette = useStore((s) => s.togglePalette);
  const toggleSettings = useStore((s) => s.toggleSettings);
  const setPipelineOpen = useStore((s) => s.setPipelineOpen);

  const providerLabel = PROVIDERS[settings.provider]?.label ?? settings.provider;
  const isLocal = settings.provider === 'ollama' || settings.provider === 'lmstudio';

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <span className="topbar__mark" aria-hidden="true">
          <Zap size={16} strokeWidth={2.5} />
        </span>
        <span className="topbar__title">BoltGLM</span>
      </div>

      <div className="status-pill" title={`WebContainer: ${BOOT_LABEL[boot]}`}>
        <span className={BOOT_DOT[boot]} />
        <span>{BOOT_LABEL[boot]}</span>
      </div>

      <span className="provider-chip" title="Active LLM provider">
        {providerLabel}
      </span>

      {isLocal && (
        <span className="badge badge--ok local-badge" title="Local-first: code stays on your machine">
          <span className="local-dot" aria-hidden="true" />
          local
        </span>
      )}

      <div className="topbar__spacer" />

      <div className="topbar__actions">
        <ResourceMonitor />

        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => setPipelineOpen(true)}
          aria-label="Open supervised pipeline"
          title="Supervised pipeline"
        >
          <Brain size={15} />
          <span>Supervised</span>
        </button>

        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={togglePalette}
          aria-label="Open command palette"
          title="Command palette (⌘K)"
        >
          <Command size={15} />
          <span className="kbd" aria-hidden="true">⌘K</span>
        </button>

        <button
          type="button"
          className="icon-btn"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          title="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        <button
          type="button"
          className="icon-btn"
          onClick={() => toggleSettings(true)}
          aria-label="Open settings"
          title="Settings"
        >
          <SettingsIcon size={17} />
        </button>
      </div>
    </header>
  );
}
