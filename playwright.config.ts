import { defineConfig, devices } from '@playwright/test'

// Browser tests run locally (the Drove merge gate, `npm run test:smoke`), never in GitHub CI.
// The webServer is scripts/smoke/serve.mjs: it builds the app, starts a throwaway docker Postgres,
// migrates it and runs `next start`, so a plain `playwright test` is self-contained.
// E2E_PORT overrides the port; the default 3100 is fixed because every worker re-evaluates this file.
const port = Number(process.env.E2E_PORT) || 3100
const origin = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  grep: /@smoke/,
  forbidOnly: true,
  retries: 0,
  timeout: 30_000,
  reporter: 'list',
  outputDir: './test-results',
  use: { baseURL: origin, headless: true, trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium-1440', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    {
      name: 'chromium-390',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
  ],
  webServer: {
    command: 'node scripts/smoke/serve.mjs',
    url: `${origin}/api/health`,
    reuseExistingServer: false,
    timeout: 240_000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
    env: { E2E_PORT: String(port) },
  },
})
