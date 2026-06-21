import { defineConfig } from 'vitest/config'

// Unit-test config: fast, no database or running Payload app required.
// Scoped to colocated `src/**/*.test.ts` files. The heavier integration and
// e2e suites under `dev/` (which boot Payload/Next) are intentionally excluded
// here and run via the dedicated `test:int` / `test:e2e` scripts.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
})
