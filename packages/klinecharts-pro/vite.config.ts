import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [react()],
  root: 'demo',
  resolve: {
    alias: {
      '@hquant/klinecharts-pro/react': resolve(__dirname, 'src/react/index.ts'),
      '@hquant/klinecharts-pro': resolve(__dirname, 'src/index.ts'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 8001,
    open: true,
  },
})
