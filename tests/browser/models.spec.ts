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

test('IDE associations select a differently named dictionary and report missing or conflicting definitions', async ({ page }) => {
  const { readFile } = await import('node:fs/promises');
  const { imgFixture } = await import('../fixtures/native-assets');
  const archive = imgFixture([
    { name: 'diagnostic.dff', bytes: new Uint8Array(await readFile('tests/fixtures/dragonff-model.dff')) },
    { name: 'shared.txd', bytes: new Uint8Array(await readFile('tests/fixtures/dragonff-model-textures.txd')) },
  ]);
  await page.goto('/models.html');
  await page.getByLabel('Or open a .img archive').setInputFiles({ name: 'local.img', mimeType: 'application/octet-stream', buffer: Buffer.from(archive) });
  await expect(page.getByRole('status')).toContainText('directory loaded');
  await expect(page.getByLabel('Archived texture dictionaries')).toHaveValue('-1');
  const definition = (dictionary: string) => ({ name: 'diagnostic.ide', mimeType: 'text/plain', buffer: Buffer.from(`objs\n100, diagnostic, ${dictionary}, 200, 0\nend`) });
  await page.getByLabel('Optional .ide model definitions').setInputFiles(definition('shared'));
  await expect(page.locator('#dictionary-hint')).toHaveText('IDE model 100 selects shared.txd.');
  await expect(page.getByLabel('Archived texture dictionaries')).toHaveValue('1');
  await page.getByRole('button', { name: 'Load archived model' }).click();
  await expect(page.locator('#summary')).toContainText('1 textures bound');
  await page.getByLabel('Optional .ide model definitions').setInputFiles(definition('missing'));
  await expect(page.locator('#dictionary-hint')).toContainText('requires missing.txd');
  await expect(page.getByLabel('Archived texture dictionaries')).toHaveValue('-1');
  await page.getByLabel('Optional .ide model definitions').setInputFiles([definition('shared'), { ...definition('other'), name: 'other.ide' }]);
  await expect(page.locator('#ide-status')).toContainText('Conflicting IDE');
  await page.getByRole('button', { name: 'Remove definitions' }).click();
  await expect(page.locator('#dictionary-hint')).toContainText('No same-name dictionary');
  await page.getByLabel('Optional .ide model definitions').setInputFiles(definition('shared'));
  await page.getByRole('button', { name: 'Clear / cancel' }).click();
  await page.waitForTimeout(100);
  await expect(page.locator('#ide-status')).toContainText('IDE definitions can select');
});

test('IDE texture parents fill missing model textures and expose absent ancestors', async ({ page }) => {
  const { readFile } = await import('node:fs/promises');
  const { imgFixture, txdFixture, textureFixture } = await import('../fixtures/native-assets');
  const archive = imgFixture([
    { name: 'diagnostic.dff', bytes: new Uint8Array(await readFile('tests/fixtures/dragonff-model.dff')) },
    { name: 'child.txd', bytes: txdFixture(textureFixture({ name: 'unrelated' })) },
    { name: 'parent.txd', bytes: new Uint8Array(await readFile('tests/fixtures/dragonff-model-textures.txd')) },
  ]);
  await page.goto('/models.html');
  await page.getByLabel('Or open a .img archive').setInputFiles({ name: 'local.img', mimeType: 'application/octet-stream', buffer: Buffer.from(archive) });
  await expect(page.getByRole('status')).toContainText('directory loaded');
  const definition = (parent: string) => ({ name: 'diagnostic.ide', mimeType: 'text/plain', buffer: Buffer.from(`objs\n100 diagnostic child 200 0\nend\ntxdp\nchild ${parent}\nend`) });
  await page.getByLabel('Optional .ide model definitions').setInputFiles(definition('parent'));
  await expect(page.locator('#ide-status')).toContainText('1 texture-parent links');
  await page.getByRole('button', { name: 'Load archived model' }).click();
  await expect(page.locator('#summary')).toContainText('1 textures bound');
  await expect(page.locator('#metadata')).toContainText('child.txd → parent.txd');
  await expect(page.locator('#warnings')).not.toContainText('Unbound textures');
  await page.getByLabel('Optional .ide model definitions').setInputFiles(definition('missing'));
  await expect(page.locator('#ide-status')).toContainText('1 texture-parent links');
  await page.getByRole('button', { name: 'Load archived model' }).click();
  await expect(page.locator('#warnings')).toContainText('Missing parent dictionary: missing.txd');
  await expect(page.locator('#summary')).toContainText('0 textures bound');
});

test('local IPL preview places repeated models, filters interiors and restores an unplaced model', async ({ page }) => {
  const { readFile } = await import('node:fs/promises');
  await page.goto('/models.html');
  await page.getByLabel('Open a .dff model').setInputFiles({ name: 'diagnostic.dff', mimeType: 'application/octet-stream', buffer: await readFile('tests/fixtures/dragonff-model.dff') });
  await expect(page.getByRole('status')).toHaveText('diagnostic.dff loaded locally.');
  const before = await page.evaluate(() => (window as any).__modelPreview.state());
  await page.getByLabel('Optional .ipl placements').setInputFiles({ name: 'diagnostic.ipl', mimeType: 'text/plain', buffer: Buffer.from('inst\n100 diagnostic 0 0 0 0 0 0 0 1 -1\n100 diagnostic 0 10 0 0 0 0 0 1 -1\n100 diagnostic 4 20 0 0 0 0 0 1 -1\nend') });
  await page.getByRole('button', { name: 'Apply placements' }).click();
  await expect(page.locator('#summary')).toContainText('2 placements');
  const placed = await page.evaluate(() => (window as any).__modelPreview.state());
  expect(placed.triangles).toBe(12); expect(placed.memory.geometries).toBe(before.memory.geometries);
  expect(placed.target[0]).toBeCloseTo(before.target[0] + 5);
  await page.screenshot({ path: 'artifacts/ipl-model-preview.png', fullPage: true });
  await page.getByLabel('Placement interior', { exact: true }).fill('4');
  await page.getByRole('button', { name: 'Apply placements' }).click();
  await expect(page.locator('#summary')).toContainText('1 placements');
  expect((await page.evaluate(() => (window as any).__modelPreview.state())).target[0]).toBeCloseTo(before.target[0] + 20);
  await page.getByLabel('Placement interior', { exact: true }).fill('5');
  await page.getByRole('button', { name: 'Apply placements' }).click();
  await expect(page.getByRole('status')).toContainText('No placements');
  await page.getByRole('button', { name: 'Remove placements' }).click();
  await expect(page.getByRole('status')).toHaveText('diagnostic.dff loaded locally.');
  expect((await page.evaluate(() => (window as any).__modelPreview.state())).target).toEqual(before.target);
});

test('binary IPL preview resolves a selected model through IDE data', async ({ page }) => {
  const { readFile } = await import('node:fs/promises');
  const bytes = Buffer.alloc(116); bytes.write('bnry'); bytes.writeUInt32LE(1, 4); bytes.writeUInt32LE(76, 28);
  bytes.writeFloatLE(50, 76); bytes.writeFloatLE(1, 100); bytes.writeInt32LE(100, 104); bytes.writeInt32LE(-1, 112);
  await page.goto('/models.html');
  await page.getByLabel('Open a .dff model').setInputFiles({ name: 'diagnostic.dff', mimeType: 'application/octet-stream', buffer: await readFile('tests/fixtures/dragonff-model.dff') });
  await expect(page.getByRole('status')).toHaveText('diagnostic.dff loaded locally.');
  await page.getByLabel('Optional .ipl placements').setInputFiles({ name: 'stream.ipl', mimeType: 'application/octet-stream', buffer: bytes });
  await page.getByRole('button', { name: 'Apply placements' }).click();
  await expect(page.getByRole('status')).toContainText('requires an IDE model ID');
  await page.getByLabel('Optional .ide model definitions').setInputFiles({ name: 'diagnostic.ide', mimeType: 'text/plain', buffer: Buffer.from('objs\n100 diagnostic shared 200 0\nend') });
  await expect(page.locator('#ide-status')).toContainText('1 model associations');
  await page.getByRole('button', { name: 'Apply placements' }).click();
  await expect(page.locator('#summary')).toContainText('1 placements');
  expect((await page.evaluate(() => (window as any).__modelPreview.state())).target[0]).toBeCloseTo(54);
  await page.getByRole('button', { name: 'Clear / cancel' }).click();
  expect(await page.getByLabel('Optional .ipl placements').inputValue()).toBe('');
});

test('archive scene assembles multiple model types and reports omitted placements', async ({ page }) => {
  const { readFile } = await import('node:fs/promises');
  const { imgFixture } = await import('../fixtures/native-assets');
  const model = new Uint8Array(await readFile('tests/fixtures/dragonff-model.dff'));
  const archive = imgFixture([{ name: 'first.dff', bytes: model }, { name: 'second.dff', bytes: model }]);
  await page.goto('/models.html');
  await page.getByLabel('Or open a .img archive').setInputFiles({ name: 'scene.img', mimeType: 'application/octet-stream', buffer: Buffer.from(archive) });
  await expect(page.getByRole('status')).toContainText('directory loaded');
  await page.getByLabel('Optional .ipl placements').setInputFiles({ name: 'scene.ipl', mimeType: 'text/plain', buffer: Buffer.from('inst\n1 first 0 0 0 0 0 0 0 1 -1\n1 first 0 10 0 0 0 0 0 1 -1\n2 second 0 20 0 0 0 0 0 1 -1\n3 absent 0 30 0 0 0 0 0 1 -1\nend') });
  await page.getByRole('button', { name: 'Assemble archive scene' }).click();
  await expect(page.getByRole('status')).toHaveText('Archive scene assembled locally.');
  await expect(page.locator('#summary')).toHaveText('2 model types · 3 placements · 1 omitted placements');
  await expect(page.locator('#warnings')).toContainText('Missing model: absent.dff');
  const state = await page.evaluate(() => (window as any).__modelPreview.state());
  expect(state.triangles).toBe(18); expect(state.target[0]).toBeCloseTo(14);
  await page.screenshot({ path: 'artifacts/archive-scene-preview.png', fullPage: true });
  await page.getByRole('button', { name: 'Assemble archive scene' }).click();
  await expect(page.getByRole('status')).toHaveText('Archive scene assembled locally.');
  expect((await page.evaluate(() => (window as any).__modelPreview.state())).memory).toEqual(state.memory);
  await page.getByRole('button', { name: 'Clear / cancel' }).click();
  expect((await page.evaluate(() => (window as any).__modelPreview.state())).memory.geometries).toBe(0);
});
