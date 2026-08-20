// vite.config.ts
import { defineConfig } from "file:///C:/Users/Igboze/.gemini/antigravity-ide/scratch/PayITdEV/node_modules/.pnpm/vite@5.4.21_@types+node@22.7.5_lightningcss@1.32.0_terser@5.50.0/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/Igboze/.gemini/antigravity-ide/scratch/PayITdEV/node_modules/.pnpm/@vitejs+plugin-react@4.7.0_vite@5.4.21_@types+node@22.7.5_lightningcss@1.32.0_terser@5.50.0_/node_modules/@vitejs/plugin-react/dist/index.js";
var vite_config_default = defineConfig({
  plugins: [react()],
  define: {
    "process.env": {},
    global: "globalThis"
  },
  resolve: {
    alias: {
      buffer: "buffer/",
      "@aws-sdk/credential-provider-login": "buffer/",
      "@aws-sdk/credential-provider-web-identity": "buffer/",
      "@aws-sdk/credential-provider-process": "buffer/",
      "@aws-sdk/credential-providers": "buffer/",
      "@aws-sdk/token-providers": "buffer/"
    }
  },
  build: {
    target: "esnext"
  },
  optimizeDeps: {
    include: ["buffer", "@fast-auth-near/react-sdk"],
    esbuildOptions: {
      target: "esnext",
      loader: {
        ".js": "jsx"
      }
    }
  },
  server: {
    port: 3e3,
    host: true,
    allowedHosts: true,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups"
    },
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxJZ2JvemVcXFxcLmdlbWluaVxcXFxhbnRpZ3Jhdml0eS1pZGVcXFxcc2NyYXRjaFxcXFxQYXlJVGRFVlxcXFxhcHBzXFxcXG1vYmlsZS13ZWJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXElnYm96ZVxcXFwuZ2VtaW5pXFxcXGFudGlncmF2aXR5LWlkZVxcXFxzY3JhdGNoXFxcXFBheUlUZEVWXFxcXGFwcHNcXFxcbW9iaWxlLXdlYlxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvSWdib3plLy5nZW1pbmkvYW50aWdyYXZpdHktaWRlL3NjcmF0Y2gvUGF5SVRkRVYvYXBwcy9tb2JpbGUtd2ViL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbcmVhY3QoKV0sXG4gIGRlZmluZToge1xuICAgICdwcm9jZXNzLmVudic6IHt9LFxuICAgIGdsb2JhbDogJ2dsb2JhbFRoaXMnLFxuICB9LFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgIGJ1ZmZlcjogJ2J1ZmZlci8nLFxuICAgICAgJ0Bhd3Mtc2RrL2NyZWRlbnRpYWwtcHJvdmlkZXItbG9naW4nOiAnYnVmZmVyLycsXG4gICAgICAnQGF3cy1zZGsvY3JlZGVudGlhbC1wcm92aWRlci13ZWItaWRlbnRpdHknOiAnYnVmZmVyLycsXG4gICAgICAnQGF3cy1zZGsvY3JlZGVudGlhbC1wcm92aWRlci1wcm9jZXNzJzogJ2J1ZmZlci8nLFxuICAgICAgJ0Bhd3Mtc2RrL2NyZWRlbnRpYWwtcHJvdmlkZXJzJzogJ2J1ZmZlci8nLFxuICAgICAgJ0Bhd3Mtc2RrL3Rva2VuLXByb3ZpZGVycyc6ICdidWZmZXIvJyxcbiAgICB9LFxuICB9LFxuICBidWlsZDoge1xuICAgIHRhcmdldDogJ2VzbmV4dCcsXG4gIH0sXG4gIG9wdGltaXplRGVwczoge1xuICAgIGluY2x1ZGU6IFsnYnVmZmVyJywgJ0BmYXN0LWF1dGgtbmVhci9yZWFjdC1zZGsnXSxcbiAgICBlc2J1aWxkT3B0aW9uczoge1xuICAgICAgdGFyZ2V0OiAnZXNuZXh0JyxcbiAgICAgIGxvYWRlcjoge1xuICAgICAgICAnLmpzJzogJ2pzeCcsXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG4gIHNlcnZlcjoge1xuICAgIHBvcnQ6IDMwMDAsXG4gICAgaG9zdDogdHJ1ZSxcbiAgICBhbGxvd2VkSG9zdHM6IHRydWUsXG4gICAgaGVhZGVyczoge1xuICAgICAgJ0Nyb3NzLU9yaWdpbi1PcGVuZXItUG9saWN5JzogJ3NhbWUtb3JpZ2luLWFsbG93LXBvcHVwcycsXG4gICAgfSxcbiAgICBwcm94eToge1xuICAgICAgJy9hcGknOiB7XG4gICAgICAgIHRhcmdldDogJ2h0dHA6Ly9sb2NhbGhvc3Q6NDAwMCcsXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbn0pO1xuXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQTRaLFNBQVMsb0JBQW9CO0FBQ3piLE9BQU8sV0FBVztBQUVsQixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsTUFBTSxDQUFDO0FBQUEsRUFDakIsUUFBUTtBQUFBLElBQ04sZUFBZSxDQUFDO0FBQUEsSUFDaEIsUUFBUTtBQUFBLEVBQ1Y7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLFFBQVE7QUFBQSxNQUNSLHNDQUFzQztBQUFBLE1BQ3RDLDZDQUE2QztBQUFBLE1BQzdDLHdDQUF3QztBQUFBLE1BQ3hDLGlDQUFpQztBQUFBLE1BQ2pDLDRCQUE0QjtBQUFBLElBQzlCO0FBQUEsRUFDRjtBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsUUFBUTtBQUFBLEVBQ1Y7QUFBQSxFQUNBLGNBQWM7QUFBQSxJQUNaLFNBQVMsQ0FBQyxVQUFVLDJCQUEyQjtBQUFBLElBQy9DLGdCQUFnQjtBQUFBLE1BQ2QsUUFBUTtBQUFBLE1BQ1IsUUFBUTtBQUFBLFFBQ04sT0FBTztBQUFBLE1BQ1Q7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sY0FBYztBQUFBLElBQ2QsU0FBUztBQUFBLE1BQ1AsOEJBQThCO0FBQUEsSUFDaEM7QUFBQSxJQUNBLE9BQU87QUFBQSxNQUNMLFFBQVE7QUFBQSxRQUNOLFFBQVE7QUFBQSxRQUNSLGNBQWM7QUFBQSxNQUNoQjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
