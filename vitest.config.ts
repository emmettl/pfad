import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.mjs'],
    environment: 'node',
    maxWorkers: 2,
    isolate: true,
    restoreMocks: true,
    unstubGlobals: true,
    testTimeout: 30000,
  },
})
