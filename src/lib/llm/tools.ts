/**
 * Tool protocol — provider-agnostic.
 *
 * Instead of relying on native function-calling (which differs per provider and
 * many local models lack), we instruct the model to emit actions in a simple
 * fenced protocol. We parse the assistant's streamed text for these blocks and
 * apply them to the WebContainer VFS.
 *
 * Grammar:
 *   <boltAction type="file" path="src/App.tsx">
 *   ...file contents...
 *   </boltAction>
 *
 *   <boltAction type="shell">
 *   npm install
 *   </boltAction>
 *
 * Anything outside a block is treated as prose shown to the user.
 */

export type ParsedAction =
  | { kind: 'file'; path: string; content: string }
  | { kind: 'shell'; command: string };

const ACTION_RE =
  /<boltAction\s+type="(file|shell)"(?:\s+path="([^"]+)")?>([\s\S]*?)<\/boltAction>/g;

/** Extract all actions from an assistant message. */
export function parseActions(text: string): ParsedAction[] {
  const actions: ParsedAction[] = [];
  for (const m of text.matchAll(ACTION_RE)) {
    const [, type, path, body] = m;
    const content = body.replace(/^\n/, '').replace(/\n$/, '');
    if (type === 'file') actions.push({ kind: 'file', path: path ?? 'unknown', content });
    else actions.push({ kind: 'shell', command: content });
  }
  // Salvage a trailing UNCLOSED file block: if the model hit its output limit
  // mid-file, ACTION_RE (which requires </boltAction>) won't match it. Look at
  // the text after the last closing tag; if a <boltAction type="file"> opens
  // there with no close, keep what was generated so the partial file isn't lost.
  const afterLastClose = text.slice(text.lastIndexOf('</boltAction>') + '</boltAction>'.length);
  const open = afterLastClose.match(/<boltAction\s+type="file"(?:\s+path="([^"]+)")?>([\s\S]*)$/);
  if (open) {
    const [, path, body] = open;
    const content = body.replace(/^\n/, '').replace(/\n$/, '');
    if (content.trim()) actions.push({ kind: 'file', path: path ?? 'unknown', content });
  }
  return actions;
}

/** Strip action blocks so only prose remains for the chat view. */
export function stripActions(text: string): string {
  return text.replace(ACTION_RE, '').replace(/\n{3,}/g, '\n\n').trim();
}

export const SYSTEM_PROMPT = `You are BoltGLM, an expert full-stack engineer working inside an in-browser Node.js sandbox (WebContainers). You control a virtual file system and a shell.

When the user asks you to build or change something:
1. Think briefly, then emit actions using EXACTLY this format:

<boltAction type="file" path="relative/path/to/file.ext">
full file contents here
</boltAction>

<boltAction type="shell">
npm install
</boltAction>

Rules:
- For files, ALWAYS write the COMPLETE file contents (never diffs, never "...").
- Write ALL files at the PROJECT ROOT (e.g. \`package.json\`, \`vite.config.ts\`, \`index.html\`, \`src/main.tsx\`, \`src/App.tsx\`). Do NOT create a wrapper subfolder for the project and do NOT use \`cd\` — every command runs from the root and \`cd\` does not persist.
- NEVER use interactive scaffolders or prompts: no \`npm create\`, no \`create-vite\`, no \`npx create-*\`, no \`yarn/pnpm create\`. The sandbox cannot answer prompts and these FREEZE the agent. Author every file yourself with <boltAction type="file">.
- All shell commands MUST be fully non-interactive (no prompts, no confirmations). Prefer \`npm install\` (not \`npm add -i\`).
- After writing files that declare dependencies, run \`npm install\` in one shell action.
- To start the app, run \`npm run dev\` in a shell action — it is launched in the background and the preview opens automatically; do not wait on it.
- Keep prose between actions minimal and conversational.
- If a previous build failed, read the error, fix the code, and re-run.

Standard Vite + React + TypeScript starter layout (write each file fully):
  package.json        (name, "type":"module", scripts: dev/build/preview, deps: react/react-dom, devDeps: @vitejs/plugin-react typescript vite)
  vite.config.ts      (react plugin; server.host true)
  tsconfig.json       (standard Vite TS config)
  index.html          (root div + /src/main.tsx module script)
  src/main.tsx        (createRoot render)
  src/App.tsx         (the app)

Treat the project as a state machine: build on what already exists.`;
