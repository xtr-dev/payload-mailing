import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

// Integration-test config: boots a real Payload instance (sqlite + the dev
// app's payload.config.ts), so it is split from the fast unit config in
// vitest.config.ts, whose include glob is rooted at `src/` and can never
// collect these files. Run via `pnpm test:int`.
export default defineConfig({
  plugins: [
    // dev/int.spec.ts imports `@payload-config` and `@xtr-dev/payload-mailing`;
    // both aliases live in dev/tsconfig.json, so resolve them from there rather
    // than duplicating the mappings here.
    tsconfigPaths({ projects: ['./dev/tsconfig.json'] }),
  ],
  test: {
    environment: 'node',
    globals: true,
    include: ['dev/**/*.spec.ts'],
    // dev/e2e.spec.ts is a Playwright suite; vitest would fail importing
    // @playwright/test, so keep it out of this glob explicitly.
    exclude: ['dev/e2e.spec.ts'],
    // getPayload boots the whole app (sqlite schema push + seed) in beforeAll,
    // which takes well over vitest's 10s defaults on a cold start.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
})
