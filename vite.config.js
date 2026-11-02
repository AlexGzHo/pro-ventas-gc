import { defineConfig } from 'vite'

export default defineConfig({
  optimizeDeps: {
    // Escanear únicamente index.html para descubrir dependencias en desarrollo,
    // excluyendo carpetas de referencia externa y worktrees
    entries: ['index.html'],
  },
  server: {
    watch: {
      ignored: [
        '**/REFERENCIAS PRO VENTAS/**',
        '**/.kilo/**',
      ],
    },
  },
})

