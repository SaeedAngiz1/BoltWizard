import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// WebContainers REQUIRE cross-origin isolation: SharedArrayBuffer is unavailable
// without these two headers, and the runtime refuses to boot. Non-negotiable.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    // Same-origin proxies for LOCAL LLM servers. Routing through Vite avoids
    // browser CORS/COEP blocks entirely — no need to enable CORS on the local
    // server. (Default ports; edit here if you run them elsewhere.)
    proxy: {
      '/__lmstudio': {
        target: 'http://localhost:1234',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/__lmstudio/, '') || '/',
      },
      '/__ollama': {
        target: 'http://localhost:11434',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/__ollama/, '') || '/',
      },
    },
  },
  optimizeDeps: {
    // @webcontainer/api ships an ES module meant for the browser; exclude from
    // pre-bundling so its top-level await + worker usage is preserved.
    exclude: ['@webcontainer/api'],
  },
  worker: {
    format: 'es',
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Split heavy vendors into parallel chunks for faster initial load.
        // @webcontainer/api is intentionally left in the main chunk (it uses
        // top-level await + workers that don't like being isolated).
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('lucide-react')) return 'icons';
          if (id.includes('@xterm') || id.includes('@monaco-editor')) return 'editor';
          if (
            id.includes('react-markdown') ||
            id.includes('remark-') ||
            id.includes('rehype-') ||
            id.includes('lowlight') ||
            id.includes('highlight.js')
          ) {
            return 'markdown';
          }
          if (
            id.includes('react-resizable-panels') ||
            /\breact\b|react-dom|scheduler/.test(id)
          ) {
            return 'react-vendor';
          }
        },
      },
    },
  },
});
