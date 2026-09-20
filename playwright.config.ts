import { defineConfig } from '@playwright/test';

const port = 5189;
const LOAD_SENSITIVE = ['**/driveby-attack.spec.ts', '**/native-jetpack.spec.ts', '**/recruit.spec.ts', '**/native-player-idles.spec.ts', '**/native-fire.spec.ts', '**/passengers.spec.ts'];
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests/browser',
  timeout: 45000,
  // Every spec loads its own page against one shared dev server; the specs are independent, so they run in
  // parallel. Frame-timing specs assert generous limits that hold with four pages on this many cores.
  fullyParallel: true,
  workers: process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : 4,
  // A few interaction specs time their key presses against game time and can miss under four-page load; one retry
  // reruns them (reported as flaky, not hidden).
  retries: 1,
  use: { baseURL, viewport: { width: 1440, height: 900 }, browserName: 'chromium', channel: 'chrome', screenshot: 'only-on-failure' },
  // Specs that time key presses against game time (walking into a pickup, an idle after 20 s, a crew's fight) miss
  // under four-page load; they run after the rest, with the machine to themselves.
  projects: [
    { name: 'parallel', testIgnore: LOAD_SENSITIVE },
    { name: 'quiet', testMatch: LOAD_SENSITIVE, dependencies: ['parallel'], fullyParallel: false },
  ],
  // Own the process: a reused editor server may have a queued HMR full-reload.
  webServer: { command: `npm run dev -- --port ${port} --strictPort`, url: baseURL, reuseExistingServer: false, gracefulShutdown: { signal: 'SIGTERM', timeout: 1000 } },
});
