import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
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
    setupFiles: ['./src/test-setup.js'],
    // vitest 4's configDefaults.exclude is node_modules + .git only, so dist is kept explicitly.
    exclude: [...configDefaults.exclude, '**/dist/**', '.worktrees/**'],
  },
})
