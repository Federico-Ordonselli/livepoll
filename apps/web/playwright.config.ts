import { defineConfig, devices } from '@playwright/test'
import { randomBytes } from 'node:crypto'

/**
 * Two modes:
 * - default: builds and starts the API (port 3335, database livepoll_e2e) and
 *   `vite preview` (port 4173, proxying /api and /socket.io to it).
 * - E2E_BASE_URL set (e.g. http://localhost:8088 for `docker compose up`):
 *   tests run against that URL and no servers are started.
 */
const externalBaseUrl = process.env.E2E_BASE_URL
const apiPort = 3335
const repoRoot = new URL('../..', import.meta.url).pathname

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL: externalBaseUrl ?? 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: externalBaseUrl
    ? undefined
    : [
        {
          command: 'pnpm --filter @livepoll/api build && node apps/api/build/bin/server.js',
          cwd: repoRoot,
          url: `http://localhost:${apiPort}/api/health`,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          env: {
            NODE_ENV: 'production',
            PORT: String(apiPort),
            HOST: '127.0.0.1',
            LOG_LEVEL: 'warn',
            APP_KEY: randomBytes(32).toString('base64url'),
            MONGO_URL: process.env.E2E_MONGO_URL ?? 'mongodb://127.0.0.1:27017/livepoll_e2e',
            CORS_ORIGINS: 'http://localhost:4173',
            RATE_LIMIT_AUTH_PER_MIN: '1000',
            RATE_LIMIT_VOTE_PER_MIN: '1000',
            TZ: 'UTC',
          },
        },
        {
          command:
            'pnpm --filter @livepoll/web build && pnpm --filter @livepoll/web preview --strictPort',
          cwd: repoRoot,
          url: 'http://localhost:4173',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          env: { VITE_API_PROXY_TARGET: `http://127.0.0.1:${apiPort}` },
        },
      ],
})
