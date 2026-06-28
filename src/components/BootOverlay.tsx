import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { boot } from '../lib/webcontainer';
import { Zap, Loader2, RotateCcw, CircleAlert } from 'lucide-react';

/** Full-screen premium boot overlay while the WebContainer spins up, or on error. */
export function BootOverlay() {
  const bootStatus = useStore((s) => s.boot);
  const bootError = useStore((s) => s.bootError);
  const setBoot = useStore((s) => s.setBoot);
  const setPreviewUrl = useStore((s) => s.setPreviewUrl);
  const [retrying, setRetrying] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);
  const retryBtnRef = useRef<HTMLButtonElement>(null);

  const isError = bootStatus === 'error';

  // Move focus to the Retry button when entering the error state, and reset
  // the "retry did not recover" hint whenever we leave the error state.
  useEffect(() => {
    if (bootStatus !== 'error') {
      setRetryFailed(false);
      return;
    }
    // Defer to next frame so the button is mounted before we focus it.
    requestAnimationFrame(() => retryBtnRef.current?.focus());
  }, [bootStatus]);

  const retry = () => {
    setRetrying(true);
    setBoot('booting');
    boot((port, url) => {
      setPreviewUrl(url);
      useStore.getState().setBoot('dev-running');
    })
      .then(() => {
        setBoot('ready');
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        setBoot('error', msg);
        // @webcontainer/api typically allows only one boot per page load, so
        // if a retry does not recover, surface guidance to reload the page.
        setRetryFailed(true);
      })
      .finally(() => setRetrying(false));
  };

  return (
    <div
      className="boot-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Booting WebContainer"
      aria-live={isError ? 'assertive' : 'polite'}
    >
      <div className="boot-card">
        <div className="boot-mark" aria-hidden="true">
          <Zap size={30} strokeWidth={2.5} />
        </div>

        {isError ? (
          <>
            <h1 className="boot-title boot-title--error">
              <CircleAlert size={20} />
              Boot failed
            </h1>
            <p className="boot-sub">
              {bootError ?? 'The WebContainer could not start.'}
            </p>
            <button
              type="button"
              ref={retryBtnRef}
              className="btn btn--primary"
              onClick={retry}
              disabled={retrying}
            >
              {retrying ? <Loader2 size={15} className="spin" /> : <RotateCcw size={15} />}
              {retrying ? 'Retrying…' : 'Retry boot'}
            </button>
            {retryFailed && (
              <p className="boot-sub faint">
                A WebContainer can usually boot only once per page load. If retry
                does not recover, please <strong>reload the page</strong> to start fresh.
              </p>
            )}
          </>
        ) : (
          <>
            <h1 className="boot-title">Booting BoltWizard</h1>
            <p className="boot-sub">Spinning up your in-browser WebContainer…</p>
            <div className="boot-steps">
              <div className="boot-step">
                <Loader2 size={14} className="spin" />
                <span>Mounting virtual filesystem</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
