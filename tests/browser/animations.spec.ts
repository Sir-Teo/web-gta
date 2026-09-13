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

test('local clip playback scrubs a skinned rig, pauses, restores its pose and cancels on replacement', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/models.html');
  await page.getByLabel('Open a .dff model').setInputFiles('tests/fixtures/dragonff-skin.dff');
  await expect(page.getByRole('status')).toHaveText('dragonff-skin.dff loaded locally.');
  const pixelHash = () => page.locator('#model-canvas').evaluate(canvas => {
    const c = canvas as HTMLCanvasElement, gl = c.getContext('webgl2')!, pixels = new Uint8Array(c.width * c.height * 4);
    gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    let hash = 2166136261; for (const byte of pixels) hash = Math.imul(hash ^ byte, 16777619); return hash;
  });
  const rest = await pixelHash();
  await page.getByLabel('Optional .ifp animations').setInputFiles('tests/fixtures/animation-rig.ifp');
  await expect(page.locator('#animation-status')).toContainText('2 tracks bound');
  await page.getByLabel('Animation time', { exact: true }).press('End');
  await expect(page.locator('#animation-clock')).toHaveText('2.000 / 2.000 s');
  expect(await pixelHash()).not.toBe(rest);
  await page.getByRole('button', { name: 'Restore bind pose' }).click(); expect(await pixelHash()).toBe(rest);
  await page.getByLabel('Animation clip', { exact: true }).selectOption('0');
  await page.getByRole('button', { name: 'Play animation', exact: true }).click();
  await expect.poll(async () => Number((await page.locator('#animation-clock').textContent())!.split(' / ')[0])).toBeGreaterThan(.1);
  await page.getByRole('button', { name: 'Pause animation', exact: true }).click();
  const time = await page.locator('#animation-clock').textContent(); await page.waitForTimeout(150); await expect(page.locator('#animation-clock')).toHaveText(time!);
  await page.getByRole('button', { name: 'Frame model', exact: true }).click();
  await page.locator('#model-canvas').screenshot({ path: 'artifacts/native-animation-playback.png' });
  await page.getByLabel('Optional .ifp animations').setInputFiles({ name: 'bad.ifp', mimeType: 'application/octet-stream', buffer: Buffer.from('ANPK') });
  await expect(page.locator('#animation-status')).toContainText('Unsupported IFP');
  await expect(page.getByRole('button', { name: 'Play animation', exact: true })).toBeDisabled();
  await page.getByLabel('Optional .ifp animations').setInputFiles('tests/fixtures/animation-rig.ifp');
  await expect(page.locator('#animation-status')).toContainText('2 tracks bound');
  await page.getByRole('button', { name: 'Play animation', exact: true }).click();
  await page.getByLabel('Open a .dff model').setInputFiles('tests/fixtures/dragonff-model.dff');
  await expect(page.getByRole('status')).toHaveText('dragonff-model.dff loaded locally.');
  await expect(page.getByRole('button', { name: 'Play animation', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Animation clip', { exact: true })).toBeDisabled(); expect(errors).toEqual([]);
});
