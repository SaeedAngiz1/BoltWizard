/**
 * Toaster — fixed bottom-right stack of transient notifications.
 *
 * Each toast auto-dismisses after 4s. To keep timers stable across re-renders
 * (and avoid re-setting them on every store update) we delegate the
 * per-toast timer to a dedicated <ToastRow> that keys off the toast id.
 */
import { useEffect } from 'react';
import { CircleCheck, CircleAlert, Info, X } from 'lucide-react';
import { useStore, type Toast, type ToastKind } from '../store';

const ICONS: Record<ToastKind, typeof CircleCheck> = {
  success: CircleCheck,
  error: CircleAlert,
  info: Info,
};

const CLASS_BY_KIND: Record<ToastKind, string> = {
  success: 'toast--success',
  error: 'toast--error',
  info: 'toast--info',
};

function ToastRow({ toast }: { toast: Toast }) {
  const dismiss = useStore((s) => s.dismissToast);
  const Icon = ICONS[toast.kind];

  // Auto-dismiss once per toast; keyed by toast.ts so effect runs a single time.
  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(toast.id), 4000);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.ts, dismiss]);

  return (
    <div className={`toast ${CLASS_BY_KIND[toast.kind]}`} role={toast.kind === 'error' ? 'alert' : 'status'}>
      <span className="toast__icon">
        <Icon aria-hidden="true" />
      </span>
      <span className="toast__msg">{toast.message}</span>
      <button
        type="button"
        className="toast__close"
        aria-label="Dismiss notification"
        onClick={() => dismiss(toast.id)}
      >
        <X aria-hidden="true" />
      </button>
    </div>
  );
}

export function Toaster() {
  const toasts = useStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="toaster" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <ToastRow key={t.id} toast={t} />
      ))}
    </div>
  );
}

export default Toaster;
