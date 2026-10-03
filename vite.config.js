import { defineConfig } from 'vite';
export default defineConfig({
  build: { chunkSizeWarningLimit: 900, rollupOptions: { input: { main: 'index.html' } } },
});
