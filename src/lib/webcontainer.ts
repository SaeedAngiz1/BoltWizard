/**
 * WebContainer engine — singleton wrapper around @webcontainer/api.
 *
 * Owns the in-browser Node runtime: boots it, reads/writes the VFS, streams a
 * shell to xterm, and surfaces the vite dev-server URL for the preview iframe.
 *
 * The browser has no disk — everything here lives in RAM inside WebContainer.
 */
import { WebContainer } from '@webcontainer/api';

let instance: WebContainer | null = null;
let bootPromise: Promise<WebContainer> | null = null;

export type ShellHandle = {
  input: { write: (data: string) => Promise<void>; close: () => Promise<void> };
  output: ReadableStream<string>;
  resize: (cols: number, rows: number) => Promise<void>;
};

/** Boot the WebContainer exactly once for the page lifetime. */
export async function boot(
  onServerReady?: (port: number, url: string) => void,
): Promise<WebContainer> {
  if (instance) return instance;
  if (!bootPromise) {
    bootPromise = WebContainer.boot()
      .then(async (c) => {
        instance = c;
        if (onServerReady) c.on('server-ready', onServerReady);
        return c;
      })
      .catch((e) => {
        // A failed boot must be retryable — clear the cached promise so a
        // subsequent boot() call re-attempts instead of returning the rejection.
        bootPromise = null;
        throw e;
      });
  }
  return bootPromise;
}

export function getContainer(): WebContainer | null {
  return instance;
}

// ---- VFS helpers -----------------------------------------------------------

export async function writeFile(path: string, contents: string): Promise<void> {
  const c = await boot();
  await c.fs.writeFile(path, contents, 'utf-8');
}

export async function readFile(path: string): Promise<string> {
  const c = await boot();
  return c.fs.readFile(path, 'utf-8');
}

export async function mkdirp(path: string): Promise<void> {
  const c = await boot();
  await c.fs.mkdir(path, { recursive: true });
}

export async function rm(path: string): Promise<void> {
  const c = await boot();
  await c.fs.rm(path, { recursive: true, force: true });
}

/** Recursive directory listing → flat map of path→isDir. */
export async function readTree(dir = '.'): Promise<Record<string, boolean>> {
  const c = await boot();
  const out: Record<string, boolean> = {};
  async function walk(d: string) {
    let entries;
    try {
      entries = await c.fs.readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const full = d === '.' ? e.name : `${d}/${e.name}`;
      out[full] = e.isDirectory();
      if (e.isDirectory()) await walk(full);
    }
  }
  await walk(dir);
  return out;
}

// ---- process execution -----------------------------------------------------

export type RunOpts = {
  onData?: (chunk: string) => void;
  /** Kill the process and resolve with {@link EXIT_TIMEOUT} after this many ms.
   *  Default 60s. This is what stops an interactive prompt (e.g. `npm create`
   *  waiting on "Ok to proceed?") or a hung command from freezing the agent. */
  timeoutMs?: number;
  /** Optional stdin to write once at spawn (e.g. "y\n" to auto-answer a prompt). */
  stdin?: string;
};

/** Sentinel exit code returned when a command is killed for exceeding timeoutMs. */
export const EXIT_TIMEOUT = 124;

/** Stream a process's combined stdout/stderr to onData, in the background. */
function attachOutput(proc: { output: ReadableStream<string> }, onData?: (c: string) => void): void {
  if (!onData) return;
  proc.output
    .pipeTo(
      new WritableStream({
        write(chunk) {
          // WebContainer output streams are already decoded strings.
          onData(chunk);
        },
      }),
    )
    .catch(() => {
      /* stream closed when the process is killed — ignore */
    });
}

/** Race the process exit against a timeout; kill on expiry. */
async function waitForExit(
  proc: { exit: Promise<number>; kill: () => void },
  timeoutMs: number,
): Promise<number> {
  if (timeoutMs <= 0) return proc.exit;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race<number>([
      proc.exit,
      new Promise<number>((resolve) => {
        timer = setTimeout(() => {
          try {
            proc.kill();
          } catch {
            /* ignore */
          }
          resolve(EXIT_TIMEOUT);
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Spawn a command, stream its stdout+stderr, and resolve with the exit code.
 * Bounded by `timeoutMs` (default 60s) so an interactive prompt or hung command
 * can NEVER freeze the caller — it is killed and {@link EXIT_TIMEOUT} is returned.
 */
export async function run(
  command: string,
  args: string[],
  opts: RunOpts = {},
): Promise<number> {
  const c = await boot();
  const proc = await c.spawn(command, args);
  attachOutput(proc, opts.onData);
  if (opts.stdin != null) {
    try {
      const w = proc.input.getWriter();
      await w.write(opts.stdin);
      await w.close();
    } catch {
      /* ignore */
    }
  }
  return waitForExit(proc, opts.timeoutMs ?? 60_000);
}

/**
 * Spawn a LONG-RUNNING process (e.g. a dev server) and return immediately,
 * WITHOUT awaiting its exit. Output keeps streaming to onData in the background.
 * Use the returned `kill()` to stop it, or `exit` if you ever need to await it.
 * There is no timeout — servers are expected to run until killed.
 */
export async function spawnDetached(
  command: string,
  args: string[],
  opts: Pick<RunOpts, 'onData'> = {},
): Promise<{ exit: Promise<number>; kill: () => void }> {
  const c = await boot();
  const proc = await c.spawn(command, args);
  attachOutput(proc, opts.onData);
  return { exit: proc.exit, kill: () => proc.kill() };
}

// ---- filesystem existence --------------------------------------------------

/** True if a file can be read at `path`. */
export async function fileExists(path: string): Promise<boolean> {
  const c = await boot();
  try {
    await c.fs.readFile(path);
    return true;
  } catch {
    return false;
  }
}

/** True if `path` is a readable directory. */
export async function dirExists(path: string): Promise<boolean> {
  const c = await boot();
  try {
    await c.fs.readdir(path);
    return true;
  } catch {
    return false;
  }
}

// ---- interactive shell -----------------------------------------------------

/** Start a `jsh` shell and return handles wired to an xterm instance. */
export async function startShell(cols = 80, rows = 24): Promise<ShellHandle> {
  const c = await boot();
  const shell = await c.spawn('jsh', { terminal: { cols, rows } });
  const writer = shell.input.getWriter();
  return {
    input: {
      write: (data) => writer.write(data),
      close: () => writer.close(),
    },
    output: shell.output,
    resize: async (cols, rows) => {
      await shell.resize({ cols, rows });
    },
  };
}

// ---- dev server ------------------------------------------------------------

/**
 * Bring up the project's dev server inside the container.
 *
 * This is the function the "Run dev server" button and the agent rely on. It:
 *   1. Bails early (throws) if there is no package.json — nothing to run.
 *   2. Runs `npm install` first when node_modules is missing (bounded, streamed).
 *   3. Spawns `npm run dev` DETACHED — a dev server never exits, so we must not
 *      await its exit (that is what hung the preview on "Dev server starting…").
 *      Output streams to onData; the caller learns the URL from the WebContainer
 *      `server-ready` event or by parsing onData.
 *
 * Resolves as soon as the server process is launched; the process keeps running.
 */
export async function startDevServer(onData?: (chunk: string) => void): Promise<void> {
  if (!(await fileExists('package.json'))) {
    throw new Error(
      'No package.json in the project. Ask the agent to build an app first.',
    );
  }

  // Install dependencies if they haven't been installed yet. The agent normally
  // does this itself, but a pipeline-built project (or a manual edit) may skip it.
  if (!(await dirExists('node_modules'))) {
    onData?.('▶ installing dependencies (npm install)…\n');
    const code = await run('npm', ['install'], {
      onData,
      // installs can be slow on first run; allow up to 5 minutes.
      timeoutMs: 5 * 60_000,
    });
    if (code !== 0) {
      throw new Error(`npm install failed (exit ${code}). See terminal output.`);
    }
  }

  // Launch the dev server detached — do NOT await its exit.
  await spawnDetached('npm', ['run', 'dev'], { onData });
}
