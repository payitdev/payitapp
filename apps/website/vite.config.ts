import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/');
          if (normalizedId.includes('/node_modules/')) return 'vendor';
          if (normalizedId.includes('/components/DeveloperDocs') || normalizedId.includes('/components/DeveloperDashboard')) return 'developer-views';
          if (normalizedId.includes('/components/AdminDashboard') || normalizedId.includes('/components/SchoolConsole')) return 'operations-views';
          return undefined;
        },
      },
    },
  },
  server: {
    port: 3001,
  },
});
