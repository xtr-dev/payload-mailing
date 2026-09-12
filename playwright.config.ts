import { defineConfig } from '@playwright/test'

// test:e2e's only intended spec is dev/e2e.spec.ts. Without this file,
// Playwright falls back to its default testMatch from the repo root, which
// also collects dev/int.spec.ts (a vitest integration spec) and every
// src/**/*.test.ts unit test — none of which use the Playwright test runner
// and would error under it. Scoping testDir to dev/ and testMatch to the
// e2e spec avoids both. baseURL/webServer are required because the spec
// navigates with a relative `/admin` path.
export default defineConfig({
  testDir: './dev',
  testMatch: '**/e2e.spec.ts',
  use: {
    baseURL: 'http://localhost:3300',
  },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3300/admin',
    env: { PORT: '3300' },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
