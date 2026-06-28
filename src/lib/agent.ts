/**
 * The agentic loop — turns a user prompt into applied changes.
 *
 *   prompt → stream LLM → parse <boltAction> blocks → apply to VFS / shell
 *          → emit toasts + open tabs → feed command output back → retry once.
 */
import { useStore } from '../store';
import { streamChat, type ChatMessage } from './llm/client';
import { SYSTEM_PROMPT, parseActions, stripActions } from './llm/tools';
import { safePath } from './safePath';
import * as wc from './webcontainer';

/** Commands that start a long-running server. These must be launched detached —
 *  awaiting their exit would hang the agent forever. */
const DEV_SERVER_RE =
  /\b(npm|yarn|pnpm)\s+(run\s+)?(dev|start|serve)\b|\b(npm|yarn|pnpm)\s+run\s+preview\b|^\s*vite\b|\bnext\s+(dev|start)\b|--host\b/;

/** Interactive scaffolders that prompt for keyboard input and freeze the sandbox.
 *  The model is told (see SYSTEM_PROMPT) to author files directly instead. */
const SCAFFOLDER_RE =
  /\b(npm|yarn|pnpm)\s+create\b|\bnpx\s+(create-|pnpm\s+create|degit|cva)/i;

/** AbortController for the in-flight generation, so the user can stop a slow /
 *  runaway response instead of waiting it out. */
let currentAbort: AbortController | null = null;

/** Cancel the in-flight generation (wired to the Stop button in the chat UI). */
export function stopAgent(): void {
  currentAbort?.abort();
  currentAbort = null;
}

export async function runAgent(userPrompt: string): Promise<void> {
  const store = useStore.getState();
  store.addMessage('user', userPrompt);
  store.setBusy(true);
  const abort = new AbortController();
  currentAbort = abort;

  try {
    for (let turn = 0; turn < 2; turn++) {
      const baseMessages: ChatMessage[] = useStore.getState().messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Inject live project context so the model treats it as a state machine.
      let filesContext = '';
      try {
        const tree = await wc.readTree('.');
        const files = Object.keys(tree).filter((p) => !tree[p]);
        if (files.length) filesContext = `\n\n[current project files]\n${files.join('\n')}`;
      } catch {
        /* container not ready yet */
      }

      const history: ChatMessage[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...baseMessages.map((m, i) =>
          m.role === 'user' && i === baseMessages.length - 1
            ? { ...m, content: m.content + filesContext }
            : m,
        ) as ChatMessage[],
      ];

      const assistantId = store.addMessage('assistant', '');
      let full = '';
      try {
        full = await streamChat(
          useStore.getState().settings,
          history,
          (delta) => useStore.getState().appendToMessage(assistantId, delta),
          abort.signal,
        );
      } catch (err: any) {
        if (abort.signal.aborted) {
          // User pressed Stop — end the turn gracefully without an error toast.
          useStore.getState().appendToMessage(assistantId, '\n\n_⏹ stopped by operator._');
          break;
        }
        const raw = err?.message ?? String(err);
        // Make the common local-server failures actionable instead of cryptic.
        const msg = /Failed to fetch|NetworkError|load failed/i.test(raw)
          ? `Could not reach the LLM. If you're using LM Studio/Ollama, make sure its server is running and the app is started with "npm run dev" (the local proxy only exists under the Vite dev server). (${raw})`
          : raw;
        useStore.getState().appendToMessage(assistantId, `\n\n⚠️ ${msg}`);
        useStore.getState().pushToast('error', msg);
        break;
      }

    // The model returned no usable text. Most often this is a local "reasoning"
    // model whose answer never reached `content` (now handled by resolveLocalModel),
    // or a server with no model loaded. Tell the operator instead of silently dying.
    if (!full.trim()) {
      useStore.getState().appendToMessage(
        assistantId,
        '\n\n⚠️ The model returned an empty response. Check Settings → provider/model ' +
          '(use an instruct chat model like llama-3.1-8b-instruct, and ensure a model is loaded).',
      );
      useStore.getState().pushToast('error', 'Empty response from model — check LLM settings.');
      break;
    }

    // Detect a truncated response: more <boltAction> opens than closes means
    // the model hit its output limit mid-file. parseActions salvages the partial
    // trailing file; warn the operator so they know it may be incomplete.
    const opens = (full.match(/<boltAction\b/g) || []).length;
    const closes = (full.match(/<\/boltAction>/g) || []).length;
    if (opens > closes) {
      useStore.getState().appendToMessage(
        assistantId,
        '\n\n⚠️ _Response was cut off mid-file (output limit reached). The last file may be incomplete — ask me to continue, or generate fewer files at once._',
      );
      useStore.getState().pushToast('error', 'Response cut off mid-file (output limit).');
    }

    const actions = parseActions(full);
    if (actions.length === 0) break;

    let ranShell = false;
    let startedServer = false;
    for (const action of actions) {
      if (action.kind === 'file') {
        const path = safePath(action.path);
        if (!path) {
          useStore.getState().addMessage(
            'system',
            `⊘ skipped unsafe file path: "${action.path}" (must stay inside the project)`,
          );
          useStore.getState().pushToast('error', `Skipped unsafe path: ${action.path}`);
          continue;
        }
        await ensureDir(path);
        await wc.writeFile(path, action.content);
        useStore.getState().openTab(path);
        useStore.getState().pushToast('success', `Wrote ${path}`);
        continue;
      }

      for (const line of action.command.split('\n').map((l) => l.trim()).filter(Boolean)) {
        // Bare `cd` doesn't persist between WebContainer spawns (each starts in
        // the workdir). Drop it so the model's later commands run where it expects.
        if (/^cd\s+/.test(line)) {
          useStore.getState().addMessage('system', `⊘ skipped "${line}" (cd does not persist here — use root paths)`);
          continue;
        }
        // Interactive scaffolders (npm create / create-vite / npx create-*) WAIT
        // for keyboard input and would freeze the sandbox forever. The model must
        // author files directly instead — see SYSTEM_PROMPT.
        if (SCAFFOLDER_RE.test(line)) {
          useStore.getState().addMessage(
            'system',
            `⚠ skipped interactive command (write files directly instead): ${line}`,
          );
          useStore.getState().pushToast(
            'error',
            `Skipped "${line}" — it is interactive. The agent should write files directly.`,
          );
          continue;
        }

        ranShell = true;
        const sysId = useStore.getState().addMessage('system', `▶ ${line}`);
        useStore.getState().pushToast('info', `▶ ${line}`);
        const [cmd, ...args] = tokenize(line);

        if (DEV_SERVER_RE.test(line)) {
          // Long-running dev server: launch DETACHED. Awaiting its exit would hang
          // the agent forever (servers never exit). The browser-reachable preview
          // URL is delivered by the WebContainer `server-ready` event (wired in
          // App.tsx) — NOT the `localhost:PORT` banner vite prints, which is the
          // container's INTERNAL address and would load the editor app itself in
          // the browser. We only mirror startup output, then go quiet.
          startedServer = true;
          useStore.getState().setBoot('dev-running');
          let urlFound = false;
          await wc.spawnDetached(cmd, args, {
            onData: (chunk) => {
              if (urlFound) return; // stop mirroring startup noise into the chat
              useStore.getState().appendToMessage(sysId, chunk);
              if (/https?:\/\/(?:localhost|127\.0\.0\.1):\d+/.test(chunk)) {
                urlFound = true; // server is up — let server-ready set the real URL
              }
            },
          });
          useStore.getState().appendToMessage(sysId, `\n[dev server running in background — see preview]`);
          continue;
        }

        // Bounded command (install/build/test). The timeout guarantees an
        // interactive prompt or hung command can never freeze the agent.
        const code = await wc.run(cmd, args, {
          onData: (chunk) => {
            useStore.getState().appendToMessage(sysId, chunk);
          },
          timeoutMs: 120_000,
        });
        if (code === wc.EXIT_TIMEOUT) {
          useStore.getState().appendToMessage(sysId, `\n[⏱ timed out & killed — was it waiting for input?]`);
          useStore.getState().pushToast('error', `"${line}" timed out — likely waiting for input.`);
        } else {
          useStore.getState().appendToMessage(sysId, `\n[exit ${code}]`);
          if (code !== 0) useStore.getState().pushToast('error', `${cmd} exited ${code}`);
        }
      }
    }

    useStore.getState().setFileTree(await wc.readTree('.'));
      // Once a dev server is up there is nothing more to drive this turn; stop.
      if (!ranShell || startedServer) break;
    }
  } finally {
    currentAbort = null;
    useStore.getState().setBusy(false);
  }
}

async function ensureDir(filePath: string): Promise<void> {
  const slash = filePath.lastIndexOf('/');
  if (slash > 0) await wc.mkdirp(filePath.slice(0, slash));
}

/** Minimal shell tokenizer — respects simple double-quoted args. */
function tokenize(line: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

export { stripActions };
