import { defineConfig } from '@playwright/test';

const port = 5189;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests/browser',
  timeout: 45000,
  // Every spec loads its own page against one shared dev server; the specs are independent, so they run in
  // parallel. Frame-timing specs assert generous limits that hold with four pages on this many cores.
  fullyParallel: true,
  workers: process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : 4,
  use: { baseURL, viewport: { width: 1440, height: 900 }, browserName: 'chromium', channel: 'chrome', screenshot: 'only-on-failure' },
  // Own the process: a reused editor server may have a queued HMR full-reload.
  webServer: { command: `npm run dev -- --port ${port} --strictPort`, url: baseURL, reuseExistingServer: false, gracefulShutdown: { signal: 'SIGTERM', timeout: 1000 } },
});
