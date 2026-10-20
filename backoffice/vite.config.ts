import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  root: import.meta.dirname,
  base: '/admin/',
  plugins: [vue()],
  build: { outDir: 'dist', emptyOutDir: true },
  server: {
    // `bun run dev:backoffice` against a `notes serve` on the default port.
    proxy: {
      '/api': 'http://127.0.0.1:21024',
      '/auth': 'http://127.0.0.1:21024',
      '/backoffice': 'http://127.0.0.1:21024',
    },
  },
})
