# bolt-glm

A browser-based, full-stack AI development agent — a self-hostable [bolt.new](https://bolt.new)-style workspace.
Describe an app in chat, and a local or cloud LLM writes the files, installs dependencies, and runs a live
preview — **entirely in your browser**, powered by [WebContainers](https://webcontainers.io). No local Node
toolchain, no server backend, no uploads.

> Stack: **Vite 6 · React 18 · TypeScript · Zustand · Monaco · xterm · @webcontainer/api**
> LLMs: **Anthropic (Claude) · OpenAI (GPT) · Ollama · LM Studio**

---

## ✨ Features

- **Chat → full app.** Stream a complete, multi-file project from a natural-language prompt.
- **Live preview.** The generated app's dev server runs inside an in-browser WebContainer; the preview
  iframe loads it as soon as it's ready.
- **File explorer.** A real folder tree with **New file / New folder / delete / refresh**, plus
  **Download project (.zip)** to get files out of the sandbox.
- **Monaco editor** with tabs, synced to the sandbox filesystem.
- **Interactive terminal** (xterm wired to an in-container `jsh` shell).
- **Multi-provider LLMs.** Cloud keys (stored only in your browser's localStorage) or local models via
  Ollama / LM Studio, routed through same-origin dev-server proxies to dodge browser CORS/COEP blocks.
- **Smart local model selection.** Auto-picks the best *loaded* chat model (e.g. `llama-3.1-8b-instruct`)
  over tiny reasoning models, and captures `reasoning_content` so "thinking" models aren't silent.
- **Supervised pipeline (optional).** A multi-role mode — referent → coder → guardian → supervisor — with
  human approval gates, iteration limits, and escalation. Configure per-role providers/models.
- **Quality-of-life.** Dark/light theme, command palette (<kbd>⌘</kbd>/<kbd>Ctrl</kbd>+<kbd>K</kbd>),
  toasts, streaming output, and a one-click **starter app** so you always have something runnable.

---

## ✅ Prerequisites

| Need | Why |
|---|---|
| **Node.js ≥ 20** | Build tooling. |
| **Chrome or Edge** | WebContainers need `SharedArrayBuffer`, which requires cross-origin isolation. Chromium-based browsers have the best support. Firefox/Safari are limited. |
| **`npm run dev`** (not the built files) | WebContainers **only** boot when the page is served with `COOP: same-origin` + `COEP: require-corp`. The Vite dev server sets these (see `vite.config.ts`); opening `dist/` directly will **not** work. |
| *(optional)* **LM Studio** or **Ollama** | To use local models. Start their server and load a chat model. |

---

## 🚀 Install & run

```bash
npm install
npm run dev          # http://localhost:5173  (must be served by Vite — see above)
```

Open the printed URL in **Chrome/Edge**. The WebContainer boots on load (a few seconds), then:

1. **Build:** type a prompt in the chat (left) and let the agent write the project — or click
   **Create starter app** in the Preview panel for an instant runnable template.
2. **Run:** the agent starts the dev server automatically, or use **Run dev server**. The live app
   appears in the preview once it's ready.
3. **Edit / export:** browse the folder tree, edit in Monaco, or click **Download** to export a `.zip`.

### Scripts

```bash
npm run dev          # Vite dev server (localhost:5173) — the only supported way to run
npm run build        # tsc -b && vite build  → dist/
npm run preview      # preview the production build (note: WebContainers still need the dev-server headers)
npm run watch        # lint + test on every change (the autonomous monitor)
```

---

## 🔌 Configuring an LLM

Open **Settings** (top bar, or <kbd>⌘</kbd>/<kbd>Ctrl</kbd>+<kbd>K</kbd> → "Settings").

- **Anthropic / OpenAI:** paste your API key. The key is sent directly from your tab to the provider and
  stored only in this browser's `localStorage` (visible in DevTools). Fine for a personal/local tool.
- **LM Studio:** start the local server (default `http://localhost:1234`) and load a chat model. The app
  detects loaded models automatically; pick `llama-3.1-8b-instruct` (or similar instruct model) for code.
- **Ollama:** run `ollama serve` and `ollama pull <model>` (default `http://localhost:11434`).

Local servers are reached through same-origin Vite proxies (`/__lmstudio`, `/__ollama`) — there's **no**
need to enable CORS on the local server. Use **Test connection** to verify.

> **Tip:** In LM Studio's Developer/Server tab, set **Max tokens** high (e.g. 16384+). A low cap there
> overrides the app's request and will cut generation off mid-file.

---

## 🧠 How it works

```
prompt ─► streamChat() ─► <boltAction> blocks ─► apply to WebContainer VFS / shell
                                              ─► feed command output back ─► retry
```

- **Agent loop** (`src/lib/agent.ts`): streams the model, parses action blocks, writes files, runs shell
  commands (bounded by a timeout so an interactive prompt can never freeze it), and re-runs once.
- **Action protocol** (`src/lib/llm/tools.ts`): the model emits fenced actions instead of relying on
  native function-calling (which many local models lack):

  ```
  <boltAction type="file" path="src/App.tsx">…full file contents…</boltAction>
  <boltAction type="shell">npm install</boltAction>
  ```

- **Preview URL** comes from the WebContainer **`server-ready`** event — *not* Vite's `localhost:PORT`
  banner, which is the sandbox's internal address and would otherwise load the editor itself.
- **Path safety** (`src/lib/safePath.ts`): every model-supplied path is confined to the project root
  (no `..` escapes, drive letters, or shell-dangerous characters).
- **Export** (`src/lib/zip.ts`): a dependency-free STORE-method `.zip` writer packages the sandbox VFS.

---

## 🗂 Project structure

```
src/
├── App.tsx                 # layout, boots the WebContainer, wires server-ready → preview
├── main.tsx                # entry (StrictMode)
├── store.ts                # Zustand global state (chat, boot, tabs, settings, pipeline)
├── styles.css
├── lib/
│   ├── webcontainer.ts     # WebContainer engine: boot, VFS, shell, dev server
│   ├── agent.ts            # agentic loop (prompt → actions → VFS/shell)
│   ├── safePath.ts         # path hardening for model-supplied paths
│   ├── zip.ts              # dependency-free .zip export
│   ├── starter.ts          # minimal Vite+React+TS starter app
│   ├── llm/
│   │   ├── client.ts       # unified streaming client (Anthropic + OpenAI-compat)
│   │   ├── providers.ts    # provider definitions + persisted settings
│   │   └── tools.ts        # boltAction protocol + system prompt
│   └── pipeline/           # optional supervised multi-agent mode
│       ├── pipeline.ts  coder.ts  guardian.ts  gate.ts  analysis.ts
│       ├── pif.ts  roles.ts  escalation.ts  costs.ts  resources.ts  types.ts ...
└── components/
    ├── Chat.tsx  FileTree.tsx  Editor.tsx  Preview.tsx  Terminal.tsx
    ├── Settings.tsx  TopBar.tsx  CommandPalette.tsx  Toaster.tsx  BootOverlay.tsx
    └── pipeline/          # PipelineDrawer, ApprovalDialog, Brainstorm, GuardianPanel, …
```

---

## 🛠 Troubleshooting

| Symptom | Cause / fix |
|---|---|
| **Preview blank / "Dev server starting…" forever** | The Preview panel shows a live log + a cross-origin-isolation check. Read it — most often the sandbox dev server failed to start (npm install) or isolation is off. |
| **"Cross-origin isolation is OFF"** | Run via `npm run dev` (serves the required COOP/COEP headers) in Chrome/Edge. Opening the built files directly won't work. |
| **LM Studio "doesn't work" / empty replies** | The app auto-selects the best *loaded instruct* model. Make sure a capable model (e.g. `llama-3.1-8b-instruct`) is loaded, not just a tiny/embedding model. |
| **AI cuts off mid-code** | Use an instruct (non-reasoning) model, and raise LM Studio's **Max tokens** setting. The output cap is 16384 tokens. |
| **Preview shows the editor itself** | Fixed — the preview now uses the `server-ready` URL, not Vite's internal `localhost` banner. |
| **Boot failed / "retry did not recover"** | A WebContainer boots once per page load; **reload the page** to start fresh. Cookie/content blockers can also block it. |

---

## ⚠️ Notes & limitations

- WebContainers run entirely in your browser's memory; **refreshing loses the sandbox** (export with
  Download first). The editor app's own settings/keys persist in `localStorage`.
- API keys are visible to anyone with DevTools on this tab — appropriate for personal/local use, **not**
  for multi-user hosting.
- WebContainers rely on StackBlitz's hosted proxies to function (per the `@webcontainer/api` terms).

---

## License

Private project. Built for local, single-user use.
