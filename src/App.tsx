import { useEffect } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { useStore } from './store';
import { boot } from './lib/webcontainer';
import { Chat } from './components/Chat';
import { FileTree } from './components/FileTree';
import { CodeEditor } from './components/Editor';
import { Preview } from './components/Preview';
import { Terminal } from './components/Terminal';
import { TopBar } from './components/TopBar';
import { CommandPalette } from './components/CommandPalette';
import { Settings } from './components/Settings';
import { Toaster } from './components/Toaster';
import { BootOverlay } from './components/BootOverlay';
import { PipelineDrawer } from './components/pipeline/PipelineDrawer';

/**
 * Top-level layout. Boots the WebContainer on mount, wires the server-ready
 * event to the preview pane, and lays out the resizable panes:
 * chat | files/editor | preview/terminal.
 */
export default function App() {
  const bootStatus = useStore((s) => s.boot);
  const setBoot = useStore((s) => s.setBoot);
  const setPreviewUrl = useStore((s) => s.setPreviewUrl);
  const setPaletteOpen = useStore((s) => s.setPaletteOpen);
  const togglePalette = useStore((s) => s.togglePalette);
  const toggleSettings = useStore((s) => s.toggleSettings);

  // Boot the in-browser WebContainer once on mount.
  useEffect(() => {
    let cancelled = false;
    setBoot('booting');
    boot((port, url) => {
      // vite dev server is up — surface its URL to the preview iframe.
      setPreviewUrl(url);
      useStore.getState().setBoot('dev-running');
    })
      .then(() => {
        if (!cancelled) setBoot('ready');
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e);
          setBoot('error', msg);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [setBoot, setPreviewUrl]);

  // Global keyboard shortcuts: ⌘K / Ctrl+K toggles palette, Escape closes overlays.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const modK = (e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K');
      if (modK) {
        e.preventDefault();
        togglePalette();
        return;
      }
      if (e.key === 'Escape') {
        setPaletteOpen(false);
        toggleSettings(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [togglePalette, setPaletteOpen, toggleSettings]);

  const showTerminal = bootStatus === 'ready' || bootStatus === 'dev-running';
  const showOverlay = bootStatus === 'booting' || bootStatus === 'idle' || bootStatus === 'error';

  return (
    <div className="app-shell">
      <TopBar />

      <Group orientation="horizontal" className="workspace" style={{ flex: 1 }}>
        <Panel defaultSize="22%" minSize="15%" maxSize="45%" className="panel">
          <Chat />
        </Panel>
        <Separator className="resizer" />

        {/* center: files + editor */}
        <Panel minSize="20%" className="panel">
          <Group orientation="horizontal" style={{ height: '100%' }}>
            <Panel defaultSize="16%" minSize="10%" maxSize="40%" className="panel">
              <FileTree />
            </Panel>
            <Separator className="resizer" />
            <Panel minSize="30%" className="panel">
              <CodeEditor />
            </Panel>
          </Group>
        </Panel>
        <Separator className="resizer" />

        {/* right: preview + terminal */}
        <Panel minSize="18%" className="panel">
          <Group orientation="vertical" style={{ height: '100%' }}>
            <Panel minSize="15%" className="panel">
              <Preview />
            </Panel>
            <Separator className="resizer" />
            <Panel defaultSize="34%" minSize="12%" maxSize="70%" className="panel">
              {showTerminal ? <Terminal /> : null}
            </Panel>
          </Group>
        </Panel>
      </Group>

      <CommandPalette />
      <Settings />
      <PipelineDrawer />
      <Toaster />
      {showOverlay ? <BootOverlay /> : null}
    </div>
  );
}
