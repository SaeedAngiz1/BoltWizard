/**
 * xterm wired to an in-container `jsh` shell — full interactive terminal.
 *
 * Mounts once the WebContainer is ready (boot === 'ready' or 'dev-running').
 *
 * IMPORTANT: xterm's Viewport reads `_renderService.dimensions` during open(),
 * which throws `Cannot read properties of undefined (reading 'dimensions')` if
 * the container has no layout yet (a common React+xterm race). We therefore
 * defer term.open() to the next animation frame and retry until the element
 * reports real dimensions before initialising the terminal.
 */
import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { startShell, type ShellHandle } from '../lib/webcontainer';
import { useStore } from '../store';

export function Terminal() {
  const ref = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const shellRef = useRef<ShellHandle | null>(null);
  const boot = useStore((s) => s.boot);

  useEffect(() => {
    if (boot !== 'ready' && boot !== 'dev-running') return;
    if (!ref.current || termRef.current) return;

    const term = new XTerm({
      convertEol: true,
      fontSize: 13,
      fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
      cursorBlink: true,
      cursorStyle: 'bar',
      allowProposedApi: true,
      theme: {
        background: '#0000',
        foreground: '#e6e9ef',
        cursor: '#7c5cff',
        selectionBackground: 'rgba(124,92,255,.3)',
      },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);

    let alive = true;
    let rafId = 0;

    const attachShell = () => {
      startShell(term.cols, term.rows)
        .then((shell) => {
          if (!alive) {
            void shell.input.close();
            return;
          }
          shellRef.current = shell;
          term.onData((data) => {
            void shell.input.write(data);
          });
          shell.output
            .pipeTo(new WritableStream({ write: (chunk) => term.write(chunk) }))
            .catch(() => {
              /* stream closed */
            });
        })
        .catch((e: unknown) => {
          const msg = e instanceof Error ? e.message : String(e);
          term.writeln(`\x1b[31mshell error: ${msg}\x1b[0m`);
        });
    };

    // Retry each frame until the container has real dimensions, then open.
    // Opening into a 0-size element leaves _renderService undefined and throws.
    const openWhenReady = () => {
      const el = ref.current;
      if (!alive || !el) return;
      if (el.clientWidth === 0 || el.clientHeight === 0) {
        rafId = requestAnimationFrame(openWhenReady);
        return;
      }
      try {
        term.open(el);
      } catch {
        rafId = requestAnimationFrame(openWhenReady);
        return;
      }
      termRef.current = term;
      try {
        fit.fit();
      } catch {
        /* container not laid out yet — the resize handler will retry */
      }
      term.writeln('\x1b[38;2;124;92;255m●\x1b[0m shell ready — type a command\r\n');
      attachShell();
    };
    rafId = requestAnimationFrame(openWhenReady);

    const onResize = () => {
      if (!termRef.current) return;
      try {
        fit.fit();
        const shell = shellRef.current;
        if (shell) void shell.resize(term.cols, term.rows);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('resize', onResize);

    return () => {
      alive = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      const shell = shellRef.current;
      if (shell) {
        void shell.input.close().catch(() => {
          /* input already closed */
        });
      }
      try {
        term.dispose();
      } catch {
        /* ignore */
      }
      termRef.current = null;
      shellRef.current = null;
    };
  }, [boot]);

  return (
    <div className="terminal">
      <div className="terminal__xterm" ref={ref} />
    </div>
  );
}

export default Terminal;
