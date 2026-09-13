import { test, expect } from '@playwright/test';

test('local model worker renders independent DFF geometry and changes source vertex lighting', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/models.html');
  await page.getByLabel('Open a .dff model').setInputFiles('tests/fixtures/dragonff-model.dff');
  await expect(page.getByRole('status')).toHaveText('dragonff-model.dff loaded locally.');
  expect(await page.evaluate(() => (window as any).__modelPreview.state().triangles)).toBe(6);
  await expect(page.locator('#summary')).toContainText('2 frames · 1 atomics · 5 source vertices · 6 source triangles');
  await expect(page.locator('#warnings')).toContainText('Unbound textures: calibration_grid');
  await page.getByText('Frames and materials', { exact: true }).click();
  await expect(page.locator('#metadata')).toContainText('rotated_pyramid');
  const canvas = page.getByLabel('Model preview');
  const day = await canvas.screenshot();
  await page.screenshot({ path: 'artifacts/local-model-day.png', fullPage: true });
  await page.getByLabel('Day / night vertex colors').fill('1');
  const night = await canvas.screenshot(); expect(night.equals(day)).toBe(false);
  await page.screenshot({ path: 'artifacts/local-model-night.png', fullPage: true });
  const bounds = (await canvas.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2); await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 120, bounds.y + bounds.height / 2 + 50, { steps: 8 }); await page.mouse.up();
  expect((await canvas.screenshot()).equals(night)).toBe(false);
  await page.getByRole('button', { name: 'Frame model' }).click();
  await page.getByRole('button', { name: 'Clear / cancel' }).click(); await expect(page.getByRole('status')).toHaveText('Local model cleared.');
  expect(errors).toEqual([]);
});
test('model preview recovers from bad files, replaces pending files and fits a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/models.html');
  const input = page.getByLabel('Open a .dff model');
  await input.setInputFiles({ name: 'bad.dff', mimeType: 'application/octet-stream', buffer: Buffer.from([1, 2, 3]) });
  await expect(page.getByRole('status')).toContainText('Truncated');
  await input.setInputFiles('tests/fixtures/dragonff-model.dff');
  await input.setInputFiles('tests/fixtures/dragonff-model-strips.dff');
  await expect(page.getByRole('status')).toHaveText('dragonff-model-strips.dff loaded locally.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({ path: 'artifacts/local-model-mobile.png', fullPage: true });
});

test('binding and removing a local TXD changes model pixels without retaining old textures', async ({ page }) => {
  const { textureFixture, txdFixture } = await import('../fixtures/native-assets');
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/models.html'); await page.getByLabel('Open a .dff model').setInputFiles('tests/fixtures/dragonff-model.dff');
  await expect(page.locator('#summary')).toContainText('0 textures bound');
  const canvas = page.getByLabel('Model preview'), plain = await canvas.screenshot();
  const upload = async () => page.getByLabel('Optional .txd texture dictionary').setInputFiles({ name: 'calibration.txd', mimeType: 'application/octet-stream', buffer: Buffer.from(txdFixture(textureFixture())) });
  await upload(); await expect(page.locator('#summary')).toContainText('1 textures bound');
  expect((await canvas.screenshot()).equals(plain)).toBe(false);
  await expect(page.locator('#warnings')).not.toContainText('Unbound textures');
  await page.screenshot({ path: 'artifacts/local-model-textured.png', fullPage: true });
  const resources = () => page.evaluate(() => (window as any).__modelPreview.state().memory);
  const loaded = await resources(); expect(loaded.textures).toBe(1);
  await upload(); await expect(page.locator('#summary')).toContainText('1 textures bound'); expect(await resources()).toEqual(loaded);
  await page.getByRole('button', { name: 'Remove textures' }).click(); await expect(page.locator('#summary')).toContainText('0 textures bound');
  expect((await resources()).textures).toBe(0);
  expect((await canvas.screenshot()).equals(plain)).toBe(true);
  expect(errors).toEqual([]);
});

test('local IMG model selection binds an archive dictionary and recovers from a bad entry', async ({ page }) => {
  const { readFile } = await import('node:fs/promises');
  const { imgFixture } = await import('../fixtures/native-assets');
  const archive = imgFixture([
    { name: 'diagnostic.dff', bytes: new Uint8Array(await readFile('tests/fixtures/dragonff-model.dff')) },
    { name: 'diagnostic.txd', bytes: new Uint8Array(await readFile('tests/fixtures/dragonff-model-textures.txd')) },
    { name: 'broken.dff', bytes: new Uint8Array(20) },
  ]);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/models.html');
  await page.getByLabel('Or open a .img archive').setInputFiles({ name: 'local.img', mimeType: 'application/octet-stream', buffer: Buffer.from(archive) });
  await expect(page.getByRole('status')).toHaveText('local.img directory loaded. Choose a model to preview.');
  await expect(page.locator('#archive-count')).toHaveText('2 models · 1 texture dictionaries · 3 total entries');
  await expect(page.getByLabel('Archived texture dictionaries')).toHaveValue('1');
  await page.getByRole('button', { name: 'Load archived model' }).click();
  await expect(page.getByRole('status')).toHaveText('local.img / diagnostic.dff loaded locally.');
  await expect(page.locator('#summary')).toContainText('1 textures bound');
  expect(await page.evaluate(() => (window as any).__modelPreview.state().triangles)).toBe(6);
  await page.screenshot({ path: 'artifacts/archive-model-preview.png', fullPage: true });
  await page.getByLabel('Find an archived model').fill('broken');
  await page.getByRole('button', { name: 'Load archived model' }).click();
  await expect(page.getByRole('status')).toContainText('not a RenderWare model');
  await page.getByLabel('Find an archived model').fill('diagnostic');
  await page.getByLabel('Archived texture dictionaries').selectOption('-1');
  await page.getByRole('button', { name: 'Load archived model' }).click();
  await expect(page.locator('#summary')).toContainText('0 textures bound');
  await page.getByLabel('Optional .txd texture dictionary').setInputFiles('tests/fixtures/dragonff-model-textures.txd');
  await expect(page.locator('#summary')).toContainText('1 textures bound');
  await page.getByRole('button', { name: 'Clear / cancel' }).click();
  await expect(page.locator('#archive-browser')).toBeHidden();
  expect(errors).toEqual([]);
});

test('switching from an IMG to a standalone model cancels archive work and clears its selection', async ({ page }) => {
  const { imgFixture, textureFixture, txdFixture } = await import('../fixtures/native-assets');
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/models.html');
  await page.getByLabel('Or open a .img archive').setInputFiles({ name: 'textures-only.img', mimeType: 'application/octet-stream', buffer: Buffer.from(imgFixture([{ name: 'only.txd', bytes: txdFixture(textureFixture()) }])) });
  await expect(page.getByRole('status')).toContainText('directory loaded');
  await expect(page.getByRole('button', { name: 'Load archived model' })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.getByLabel('Open a .dff model').setInputFiles('tests/fixtures/dragonff-model.dff');
  await expect(page.getByRole('status')).toHaveText('dragonff-model.dff loaded locally.');
  await expect(page.locator('#archive-browser')).toBeHidden();
  await page.getByLabel('Or open a .img archive').setInputFiles({ name: 'cancel.img', mimeType: 'application/octet-stream', buffer: Buffer.alloc(8) });
  await page.getByRole('button', { name: 'Clear / cancel' }).click(); await page.waitForTimeout(150);
  await expect(page.getByRole('status')).toHaveText('Local model cleared.');
});
