import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  const destinoApi = process.env.VITE_API_PROXY_TARGET || 'http://localhost:4000';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch:
        process.env.DISABLE_HMR === 'true'
          ? null
          : {
              usePolling: true,
              interval: 300,
            },
      proxy: {
        '/api': {
          target: destinoApi,
          changeOrigin: true,
        },
        '/health': {
          target: destinoApi,
          changeOrigin: true,
        },
      },
    },
  };
});
