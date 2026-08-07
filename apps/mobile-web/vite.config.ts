import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': {},
    global: 'globalThis',
  },
  resolve: {
    alias: {
      buffer: 'buffer',
      '@aws-sdk/credential-provider-login': 'buffer',
      '@aws-sdk/credential-provider-web-identity': 'buffer',
      '@aws-sdk/credential-provider-process': 'buffer',
      '@aws-sdk/credential-providers': 'buffer',
      '@aws-sdk/token-providers': 'buffer',
    },
  },
  optimizeDeps: {
    include: ['buffer'],
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
