import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'

// Entry points use electron-vite's defaults: src/main/index.ts, src/preload/index.ts, src/renderer/index.html.
export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    plugins: [react()],
    build: { minify: true }
  }
})
