/**
 * Live app preview rendered from the WebContainer dev-server URL.
 *
 * The browser-reachable URL is delivered by the WebContainer `server-ready`
 * event (wired in App.tsx) — NOT vite's `localhost:PORT` banner, which is the
 * sandbox's internal address and would otherwise load the editor itself.
 *
 * Because the sandbox runs in the user's browser (which we can't observe
 * directly), this panel is self-diagnosing: it shows the live dev-server output
 * (npm install / vite / errors) and a cross-origin-isolation check, so a blank
 * preview always explains *why*.
 */
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ExternalLink, Eye, Play, RefreshCw, Sparkles } from 'lucide-react';
import { useStore } from '../store';
import { startDevServer, readTree } from '../lib/webcontainer';
import { writeStarterApp } from '../lib/starter';

// "server is up" signal from vite's banner (internal address — NOT used as src).
const URL_RE = /https?:\/\/(?:localhost|127\.0\.0\.1):\d+/;
// Strip ANSI/VT colour escapes from terminal output.
const ANSI_RE = /\x1b\[[0-9;]*[A-Za-z]/g;

export function Preview() {
  const url = useStore((s) => s.previewUrl);
  const boot = useStore((s) => s.boot);
  const setBoot = useStore((s) => s.setBoot);
  const pushToast = useStore((s) => s.pushToast);

  const [reloadKey, setReloadKey] = useState(0);
  const [starting, setStarting] = useState(false);
  const [log, setLog] = useState('');

  // WebContainer requires cross-origin isolation. If it's off, nothing can run.
  const isolated = typeof window !== 'undefined' && window.crossOriginIsolated;

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const runDev = useCallback(async () => {
    if (starting) return;
    if (!isolated) {
      pushToast(
        'error',
        'Cross-origin isolation is OFF — the sandbox cannot run. Serve the app with "npm run dev" and use Chrome/Edge.',
      );
      return;
    }
    setStarting(true);
    setLog('');
    setBoot('dev-running');
    pushToast('info', 'Starting dev server…');
    const logId = useStore.getState().addMessage('system', '▶ starting dev server…\n');
    let shown = 0;
    const MAX = 6000;
    const watchdog = setTimeout(() => {
      if (!useStore.getState().previewUrl) {
        pushToast('error', 'Dev server did not report a URL in time. See the preview log for errors.');
        useStore.getState().setBoot('ready');
      }
    }, 90_000);
    try {
      await startDevServer((chunk) => {
        const clean = chunk.replace(ANSI_RE, '');
        if (shown < MAX) {
          const slice = clean.slice(0, MAX - shown);
          shown += slice.length;
          useStore.getState().appendToMessage(logId, slice);
          setLog((prev) => (prev + slice).slice(-4000));
        }
        if (URL_RE.test(clean)) {
          clearTimeout(watchdog);
          useStore.getState().appendToMessage(logId, `\n✓ dev server is up — loading preview…`);
          setLog((prev) => prev + '\n✓ dev server is up — waiting for preview URL…');
        }
      });
    } catch (e) {
      clearTimeout(watchdog);
      const msg = e instanceof Error ? e.message : String(e);
      pushToast('error', msg);
      useStore.getState().appendToMessage(logId, `\n⚠️ ${msg}`);
      setLog((prev) => prev + `\n⚠️ ${msg}`);
      useStore.getState().setBoot('ready');
    } finally {
      setStarting(false);
    }
  }, [starting, setBoot, pushToast, isolated]);

  /** Write a minimal Vite+React starter into the sandbox, then run the dev server. */
  const createStarter = useCallback(async () => {
    if (!isolated) {
      pushToast('error', 'Cross-origin isolation is OFF — the sandbox cannot run.');
      return;
    }
    pushToast('info', 'Creating starter app…');
    const logId = useStore.getState().addMessage('system', '▶ creating starter app…\n');
    setLog('creating starter app…\n');
    try {
      const files = await writeStarterApp();
      useStore.getState().setFileTree(await readTree('.'));
      useStore.getState().appendToMessage(logId, `\n✓ wrote ${files.length} files. Starting dev server…\n`);
      setLog((prev) => prev + `✓ wrote ${files.length} files. Starting dev server…\n`);
      await runDev();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      pushToast('error', msg);
      useStore.getState().appendToMessage(logId, `\n⚠️ ${msg}`);
      setLog((prev) => prev + `\n⚠️ ${msg}`);
    }
  }, [pushToast, runDev, isolated]);

  // Re-mount iframe when the URL changes.
  useEffect(() => {
    setReloadKey((k) => k + 1);
  }, [url]);

  const busy = boot === 'dev-running' || starting;

  return (
    <div className="preview">
      <div className="preview__bar">
        <div className="preview__url" title={url ?? undefined}>
          {url ? <span className="mono truncate">{url}</span> : <span className="muted">No preview URL</span>}
        </div>
        <div className="pane__actions">
          <button
            type="button"
            className="icon-btn"
            aria-label="Reload preview"
            title="Reload"
            onClick={reload}
            disabled={!url}
          >
            <RefreshCw size={14} aria-hidden="true" />
          </button>
          <a
            className="icon-btn"
            href={url ?? '#'}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="Open in new tab"
            title="Open in new tab"
            aria-disabled={!url}
            onClick={(e) => {
              if (!url) e.preventDefault();
            }}
          >
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        </div>
      </div>

      {url ? (
        <iframe
          key={reloadKey}
          className="preview__frame"
          src={url}
          title="Application preview"
          sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin"
        />
      ) : (
        <div className="preview__empty">
          <Eye size={26} aria-hidden="true" />
          <p className="preview__title">{busy ? 'Dev server starting…' : 'No preview yet'}</p>

          {!isolated && (
            <div className="preview__warn">
              <AlertTriangle size={15} aria-hidden="true" />
              <span>
                <strong>Cross-origin isolation is OFF</strong> — the in-browser sandbox cannot run.
                Start the app with <code>npm run dev</code> (serves the required COOP/COEP headers)
                and use <strong>Chrome or Edge</strong>. Opening the built files directly will not work.
              </span>
            </div>
          )}

          {log && (
            <pre className="preview__log" aria-label="Dev server output">{log}</pre>
          )}

          {!busy && (
            <div className="preview__actions">
              <button type="button" className="btn btn--primary" onClick={() => void runDev()} disabled={!isolated}>
                <Play size={14} aria-hidden="true" />
                Run dev server
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => void createStarter()} disabled={!isolated}>
                <Sparkles size={14} aria-hidden="true" />
                Create starter app
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Preview;
