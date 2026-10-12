import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Shared local configuration lives at the workspace root. Vite only exposes
  // `VITE_`-prefixed entries to the browser, so server-only secrets stay private.
  envDir: '../..',
  plugins: [react()],
  define: {
    'process.env': {},
    global: 'globalThis',
  },
  resolve: {
    alias: {
      buffer: 'buffer/',
      '@aws-sdk/credential-provider-login': 'buffer/',
      '@aws-sdk/credential-provider-web-identity': 'buffer/',
      '@aws-sdk/credential-provider-process': 'buffer/',
      '@aws-sdk/credential-providers': 'buffer/',
      '@aws-sdk/token-providers': 'buffer/',
    },
  },
  build: {
    target: 'esnext',
  },
  optimizeDeps: {
    include: ['buffer'],
    esbuildOptions: {
      target: 'esnext',
    },
  },
  server: {
    port: 3000,
    host: true,
    allowedHosts: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
    proxy: {
      '/api': {
        // Local UI requests are proxied to the deployed API. This keeps the
        // browser on a same-origin `/api` path during development, avoiding
        // cross-origin restrictions while exercising the cloud backend.
        target: 'https://payit-backend-td53.onrender.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
