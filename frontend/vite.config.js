import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// En développement, /api est relayé vers le backend local : pas de CORS à configurer.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { '/api': { target: process.env.VITE_DEV_API || 'http://localhost:4000', changeOrigin: true } },
  },
  build: { sourcemap: false },
});
