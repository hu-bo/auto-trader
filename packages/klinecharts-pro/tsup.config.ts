import { defineConfig } from 'tsup'
import { copyFileSync, mkdirSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const copyStyles = () => {
  const srcPath = join(__dirname, 'src/styles/index.css')
  const destPath = join(__dirname, 'dist/styles.css')

  const destDir = dirname(destPath)
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true })
  }

  if (existsSync(srcPath)) {
    copyFileSync(srcPath, destPath)
  }
}

export default defineConfig([
  {
    entry: {
      index: 'src/index.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    external: ['react', 'react-dom'],
    onSuccess: async () => {
      copyStyles()
    },
  },
  {
    entry: {
      'react/index': 'src/react/index.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    external: ['react', 'react-dom', 'klinecharts'],
    esbuildOptions(options) {
      options.jsx = 'automatic'
    },
  },
])
