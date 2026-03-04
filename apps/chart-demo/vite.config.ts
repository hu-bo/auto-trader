import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 4200,
    proxy: {
      '/api': {
        target: 'http://localhost:9003',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:9003',
        ws: true,
      },
    },
  },
})
