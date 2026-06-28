/**
 * Multi-tab Monaco editor bound to the WebContainer VFS.
 *
 * Tabs + activeTab come from the store. When the active tab changes we read its
 * file content from the container and populate the editor. Edits mark the tab
 * dirty; Ctrl/Cmd+S persists back to the VFS, clears the dirty flag and toasts.
 *
 * The monaco instance is captured via onMount so we can use monaco.KeyMod /
 * KeyCode constants rather than guessing numeric key codes.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { FileCode, X } from 'lucide-react';
import { useStore } from '../store';
import { readFile, writeFile } from '../lib/webcontainer';

const basename = (p: string) => p.split('/').pop() ?? p;

export function CodeEditor() {
  const tabs = useStore((s) => s.tabs);
  const activeTab = useStore((s) => s.activeTab);
  const theme = useStore((s) => s.theme);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const closeTab = useStore((s) => s.closeTab);
  const markDirty = useStore((s) => s.markDirty);
  const pushToast = useStore((s) => s.pushToast);

  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  // Load the active file's content whenever the active tab changes.
  useEffect(() => {
    let cancelled = false;
    if (!activeTab) {
      setContent('');
      return;
    }
    setLoading(true);
    readFile(activeTab)
      .then((text) => {
        if (!cancelled) {
          setContent(text);
          markDirty(activeTab, false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setContent('');
          pushToast('error', `Could not read ${activeTab}`);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, markDirty, pushToast]);

  const save = useCallback(async () => {
    const path = useStore.getState().activeTab;
    const ed = editorRef.current;
    if (!path || !ed) return;
    try {
      await writeFile(path, ed.getValue());
      markDirty(path, false);
      pushToast('success', `Saved ${basename(path)}`);
    } catch {
      pushToast('error', `Failed to save ${basename(path)}`);
    }
  }, [markDirty, pushToast]);

  const handleMount: OnMount = useCallback(
    (ed, monaco) => {
      editorRef.current = ed;
      ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        void save();
      });
    },
    [save],
  );

  const handleChange = useCallback(
    (value: string | undefined) => {
      setContent(value ?? '');
      if (activeTab) markDirty(activeTab, true);
    },
    [activeTab, markDirty],
  );

  const monacoTheme = theme === 'dark' ? 'vs-dark' : 'light';

  return (
    <div className="editor">
      {tabs.length > 0 && (
        <div className="editor__tabs" role="tablist" aria-label="Open files">
          {tabs.map((tab) => {
            const active = tab.path === activeTab;
            return (
              <button
                key={tab.path}
                type="button"
                role="tab"
                aria-selected={active}
                className={`editor__tab ${active ? 'editor__tab--active' : ''}`}
                onClick={() => setActiveTab(tab.path)}
                title={tab.path}
              >
                <FileCode className="file-row__icon" size={13} aria-hidden="true" />
                <span className="truncate">{basename(tab.path)}</span>
                {tab.dirty ? (
                  <span className="editor__dirty" aria-label="Unsaved changes" />
                ) : (
                  <span
                    className="editor__close"
                    role="button"
                    tabIndex={0}
                    aria-label={`Close ${basename(tab.path)}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.path);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        closeTab(tab.path);
                      }
                    }}
                  >
                    <X size={13} aria-hidden="true" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {activeTab ? (
        <div className="editor__body">
          {loading && <div className="sr-only">Loading file…</div>}
          <Editor
            key={activeTab}
            theme={monacoTheme}
            path={activeTab}
            value={content}
            onChange={handleChange}
            onMount={handleMount}
            loading={null}
            options={{
              fontSize: 13,
              fontVariations: "'wght' 450",
              minimap: { enabled: false },
              smoothScrolling: true,
              automaticLayout: true,
              scrollBeyondLastLine: false,
              renderLineHighlight: 'all',
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              padding: { top: 12, bottom: 12 },
              tabSize: 2,
              lineNumbersMinChars: 3,
              scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
            }}
          />
        </div>
      ) : (
        <div className="editor__empty">
          <FileCode size={28} aria-hidden="true" />
          <p>No file open</p>
          <span className="muted">Pick a file from the explorer to start editing</span>
        </div>
      )}
    </div>
  );
}

export default CodeEditor;
