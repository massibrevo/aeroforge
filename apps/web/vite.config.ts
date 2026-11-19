import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    fs: { allow: [
      fileURLToPath(new URL('.', import.meta.url)),
      fileURLToPath(new URL('../../shared/aircraft', import.meta.url)),
    ] },
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
})
