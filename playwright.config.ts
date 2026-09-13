import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 45000,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5183', viewport: { width: 1440, height: 900 }, browserName: 'chromium', channel: 'chrome', screenshot: 'only-on-failure' },
  webServer: { command: 'npm run dev -- --port 5183 --strictPort', url: 'http://127.0.0.1:5183', reuseExistingServer: true },
});
