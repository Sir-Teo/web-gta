import { test, expect } from '@playwright/test';
import { imgFixture, textureFixture, txdFixture } from '../fixtures/native-assets';
const fixture = (name = 'calibration_grid') => txdFixture(textureFixture({ name }));

test('local TXD worker previews exact pixels and original mip levels without uploads', async ({ page }) => {
  const errors: string[] = [], requests: { url: string; method: string }[] = [];
  page.on('pageerror', error => errors.push(error.message)); page.on('request', request => requests.push({ url: request.url(), method: request.method() }));
  await page.goto('/assets.html');
  await expect(page.getByLabel('Open a .txd or .img file')).toBeEnabled();
  await page.getByLabel('Open a .txd or .img file').setInputFiles({ name: 'calibration.txd', mimeType: 'application/octet-stream', buffer: Buffer.from(fixture()) });
  await expect(page.getByRole('status')).toHaveText('calibration_grid · mip 0 decoded locally.');
  const pixel = () => page.locator('#pixels').evaluate(canvas => [...(canvas as HTMLCanvasElement).getContext('2d')!.getImageData(0, 0, 1, 1).data]);
  expect(await pixel()).toEqual([40, 75, 180, 255]);
  await expect(page.locator('#metadata')).toContainText('2 mip levels');
  await page.screenshot({ path: 'artifacts/local-texture-library.png' });
  await page.getByLabel('Mip level').selectOption('1');
  await expect(page.getByRole('status')).toHaveText('calibration_grid · mip 1 decoded locally.');
  expect(await pixel()).toEqual([128, 128, 128, 128]);
  await page.getByLabel('Smooth preview').check(); await expect(page.locator('#pixels')).toHaveCSS('image-rendering', 'auto');
  expect(requests.every(r => r.method === 'GET' && new URL(r.url).origin === new URL(page.url()).origin)).toBe(true);
  expect(errors).toEqual([]);
});

test('IMG selection opens dictionaries, reports bad data and clears or replaces local files', async ({ page }) => {
  await page.goto('/assets.html');
  const archive = imgFixture([{ name: 'grid.txd', bytes: fixture() }, { name: 'broken.txd', bytes: new Uint8Array(40) }, { name: 'model.dff', bytes: new Uint8Array(40) }]);
  const input = page.getByLabel('Open a .txd or .img file');
  await input.setInputFiles({ name: 'diagnostic.img', mimeType: 'application/octet-stream', buffer: Buffer.from(archive) });
  await expect(page.getByRole('status')).toContainText('3 archive entries');
  await expect(page.getByLabel('Texture dictionaries').locator('option')).toHaveCount(2);
  await page.getByLabel('Texture dictionaries').selectOption('1'); await page.getByRole('button', { name: 'Open dictionary' }).click();
  await expect(page.getByRole('status')).toContainText('not a RenderWare');
  await page.getByLabel('Find a dictionary').fill('grid'); await page.getByRole('button', { name: 'Open dictionary' }).click();
  await expect(page.getByRole('status')).toHaveText('calibration_grid · mip 0 decoded locally.');
  await input.setInputFiles({ name: 'earlier.txd', mimeType: 'application/octet-stream', buffer: Buffer.from(fixture('earlier')) });
  await input.setInputFiles({ name: 'latest.txd', mimeType: 'application/octet-stream', buffer: Buffer.from(fixture('latest')) });
  await expect(page.getByRole('status')).toHaveText('latest · mip 0 decoded locally.');
  await page.getByRole('button', { name: 'Clear / cancel' }).click(); await page.waitForTimeout(150);
  await expect(page.locator('#texture-preview')).toBeHidden(); await expect(page.getByRole('status')).toContainText('Local file cleared');
  await input.setInputFiles({ name: 'cancel.txd', mimeType: 'application/octet-stream', buffer: Buffer.from(fixture()) });
  await page.getByRole('button', { name: 'Clear / cancel' }).click(); await page.waitForTimeout(150);
  await expect(page.locator('#texture-preview')).toBeHidden(); await expect(page.getByRole('status')).toContainText('Local file cleared');
});

test('texture library remains usable at a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/assets.html');
  await page.getByLabel('Open a .txd or .img file').setInputFiles({ name: 'calibration.txd', mimeType: 'application/octet-stream', buffer: Buffer.from(fixture()) });
  await expect(page.getByRole('status')).toContainText('decoded locally');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({ path: 'artifacts/local-textures-mobile.png', fullPage: true });
});
