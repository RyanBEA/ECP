import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['bae'],
  },
  base: './',
  resolve: {
    alias: {
      '@scripts': path.resolve(__dirname, 'scripts'),
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  },
})
