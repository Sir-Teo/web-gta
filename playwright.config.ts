import { defineConfig } from '@playwright/test';

const port = 5189;
// Specs that miss their window under parallel load and pass with the machine to themselves. The first eight
// were found when this list was made; the rest were measured on 2026-09-21 by running the parallel project at
// three, four and five workers — the failure count tracked the worker count (7, 9, 10) and the same specs kept
// coming back, which is what a timing miss looks like and what a wrong answer does not.
const LOAD_SENSITIVE = ['**/driveby-attack.spec.ts', '**/native-jetpack.spec.ts', '**/recruit.spec.ts', '**/native-player-idles.spec.ts', '**/native-fire.spec.ts', '**/passengers.spec.ts', '**/native-prop-shots.spec.ts', '**/get-up-under-car.spec.ts',
  '**/attractor-queue.spec.ts', '**/headlight-beams.spec.ts', '**/native-cheats.spec.ts', '**/native-corona-flares.spec.ts', '**/native-coronas.spec.ts', '**/native-evasive.spec.ts', '**/native-traffic-lights.spec.ts', '**/native-upside-down.spec.ts', '**/ped-fall.spec.ts', '**/zone-race-roster.spec.ts'];
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests/browser',
  timeout: 45000,
  // Every spec loads its own page against one shared dev server; the specs are independent, so they run in
  // parallel. Three pages, not four: measured on 2026-09-21, three workers held this machine at 440% CPU and
  // failed seven specs, four at 592% failed nine, and five at 738% failed ten. Wall clock goes the other way
  // (6:10, 4:54, 4:08), so the cheaper setting costs about a minute and buys back both the heat and two
  // spurious failures. PW_WORKERS raises it on a machine with cores to spare.
  fullyParallel: true,
  workers: process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : 3,
  // A few interaction specs time their key presses against game time and can miss under four-page load; one retry
  // reruns them (reported as flaky, not hidden).
  retries: 1,
  use: { baseURL, viewport: { width: 1440, height: 900 }, browserName: 'chromium', channel: 'chrome', screenshot: 'only-on-failure' },
  // Specs that time key presses against game time (walking into a pickup, an idle after 20 s, a crew's fight) miss
  // under four-page load; `npm run test:browser` (scripts/test-browser.mjs) runs them after the rest, with the
  // machine to themselves. They are not a dependency of the parallel project: Playwright skips a dependent project
  // when any test of its dependency fails, which left every quiet spec reported as "did not run".
  projects: [
    { name: 'parallel', testIgnore: LOAD_SENSITIVE },
    { name: 'quiet', testMatch: LOAD_SENSITIVE, fullyParallel: false, workers: 1 },
  ],
  // Own the process: a reused editor server may have a queued HMR full-reload.
  webServer: { command: `npm run dev -- --port ${port} --strictPort`, url: baseURL, reuseExistingServer: false, gracefulShutdown: { signal: 'SIGTERM', timeout: 1000 } },
});
