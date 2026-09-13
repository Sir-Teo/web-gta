import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
test('animation worker decodes local source tracks and rejects unsupported containers without uploads', async ({ page }) => {
  const requests: { url: string; method: string }[] = [];
  page.on('request', r => requests.push({ url: r.url(), method: r.method() }));
  await page.goto('/models.html');
  const source = [...await readFile('tests/fixtures/animation-anp3.ifp')];
  const result = await page.evaluate(async bytes => {
    const worker = new Worker('/src/assets/model.worker.ts', { type: 'module' });
    try {
      return await new Promise<any>((resolve, reject) => {
        worker.onerror = e => reject(new Error(e.message)); worker.onmessage = e => resolve(e.data);
        worker.postMessage({ action: 'animation', file: new File([new Uint8Array(bytes)], 'motion.ifp') });
      });
    } finally { worker.terminate(); }
  }, source);
  expect(result.error).toBeUndefined(); expect(result.name).toBe('motion.ifp');
  expect(result.animation.animations[0].duration).toBe(2);
  expect(Array.from(result.animation.animations[0].tracks[0].translations)).toEqual([0, 0, 0, 1, -2, .5, 2, -4, 1]);
  const error = await page.evaluate(async () => {
    const worker = new Worker('/src/assets/model.worker.ts', { type: 'module' });
    try {
      return await new Promise<string>((resolve, reject) => {
        worker.onerror = e => reject(new Error(e.message)); worker.onmessage = e => resolve(e.data.error);
        worker.postMessage({ action: 'animation', file: new File(['ANPK'], 'unsupported.ifp') });
      });
    } finally { worker.terminate(); }
  });
  expect(error).toContain('Unsupported IFP');
  expect(requests.every(r => r.method === 'GET' && new URL(r.url).origin === new URL(page.url()).origin)).toBe(true);
});
