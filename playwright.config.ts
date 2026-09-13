import { defineConfig } from '@playwright/test';

const port = 5189;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests/browser',
  timeout: 45000,
  workers: 1,
  use: { baseURL, viewport: { width: 1440, height: 900 }, browserName: 'chromium', channel: 'chrome', screenshot: 'only-on-failure' },
  // Own the process: a reused editor server may have a queued HMR full-reload.
  webServer: { command: `npm run dev -- --port ${port} --strictPort`, url: baseURL, reuseExistingServer: false, gracefulShutdown: { signal: 'SIGTERM', timeout: 1000 } },
});
