import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ['monaco-editor'],
  },
  server: {
    port: 8002,
    host: '0.0.0.0',
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
  css: {
    preprocessorOptions: {
      less: {
        additionalData: `@import "@/styles/variables.less";`,
        javascriptEnabled: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          semi: ['@douyinfe/semi-ui'],
          charts: ['@hquant/klinecharts-pro'],
        },
      },
    },
  },
})
