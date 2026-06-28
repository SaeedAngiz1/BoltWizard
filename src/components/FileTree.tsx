/**
 * File explorer — a real folder TREE synced from the WebContainer VFS.
 *
 * Previously this rendered a flat FILES-only list (directories were filtered
 * out) with no create/delete actions. It now:
 *   - shows folders + files as an expand/collapse tree,
 *   - lets you create files & folders, delete entries, refresh, and
 *   - download the whole project as a .zip.
 *
 * Refreshes on mount and whenever the agent emits a new message.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Download,
  FileCode,
  FilePlus,
  Folder,
  FolderOpen,
  FolderPlus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useStore } from '../store';
import { readTree, writeFile, mkdirp, rm } from '../lib/webcontainer';
import { safePath } from '../lib/safePath';
import { exportProjectAsZip } from '../lib/zip';

type TreeNode = {
  name: string;
  path: string;
  dir: boolean;
  children: Map<string, TreeNode>;
};

/** Build a nested tree from the flat path→isDir map. */
function buildTree(flat: Record<string, boolean>): TreeNode {
  const root: TreeNode = { name: '', path: '', dir: true, children: new Map() };
  for (const p of Object.keys(flat).sort()) {
    const parts = p.split('/');
    let cur = root;
    let acc = '';
    parts.forEach((part, i) => {
      acc = acc ? `${acc}/${part}` : part;
      const isLast = i === parts.length - 1;
      if (!cur.children.has(part)) {
        cur.children.set(part, {
          name: part,
          path: acc,
          dir: isLast ? !!flat[p] : true,
          children: new Map(),
        });
      }
      cur = cur.children.get(part)!;
    });
  }
  return root;
}

export function FileTree() {
  const tree = useStore((s) => s.fileTree);
  const messagesLen = useStore((s) => s.messages.length);
  const setFileTree = useStore((s) => s.setFileTree);
  const activeTab = useStore((s) => s.activeTab);
  const openTab = useStore((s) => s.openTab);
  const pushToast = useStore((s) => s.pushToast);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const refresh = async () => {
    try {
      setFileTree(await readTree('.'));
    } catch {
      pushToast('error', 'Could not read file tree');
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messagesLen, setFileTree]);

  const root = useMemo(() => buildTree(tree), [tree]);

  const toggle = (path: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });

  const askName = (label: string): string | null => {
    const v = window.prompt(`${label} (relative path, e.g. src/components/Button.tsx)`);
    return v && v.trim() ? v.trim() : null;
  };

  const newFile = async () => {
    const input = askName('New file');
    if (!input) return;
    const path = safePath(input);
    if (!path) return pushToast('error', `Unsafe path: ${input}`);
    try {
      await mkdirp(path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '.');
      await writeFile(path, '');
      await refresh();
      openTab(path);
      pushToast('success', `Created ${path}`);
    } catch (e) {
      pushToast('error', `Could not create file: ${e instanceof Error ? e.message : e}`);
    }
  };

  const newFolder = async () => {
    const input = askName('New folder');
    if (!input) return;
    const path = safePath(input);
    if (!path) return pushToast('error', `Unsafe path: ${input}`);
    try {
      await mkdirp(path);
      await refresh();
      pushToast('success', `Created folder ${path}`);
    } catch (e) {
      pushToast('error', `Could not create folder: ${e instanceof Error ? e.message : e}`);
    }
  };

  const remove = async (path: string, dir: boolean) => {
    if (!window.confirm(`Delete ${dir ? 'folder' : 'file'} "${path}"?`)) return;
    try {
      await rm(path);
      await refresh();
      pushToast('info', `Deleted ${path}`);
    } catch (e) {
      pushToast('error', `Could not delete: ${e instanceof Error ? e.message : e}`);
    }
  };

  const download = async () => {
    try {
      const n = await exportProjectAsZip('project');
      pushToast('success', `Downloaded ${n} entries as project.zip`);
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : String(e));
    }
  };

  const renderNode = (node: TreeNode, depth: number): ReactNode => {
    // Sort: folders first, then files, alphabetically.
    const kids = [...node.children.values()].sort((a, b) => {
      if (a.dir !== b.dir) return a.dir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return kids.map((child) => {
      const isCollapsed = collapsed.has(child.path);
      const active = child.path === activeTab;
      const pad = { paddingLeft: 8 + depth * 14 };
      if (child.dir) {
        return (
          <div key={child.path}>
            <div className="file-row file-row--dir" style={pad}>
              <button
                type="button"
                className="file-row__chev"
                aria-label={isCollapsed ? 'Expand' : 'Collapse'}
                onClick={() => toggle(child.path)}
              >
                {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
              </button>
              {isCollapsed ? <Folder size={14} aria-hidden="true" /> : <FolderOpen size={14} aria-hidden="true" />}
              <span className="truncate" onClick={() => toggle(child.path)}>{child.name}</span>
              <button
                type="button"
                className="file-row__del"
                aria-label={`Delete ${child.path}`}
                title="Delete"
                onClick={() => void remove(child.path, true)}
              >
                <Trash2 size={12} />
              </button>
            </div>
            {!isCollapsed && renderNode(child, depth + 1)}
          </div>
        );
      }
      return (
        <div
          key={child.path}
          className={`file-row ${active ? 'file-row--active' : ''}`}
          style={pad}
          title={child.path}
          onClick={() => openTab(child.path)}
        >
          <span className="file-row__fileicon"><FileCode size={14} aria-hidden="true" /></span>
          <span className="truncate">{child.name}</span>
          <button
            type="button"
            className="file-row__del"
            aria-label={`Delete ${child.path}`}
            title="Delete"
            onClick={(e) => {
              e.stopPropagation();
              void remove(child.path, false);
            }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      );
    });
  };

  const isEmpty = root.children.size === 0;

  return (
    <div className="file-tree">
      <div className="file-tree__head">
        <span className="pane__title">EXPLORER</span>
        <div className="pane__actions">
          <button type="button" className="icon-btn" aria-label="New file" title="New file" onClick={() => void newFile()}>
            <FilePlus size={14} aria-hidden="true" />
          </button>
          <button type="button" className="icon-btn" aria-label="New folder" title="New folder" onClick={() => void newFolder()}>
            <FolderPlus size={14} aria-hidden="true" />
          </button>
          <button type="button" className="icon-btn" aria-label="Download project" title="Download .zip" onClick={() => void download()}>
            <Download size={14} aria-hidden="true" />
          </button>
          <button type="button" className="icon-btn" aria-label="Refresh file tree" title="Refresh" onClick={() => void refresh()}>
            <RefreshCw size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      {isEmpty ? (
        <div className="file-tree__empty muted">
          No files yet. Use <strong>New file</strong> / <strong>New folder</strong> above, or ask the agent to build something.
        </div>
      ) : (
        <div className="file-tree__list">{renderNode(root, 0)}</div>
      )}
    </div>
  );
}

export default FileTree;
