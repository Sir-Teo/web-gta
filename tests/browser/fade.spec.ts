import { expect, test } from '@playwright/test';

test('native GPU fades cap alpha, keep shared siblings unchanged and restore source materials', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/tests/fixtures/fade.html');
  await page.waitForFunction(() => typeof (window as any).fadeProbe === 'function');
  const result = await page.evaluate(() => (window as any).fadeProbe());
  for (const [key, expected] of Object.entries({ original: [128,128], partial: [64,128], capped: [128,128], restored: [128,128], modulation: [128,255], unmodulated: [255,255] })) {
    for (let side = 0; side < 2; side++) for (const value of result[key][side].slice(0,3)) expect(Math.abs(value-expected[side]), `${key} side ${side}`).toBeLessThanOrEqual(2);
  }
  expect(errors).toEqual([]);
});
