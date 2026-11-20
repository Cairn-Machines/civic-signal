import { defineConfig, devices } from '@playwright/test'

// Browser tests run locally (the Drove merge gate, `npm run test:smoke`), never in GitHub CI.
// scripts/smoke/run.mjs builds the app, starts a throwaway Postgres and sets E2E_PORT and SMOKE_DATABASE_URL.
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
    command: `node node_modules/next/dist/bin/next start -H 127.0.0.1 -p ${port}`,
    cwd: './apps/web',
    url: `${origin}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
    env: {
      NODE_ENV: 'production',
      DATABASE_URL: process.env.SMOKE_DATABASE_URL ?? '',
      APP_URL: origin,
      NEXT_PUBLIC_SITE_URL: origin,
      EMAIL_FROM: 'CivicSignal <smoke@example.invalid>',
      RESEND_API_KEY: '',
      SESSION_SECRET: 'smoke-not-a-secret',
    },
  },
})
