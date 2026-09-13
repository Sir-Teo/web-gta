import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { preview } from 'vite';

const server = await preview({ preview: { host: '127.0.0.1', port: 5185, strictPort: true } });
let browser;
try {
  const base = server.resolvedUrls.local[0];
  browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => requests.push(request.url()));
  let releasePhysics;
  const gate = new Promise(resolve => { releasePhysics = resolve; });
  await page.route('**/physics-*.js', async route => { await gate; await route.continue(); });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Loading the neighborhood…' })).toBeVisible();
  releasePhysics();
  await page.getByRole('button', { name: 'Begin game' }).click();
  await page.keyboard.down('KeyW'); await page.waitForTimeout(900); await page.keyboard.up('KeyW');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => typeof window.__game)).toBe('undefined');
  const graphics = await page.evaluate(() => {
    const gl = document.querySelector('.world').getContext('webgl2');
    const extension = gl.getExtension('WEBGL_debug_renderer_info');
    return { renderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), viewport: [innerWidth, innerHeight] };
  });
  expect(errors).toEqual([]);
  expect(requests.every(url => new URL(url).origin === new URL(base).origin)).toBe(true);
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/production.png' });
  expect(requests.some(url => url.includes('model-controls-'))).toBe(false);
  await page.keyboard.press('Escape');
  const popup = page.waitForEvent('popup');
  await page.getByRole('link', { name: 'Local texture library' }).click();
  const workshop = await popup;
  workshop.on('pageerror', error => errors.push(error.message));
  workshop.on('request', request => requests.push(request.url()));
  await expect(workshop.getByRole('heading', { name: 'Local texture library' })).toBeVisible();
  await workshop.getByLabel('Open a .txd or .img file').setInputFiles('tests/fixtures/dragonff-diagnostic.txd');
  await expect(workshop.getByRole('status')).toHaveText('independent_rgba · mip 0 decoded locally.');
  await workshop.getByLabel('Textures', { exact: true }).selectOption('1');
  await expect(workshop.getByRole('status')).toHaveText('independent_dxt1 · mip 0 decoded locally.');
  expect(await workshop.locator('#pixels').evaluate(canvas => [...canvas.getContext('2d').getImageData(0, 0, 1, 1).data])).toEqual([255, 0, 0, 255]);
  await workshop.getByRole('link', { name: 'Local model preview' }).click();
  await workshop.getByLabel('Open a .dff model').setInputFiles('tests/fixtures/dragonff-model.dff');
  await expect(workshop.getByRole('status')).toHaveText('dragonff-model.dff loaded locally.');
  expect(await workshop.evaluate(() => typeof window.__modelPreview)).toBe('undefined');
  const modelPixel = await workshop.locator('#model-canvas').evaluate(canvas => {
    const gl = canvas.getContext('webgl2'), pixel = new Uint8Array(4);
    gl.readPixels(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    return [...pixel];
  });
  expect(modelPixel[0] + modelPixel[1] + modelPixel[2]).toBeGreaterThan(100);
  await workshop.close();
  expect(errors).toEqual([]);
  expect(requests.every(url => new URL(url).origin === new URL(base).origin)).toBe(true);
  const report = { assetWorkshopVerified: true, modelPreviewVerified: true, checkedAt: new Date().toISOString(), browser: browser.version(), graphics, errors, requests, loadingShellVerified: true, developmentHookAbsent: true, externalRuntimeRequests: false };
  await writeFile('artifacts/production-smoke.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
}
