/**
 * Global app state (zustand). Single source of truth shared by every cluster:
 * chat, boot/preview status, editor tabs, settings, theme, toasts, palette, and
 * the supervised multi-agent pipeline (referent / coder / guardian).
 */
import { create } from 'zustand';
import type { LlmSettings } from './lib/llm/providers';
import { loadSettings, saveSettings } from './lib/llm/providers';
import type { RolesConfig, RoleConfig } from './lib/pipeline/roles';
import { loadRoles, saveRoles } from './lib/pipeline/roles';
import type {
  PipelinePhase,
  PIF,
  PIFTask,
  GuardianFinding,
  ApprovalRequest,
  NegativeConstraint,
  RoleKey,
  TaskStatus,
} from './lib/pipeline/types';

export type ChatRole = 'user' | 'assistant' | 'system';
export type ChatEntry = { id: string; role: ChatRole; content: string; ts: number };

export type BootStatus = 'idle' | 'booting' | 'ready' | 'dev-running' | 'error';

export type Theme = 'dark' | 'light';
export type ToastKind = 'success' | 'error' | 'info';
export type Toast = { id: string; kind: ToastKind; message: string; ts: number };

export type Tab = { path: string; dirty: boolean };

const THEME_KEY = 'boltglm.theme';

export function loadTheme(): Theme {
  return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
}
export function applyTheme(t: Theme): void {
  document.documentElement.dataset.theme = t;
}

type State = {
  // runtime
  boot: BootStatus;
  bootError: string | null;
  previewUrl: string | null;
  busy: boolean;

  // chat
  messages: ChatEntry[];

  // editor
  fileTree: Record<string, boolean>;
  tabs: Tab[];
  activeTab: string | null;

  // llm settings
  settings: LlmSettings;
  settingsOpen: boolean;

  // theme + toasts + palette
  theme: Theme;
  toasts: Toast[];
  paletteOpen: boolean;

  // ---- supervised pipeline ----
  pipelineOpen: boolean;
  roles: RolesConfig;
  maxIterations: number;
  phase: PipelinePhase;
  pif: PIF | null;
  tasks: PIFTask[];
  findings: GuardianFinding[];
  pendingApproval: ApprovalRequest | null;
  negatives: NegativeConstraint[];

  // ---- actions ----
  setBoot: (s: BootStatus, err?: string | null) => void;
  setPreviewUrl: (u: string | null) => void;
  addMessage: (role: ChatRole, content: string) => string;
  appendToMessage: (id: string, delta: string) => void;
  clearChat: () => void;
  setBusy: (b: boolean) => void;

  setFileTree: (t: Record<string, boolean>) => void;
  openTab: (path: string) => void;
  closeTab: (path: string) => void;
  setActiveTab: (path: string) => void;
  markDirty: (path: string, dirty: boolean) => void;

  setSettings: (s: Partial<LlmSettings>) => void;
  toggleSettings: (open?: boolean) => void;

  toggleTheme: () => void;

  pushToast: (kind: ToastKind, message: string) => string;
  dismissToast: (id: string) => void;

  setPaletteOpen: (open: boolean) => void;
  togglePalette: () => void;

  // pipeline actions
  setPipelineOpen: (open: boolean) => void;
  setRole: (role: RoleKey, patch: Partial<RoleConfig>) => void;
  setMaxIterations: (n: number) => void;
  setPhase: (p: PipelinePhase) => void;
  setPif: (p: PIF | null) => void;
  setTasks: (t: PIFTask[]) => void;
  upsertTask: (t: PIFTask) => void;
  setTaskStatus: (id: string, status: TaskStatus, guardianNotes?: string) => void;
  appendTaskLog: (id: string, entry: PIFTask['log'][number]) => void;
  setFindings: (f: GuardianFinding[]) => void;
  setPendingApproval: (req: ApprovalRequest | null) => void;
  setNegatives: (n: NegativeConstraint[]) => void;
  resetPipeline: () => void;
};

let seq = 0;
const uid = () => `${Date.now().toString(36)}-${++seq}`;

const baseSettings = loadSettings();

export const useStore = create<State>((set, get) => ({
  boot: 'idle',
  bootError: null,
  previewUrl: null,
  busy: false,
  messages: [],
  fileTree: {},
  tabs: [],
  activeTab: null,
  settings: baseSettings,
  settingsOpen: false,
  theme: loadTheme(),
  toasts: [],
  paletteOpen: false,

  pipelineOpen: false,
  roles: loadRoles(baseSettings),
  maxIterations: 3,
  phase: 'idle',
  pif: null,
  tasks: [],
  findings: [],
  pendingApproval: null,
  negatives: [],

  setBoot: (s, err = null) => set({ boot: s, bootError: err }),
  setPreviewUrl: (u) => set({ previewUrl: u }),
  addMessage: (role, content) => {
    const id = uid();
    set((st) => ({ messages: [...st.messages, { id, role, content, ts: Date.now() }] }));
    return id;
  },
  appendToMessage: (id, delta) =>
    set((st) => ({
      messages: st.messages.map((m) =>
        m.id === id ? { ...m, content: m.content + delta } : m,
      ),
    })),
  clearChat: () => set({ messages: [] }),
  setBusy: (b) => set({ busy: b }),

  setFileTree: (t) => set({ fileTree: t }),
  openTab: (path) =>
    set((st) => ({
      tabs: st.tabs.some((t) => t.path === path) ? st.tabs : [...st.tabs, { path, dirty: false }],
      activeTab: path,
    })),
  closeTab: (path) =>
    set((st) => {
      const idx = st.tabs.findIndex((t) => t.path === path);
      const tabs = st.tabs.filter((t) => t.path !== path);
      let activeTab = st.activeTab;
      if (st.activeTab === path) {
        activeTab = tabs.length ? tabs[Math.max(0, idx - 1)].path : null;
      }
      return { tabs, activeTab };
    }),
  setActiveTab: (path) => set({ activeTab: path }),
  markDirty: (path, dirty) =>
    set((st) => ({ tabs: st.tabs.map((t) => (t.path === path ? { ...t, dirty } : t)) })),

  setSettings: (s) => {
    const next = { ...get().settings, ...s };
    saveSettings(next);
    set({ settings: next });
  },
  toggleSettings: (open) => set((st) => ({ settingsOpen: open ?? !st.settingsOpen })),

  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
    set({ theme: next });
  },

  pushToast: (kind, message) => {
    const id = uid();
    set((st) => ({ toasts: [...st.toasts, { id, kind, message, ts: Date.now() }] }));
    return id;
  },
  dismissToast: (id) => set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) })),

  setPaletteOpen: (open) => set({ paletteOpen: open }),
  togglePalette: () => set((st) => ({ paletteOpen: !st.paletteOpen })),

  // ---- pipeline ----
  setPipelineOpen: (open) => set({ pipelineOpen: open }),
  setRole: (role, patch) =>
    set((st) => {
      const roles = { ...st.roles, [role]: { ...st.roles[role], ...patch } };
      saveRoles(roles);
      return { roles };
    }),
  setMaxIterations: (n) => set({ maxIterations: Math.max(1, Math.min(10, Math.round(n))) }),
  setPhase: (p) => set({ phase: p }),
  setPif: (p) => set({ pif: p }),
  setTasks: (t) => set({ tasks: t }),
  upsertTask: (t) =>
    set((st) => {
      const idx = st.tasks.findIndex((x) => x.id === t.id);
      const tasks = idx === -1 ? [...st.tasks, t] : st.tasks.map((x) => (x.id === t.id ? t : x));
      return { tasks };
    }),
  setTaskStatus: (id, status, guardianNotes) =>
    set((st) => ({
      tasks: st.tasks.map((t) =>
        t.id === id ? { ...t, status, ...(guardianNotes !== undefined ? { guardianNotes } : {}) } : t,
      ),
    })),
  appendTaskLog: (id, entry) =>
    set((st) => ({
      tasks: st.tasks.map((t) => (t.id === id ? { ...t, log: [...t.log, entry] } : t)),
    })),
  setFindings: (f) => set({ findings: f }),
  setPendingApproval: (req) => set({ pendingApproval: req }),
  setNegatives: (n) => set({ negatives: n }),
  resetPipeline: () =>
    set({
      phase: 'idle',
      pif: null,
      tasks: [],
      findings: [],
      pendingApproval: null,
    }),
}));
