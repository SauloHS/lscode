import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: [
      'monaco-editor',
      '@tauri-apps/api',
      '@tauri-apps/plugin-dialog',
      '@xterm/xterm',
      '@xterm/addon-fit',
      'react',
    ],
  },
  server: {
    fs: {
      allow: ['..'],
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        app: 'app.html',
      },
    },
  },
})
