/**
 * Minimal Vite + React + TypeScript starter, written straight into the
 * WebContainer VFS.
 *
 * Lets a user get a running preview immediately — without waiting on the LLM —
 * so "Run dev server" always has a real project to boot. The agent can then
 * evolve these files like any other project.
 */
import * as wc from './webcontainer';

const FILES: Record<string, string> = {
  'package.json': JSON.stringify(
    {
      name: 'my-app',
      private: true,
      version: '0.0.0',
      type: 'module',
      scripts: { dev: 'vite --host', build: 'vite build', preview: 'vite preview' },
      dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1' },
      devDependencies: {
        '@types/react': '^18.3.3',
        '@types/react-dom': '^18.3.0',
        '@vitejs/plugin-react': '^4.3.1',
        typescript: '^5.5.3',
        vite: '^5.4.0',
      },
    },
    null,
    2,
  ),
  'vite.config.ts': `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { host: true },
});
`,
  'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src"]
}
`,
  'index.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
  'src/main.tsx': `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
`,
  'src/App.tsx': `export default function App() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 32, maxWidth: 640 }}>
      <h1>👋 Hello from your starter app</h1>
      <p>This project runs inside an in-browser sandbox. Edit <code>src/App.tsx</code> and save — the preview reloads.</p>
      <p>Or ask the agent (left panel) to build something for you.</p>
    </div>
  );
}
`,
};

function dirOf(path: string): string {
  const i = path.lastIndexOf('/');
  return i === -1 ? '.' : path.slice(0, i);
}

/** Write the starter project into the VFS. Returns the list of files written. */
export async function writeStarterApp(): Promise<string[]> {
  const written: string[] = [];
  for (const [path, content] of Object.entries(FILES)) {
    await wc.mkdirp(dirOf(path));
    await wc.writeFile(path, content);
    written.push(path);
  }
  return written;
}
