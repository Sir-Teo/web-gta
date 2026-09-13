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
  const archive = imgFixture([{ name: 'first.dff', bytes: model }, { name: 'second.dff', bytes: model }, { name: 'shared.txd', bytes: new Uint8Array(await readFile('tests/fixtures/dragonff-model-textures.txd')) }]);
  await page.goto('/models.html');
  await page.getByLabel('Or open a .img archive').setInputFiles({ name: 'scene.img', mimeType: 'application/octet-stream', buffer: Buffer.from(archive) });
  await expect(page.getByRole('status')).toContainText('directory loaded');
  await page.getByLabel('Optional .ide model definitions').setInputFiles({ name: 'scene.ide', mimeType: 'text/plain', buffer: Buffer.from('objs\n1 first shared 200 0\n2 second shared 200 0\nend') });
  await expect(page.locator('#ide-status')).toContainText('2 model associations');
  await page.getByLabel('Optional .ipl placements').setInputFiles({ name: 'scene.ipl', mimeType: 'text/plain', buffer: Buffer.from('inst\n1 first 0 0 0 0 0 0 0 1 2\n1 first 0 10 0 0 0 0 0 1 -1\n2 second 0 20 0 0 0 0 0 1 -1\n3 absent 0 30 0 0 0 0 0 1 -1\nend') });
  await page.getByRole('button', { name: 'Assemble archive scene' }).click();
  await expect(page.getByRole('status')).toHaveText('Archive scene assembled locally.');
  await expect(page.locator('#summary')).toHaveText('2 model types · 3 placements · 1 omitted placements');
  await expect(page.locator('#warnings')).toContainText('Missing model: absent.dff');
  await page.locator('details > summary').click();
  await expect(page.locator('#metadata')).toContainText('source indices 0, 1 · draw distance 200 · flags 0');
  await expect(page.locator('#metadata')).toContainText('LOD 0 → 2: local');
  const state = await page.evaluate(() => (window as any).__modelPreview.state());
  expect(state.memory.textures).toBe(1);
  await page.getByRole('button', { name: 'Remove collision' }).click();
  await expect(page.getByRole('status')).toHaveText('Archive scene assembled locally.');
  expect(state.triangles).toBe(18); expect(state.target[0]).toBeCloseTo(14);
  await page.screenshot({ path: 'artifacts/archive-scene-preview.png', fullPage: true });
  await page.getByRole('button', { name: 'Assemble archive scene' }).click();
  await expect(page.getByRole('status')).toHaveText('Archive scene assembled locally.');
  expect((await page.evaluate(() => (window as any).__modelPreview.state())).memory).toEqual(state.memory);
  await page.getByRole('button', { name: 'Clear / cancel' }).click();
  expect((await page.evaluate(() => (window as any).__modelPreview.state())).memory.geometries).toBe(0);
});

test('archived IPL selection assembles a scene and recovers from bad placement entries', async ({ page }) => {
  const { readFile } = await import('node:fs/promises');
  const { imgFixture } = await import('../fixtures/native-assets');
  const archive = imgFixture([
    { name: 'diagnostic.dff', bytes: new Uint8Array(await readFile('tests/fixtures/dragonff-model.dff')) },
    { name: 'map.ipl', bytes: new TextEncoder().encode('inst\n100 diagnostic 0 10 0 0 0 0 0 1 -1\nend') },
    { name: 'bad.ipl', bytes: new TextEncoder().encode('inst\ninvalid\nend') },
  ]);
  await page.goto('/models.html');
  await page.getByLabel('Or open a .img archive').setInputFiles({ name: 'map.img', mimeType: 'application/octet-stream', buffer: Buffer.from(archive) });
  await expect(page.getByRole('status')).toContainText('directory loaded');
  await page.getByLabel('Find archived placements').fill('map');
  await page.getByLabel('Archived IPL files').selectOption('1');
  await page.getByRole('button', { name: 'Assemble archive scene' }).click();
  await expect(page.getByRole('status')).toHaveText('Archive scene assembled locally.');
  await expect(page.locator('#metadata')).toContainText('Placement source: map.img / map.ipl');
  expect((await page.evaluate(() => (window as any).__modelPreview.state())).target[0]).toBeCloseTo(14);
  await page.getByLabel('Find archived placements').fill('bad');
  await page.getByLabel('Archived IPL files').selectOption('2');
  await page.getByRole('button', { name: 'Assemble archive scene' }).click();
  await expect(page.getByRole('status')).toContainText('expected 11');
  await page.getByLabel('Optional .ipl placements').setInputFiles({ name: 'external.ipl', mimeType: 'text/plain', buffer: Buffer.from('inst\n100 diagnostic 0 20 0 0 0 0 0 1 -1\nend') });
  await page.getByRole('button', { name: 'Apply placements' }).click();
  await expect(page.locator('#metadata')).toContainText('Placement source: external.ipl');
  expect((await page.evaluate(() => (window as any).__modelPreview.state())).target[0]).toBeCloseTo(24);
  await page.getByRole('button', { name: 'Remove placements' }).click();
  await expect(page.getByRole('status')).toHaveText('map.img / diagnostic.dff loaded locally.');
  await expect(page.getByLabel('Archived IPL files')).toHaveValue('-1');
  await page.getByRole('button', { name: 'Clear / cancel' }).click();
  await expect(page.locator('#placement-archive-browser')).toBeHidden();
});

test('local collision overlay can be inspected, toggled and removed without leaking geometry', async ({ page }) => {
  const { readFile } = await import('node:fs/promises');
  await page.goto('/models.html');
  await page.getByLabel('Open a .dff model').setInputFiles({ name: 'diagnostic_col3.dff', mimeType: 'application/octet-stream', buffer: await readFile('tests/fixtures/dragonff-model.dff') });
  await expect(page.getByRole('status')).toHaveText('diagnostic_col3.dff loaded locally.');
  const before = await page.evaluate(() => (window as any).__modelPreview.state());
  await page.getByLabel('Optional .col collision collection').setInputFiles('tests/fixtures/dragonff-collision-v3.col');
  await page.getByRole('button', { name: 'Apply placements' }).click();
  await expect.poll(async () => (await page.evaluate(() => (window as any).__modelPreview.state())).collisionOverlays).toBe(1);
  const loaded = await page.evaluate(() => (window as any).__modelPreview.state());
  expect(loaded.lines).toBeGreaterThan(100); expect(loaded.triangles).toBe(6);
  await page.screenshot({ path: 'artifacts/collision-overlay.png', fullPage: true });
  await page.getByLabel('Show collision overlay').uncheck();
  expect((await page.evaluate(() => (window as any).__modelPreview.state())).lines).toBe(0);
  await page.getByLabel('Show collision overlay').check();
  expect((await page.evaluate(() => (window as any).__modelPreview.state())).lines).toBe(loaded.lines);
  await page.getByRole('button', { name: 'Remove collision' }).click();
  await expect.poll(async () => (await page.evaluate(() => (window as any).__modelPreview.state())).memory.geometries).toBe(before.memory.geometries);
  await page.getByRole('button', { name: 'Clear / cancel' }).click();
  expect((await page.evaluate(() => (window as any).__modelPreview.state())).memory.geometries).toBe(0);
});

test('archived collision collections drive scene overlays with explicit source and override behavior', async ({ page }) => {
  const { readFile } = await import('node:fs/promises');
  const { imgFixture } = await import('../fixtures/native-assets');
  const archive = imgFixture([
    { name: 'diagnostic_col3.dff', bytes: new Uint8Array(await readFile('tests/fixtures/dragonff-model.dff')) },
    { name: 'district.col', bytes: new Uint8Array(await readFile('tests/fixtures/dragonff-collision-v3.col')) },
    { name: 'broken.col', bytes: new Uint8Array(10) },
  ]);
  await page.goto('/models.html');
  await page.getByLabel('Or open a .img archive').setInputFiles({ name: 'district.img', mimeType: 'application/octet-stream', buffer: Buffer.from(archive) });
  await expect(page.getByRole('status')).toContainText('directory loaded');
  await page.getByLabel('Find archived collision collections').fill('district');
  await page.getByLabel('Archived COL files').selectOption('1');
  await page.getByLabel('Optional .ipl placements').setInputFiles({ name: 'scene.ipl', mimeType: 'text/plain', buffer: Buffer.from('inst\n103 diagnostic_col3 0 10 0 0 0 0 0 1 -1\nend') });
  await page.getByRole('button', { name: 'Assemble archive scene' }).click();
  await expect(page.getByRole('status')).toHaveText('Archive scene assembled locally.');
  await expect(page.locator('#metadata')).toContainText('Collision source: district.img / district.col');
  expect((await page.evaluate(() => (window as any).__modelPreview.state())).collisionOverlays).toBe(1);
  await page.getByLabel('Find archived collision collections').fill('broken');
  await page.getByLabel('Archived COL files').selectOption('2');
  await page.getByRole('button', { name: 'Assemble archive scene' }).click();
  await expect(page.getByRole('status')).toContainText('No collision models');
  await page.getByLabel('Optional .col collision collection').setInputFiles('tests/fixtures/dragonff-collision-v3.col');
  await page.getByRole('button', { name: 'Assemble archive scene' }).click();
  await expect(page.locator('#metadata')).toContainText('Collision source: dragonff-collision-v3.col');
  await page.getByRole('button', { name: 'Remove collision' }).click();
  await expect(page.getByRole('status')).toHaveText('Archive scene assembled locally.');
  expect((await page.evaluate(() => (window as any).__modelPreview.state())).collisionOverlays).toBe(0);
  await expect(page.getByLabel('Archived COL files')).toHaveValue('-1');
  await page.getByRole('button', { name: 'Clear / cancel' }).click();
  await expect(page.locator('#collision-archive-browser')).toBeHidden();
});

test('assembled native scene opens in the game and supports real keyboard walking on source collision', async ({ page }) => {
  test.setTimeout(60000);
  const { readFile } = await import('node:fs/promises');
  const { imgFixture } = await import('../fixtures/native-assets');
  const archive = imgFixture([{ name: 'walk_floor.dff', bytes: new Uint8Array(await readFile('tests/fixtures/walk-floor-building.dff')) }, { name: 'floor_lod.dff', bytes: new Uint8Array(await readFile('tests/fixtures/walk-floor-building.dff')) }, { name: 'floor.col', bytes: new Uint8Array(await readFile('tests/fixtures/walk-floor.col')) }]);
  await page.goto('/models.html');
  await page.getByLabel('Or open a .img archive').setInputFiles({ name: 'walk.img', mimeType: 'application/octet-stream', buffer: Buffer.from(archive) });
  await expect(page.getByRole('status')).toContainText('directory loaded');
  await page.getByLabel('Optional .ide model definitions').setInputFiles({name:'timed.ide',mimeType:'text/plain',buffer:Buffer.from('tobj\n500 walk_floor walk_floor 6 0 17 18\nend')});
  await expect(page.locator('#ide-status')).toContainText('1 model associations');
  await page.getByLabel('Archived COL files').selectOption('2');
  await page.getByLabel('Optional .ipl placements').setInputFiles({ name: 'walk.ipl', mimeType: 'text/plain', buffer: Buffer.from('inst\n500 walk_floor 0 100 200 5 0 0 0 1 1\n501 floor_lod 0 100 200 5 0 0 0 1 -1\nend') });
  await page.getByRole('button', { name: 'Assemble archive scene' }).click();
  await expect(page.getByRole('button', { name: 'Walk scene', exact: true })).toBeEnabled();
  await expect(page.locator('#metadata')).toContainText('from walk_floor (inherited)');
  const popup = page.waitForEvent('popup'); await page.getByRole('button', { name: 'Walk scene', exact: true }).click(); const game = await popup;
  const errors: string[] = []; game.on('pageerror', e => errors.push(e.message));
  await game.getByRole('button', { name: 'Walk imported scene' }).click();
  await game.waitForTimeout(600);
  const before = await game.evaluate(() => (window as any).__game.state());
  expect(before.imported).toBe(true); expect(before.importedInstances).toBe(2); expect(before.visibleImportedInstances).toBe(1); expect(before.visibleImportedModels).toEqual(['walk_floor']); expect(before.player.grounded).toBe(true); expect(before.player.position.y).toBeCloseTo(5, 1);
  // Render both choices through real camera controls before checking stable GPU residency.
  await game.keyboard.press('KeyV');
  await expect.poll(()=>game.evaluate(()=>(window as any).__game.state().visibleImportedModels)).toEqual(['walk_floor', 'floor_lod']);
  const warmedGeometry=await game.evaluate(()=>(window as any).__game.state().memory.geometries);
  expect(warmedGeometry).toBe(before.memory.geometries+1);
  await game.keyboard.press('KeyV');
  await expect.poll(()=>game.evaluate(()=>(window as any).__game.state().visibleImportedModels)).toEqual(['walk_floor']);
  await game.keyboard.press('KeyV');
  await expect.poll(()=>game.evaluate(()=>(window as any).__game.state().camera.mode)).toBe('medium');
  expect(await game.evaluate(()=>(window as any).__game.state().memory.geometries)).toBe(warmedGeometry);
  expect(before.vehicles).toHaveLength(0); expect(before.pedestrians).toHaveLength(0);
  await expect(game.locator('.radar-wrap')).toBeHidden();
  await expect(game.locator('.location')).toHaveText('Imported scene');
  await game.keyboard.down('KeyW');
  await expect.poll(async () => {
    const position = await game.evaluate(() => (window as any).__game.state().player.position);
    return Math.hypot(position.x - before.player.position.x, position.z - before.player.position.z);
  }).toBeGreaterThan(2);
  await game.keyboard.up('KeyW');
  const after = await game.evaluate(() => (window as any).__game.state());
  expect(Math.hypot(after.player.position.x - before.player.position.x, after.player.position.z - before.player.position.z)).toBeGreaterThan(2);
  expect(after.player.grounded).toBe(true); expect(after.player.position.y).toBeCloseTo(5, 1);
  await game.screenshot({ path: 'artifacts/imported-scene-walking.png' });
  await game.keyboard.press('Escape'); await expect(game.locator('#save')).toBeHidden(); await expect(game.locator('#export')).toBeHidden();
  const pausedTime=await game.evaluate(()=>(window as any).__game.state().timeMinutes);await game.waitForTimeout(150);expect(await game.evaluate(()=>(window as any).__game.state().timeMinutes)).toBe(pausedTime);
  await game.getByRole('button',{name:'Lighting',exact:true}).click();await game.getByText('Imported object definitions',{exact:true}).click();
  await game.getByLabel('Local OBJECT.DAT').setInputFiles({name:'object.dat',mimeType:'text/plain',buffer:Buffer.from('walk_floor 99999 20 .99 .1 50 0 1 0 0 0 0 0')});
  await expect(game.locator('#object-data-status')).toContainText('1 object definitions loaded');
  expect(await game.evaluate(()=>(window as any).__game.state().objectKinds.every((kind:string)=>kind==='dummy'))).toBe(true);
  await game.getByLabel('Local OBJECT.DAT').setInputFiles({name:'bad.dat',mimeType:'text/plain',buffer:Buffer.from('invalid')});
  await expect(game.locator('#object-data-status')).toContainText('Current definitions retained');
  expect(await game.evaluate(()=>(window as any).__game.state().objectKinds)).toContain('dummy');
  await game.screenshot({path:'artifacts/object-data-menu.png'});
  await game.getByRole('button',{name:'Clear object definitions',exact:true}).click();await expect(game.locator('#object-data-status')).toContainText('definitions cleared');
  expect(await game.evaluate(()=>(window as any).__game.state().objectKinds.every((kind:string)=>kind==='unknown'))).toBe(true);
  await game.getByRole('button',{name:'Resume game',exact:true}).click();
  await expect.poll(async()=>game.evaluate(()=>(window as any).__game.state().visibleImportedModels),{timeout:45000,intervals:[250]}).toEqual(['floor_lod']);
  const hidden=await game.evaluate(()=>(window as any).__game.state());expect(hidden.timeMinutes).toBeGreaterThanOrEqual(1080);expect(hidden.player.grounded).toBe(true);expect(hidden.memory.geometries).toBe(warmedGeometry);
  expect(errors).toEqual([]); await game.close();
});

test('independent skinned DFF renders its bind pose and releases its skeleton texture on replacement', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/models.html');
  await page.getByLabel('Open a .dff model').setInputFiles('tests/fixtures/dragonff-skin.dff');
  await expect(page.getByRole('status')).toHaveText('dragonff-skin.dff loaded locally.');
  await expect(page.locator('#summary')).toContainText('1 skinned geometries');
  const visible = await page.locator('#model-canvas').evaluate(canvas => {
    const c = canvas as HTMLCanvasElement, gl = c.getContext('webgl2')!, pixels = new Uint8Array(c.width * c.height * 4);
    gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let count = 0; for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 100 && pixels[i + 1] > 80) count++;
    return count;
  });
  expect(visible).toBeGreaterThan(1000);
  await page.locator('#model-canvas').screenshot({ path: 'artifacts/native-skin-bind-pose.png' });
  const memory = await page.evaluate(() => (window as any).__modelPreview.state().memory);
  expect(memory.textures).toBe(1);
  await page.getByLabel('Open a .dff model').setInputFiles('tests/fixtures/dragonff-model.dff');
  await expect(page.getByRole('status')).toHaveText('dragonff-model.dff loaded locally.');
  expect(await page.evaluate(() => (window as any).__modelPreview.state().memory.textures)).toBe(0);
  expect(errors).toEqual([]);
});

test('streamed scene resolves an explicitly selected static IPL and removes it without retaining geometry', async ({page}) => {
  const {readFile}=await import('node:fs/promises');const {imgFixture}=await import('../fixtures/native-assets');
  const model=new Uint8Array(await readFile('tests/fixtures/dragonff-model.dff'));
  const archive=imgFixture([{name:'shop_dy.dff',bytes:model},{name:'shop_nt.dff',bytes:model}]);
  const stream=Buffer.alloc(116);stream.write('bnry');stream.writeUInt32LE(1,4);stream.writeUInt32LE(76,28);stream.writeFloatLE(10,76);stream.writeFloatLE(1,100);stream.writeInt32LE(2,104);stream.writeInt32LE(0,112);
  await page.goto('/models.html');
  await page.getByLabel('Or open a .img archive').setInputFiles({name:'related.img',mimeType:'application/octet-stream',buffer:Buffer.from(archive)});
  await expect(page.getByRole('status')).toContainText('directory loaded');
  await page.getByLabel('Optional .ide model definitions').setInputFiles({name:'related.ide',mimeType:'text/plain',buffer:Buffer.from('tobj\n1 shop_dy shared 200 0 6 18\n2 shop_nt shared 100 0 18 6\nend')});
  await expect(page.locator('#ide-status')).toContainText('2 model associations');
  await page.getByLabel('Optional .ipl placements').setInputFiles({name:'stream.ipl',mimeType:'application/octet-stream',buffer:stream});
  await page.getByLabel('Static .ipl for streamed LODs').setInputFiles({name:'base.ipl',mimeType:'text/plain',buffer:Buffer.from('inst\n1 shop_dy 0 0 0 0 0 0 0 1 -1\nend')});
  await page.getByRole('button',{name:'Assemble archive scene'}).click();await expect(page.getByRole('status')).toHaveText('Archive scene assembled locally.');
  await expect(page.locator('#summary')).toHaveText('2 model types · 2 placements · 0 omitted placements');
  await page.locator('details > summary').click();await expect(page.locator('#metadata')).toContainText('resolved-static (primary:0 → static:0)');
  await expect(page.locator('#metadata')).toContainText('time counterpart shop_nt (loaded)');
  const before=await page.evaluate(()=>(window as any).__modelPreview.state().memory.geometries);
  await page.screenshot({path:'artifacts/related-ipl-preview.png',fullPage:true});
  await page.getByRole('button',{name:'Remove static IPL',exact:true}).click();
  await expect(page.locator('#summary')).toHaveText('1 model types · 1 placements · 0 omitted placements');
  await expect(page.locator('#metadata')).toContainText('external-static-array');
  await expect(page.locator('#metadata')).toContainText('time counterpart shop_dy (unavailable)');
  expect(await page.evaluate(()=>(window as any).__modelPreview.state().memory.geometries)).toBeLessThan(before);
  await page.getByRole('button',{name:'Clear / cancel',exact:true}).click();
  expect(await page.evaluate(()=>(window as any).__modelPreview.state().memory.geometries)).toBe(0);
});

test('atomic pipeline metadata survives the model worker and unsupported rendering is explicit', async ({page}) => {
  const { readFile } = await import('node:fs/promises');
  const { atomicPipelineFixture } = await import('../fixtures/native-assets');
  const payload=new Uint8Array(4);new DataView(payload.buffer).setUint32(0,0x53f20098,true);
  const bytes=atomicPipelineFixture(new Uint8Array(await readFile('tests/fixtures/dragonff-model.dff')),[payload]);
  await page.goto('/models.html');
  await page.getByLabel('Open a .dff model').setInputFiles({name:'pipeline.dff',mimeType:'application/octet-stream',buffer:Buffer.from(bytes)});
  await expect(page.locator('#warnings')).toContainText('Atomic pipeline 0x53f20098 is retained; inspection uses fallback materials; playable building support is partial.');
  await expect(page.locator('#summary')).toContainText('source triangles');
  await page.getByLabel('Open a .dff model').setInputFiles('tests/fixtures/dragonff-model.dff');
  await expect(page.locator('#warnings')).not.toContainText('Atomic pipeline');
});

test('selected interior survives the archive scene handoff into playable lighting',async({page})=>{
  const {readFile}=await import('node:fs/promises');const {imgFixture}=await import('../fixtures/native-assets');
  const archive=imgFixture([{name:'walk_floor.dff',bytes:new Uint8Array(await readFile('tests/fixtures/walk-floor-building.dff'))},{name:'floor.col',bytes:new Uint8Array(await readFile('tests/fixtures/walk-floor.col'))}]);
  await page.goto('/models.html');
  await page.getByLabel('Or open a .img archive').setInputFiles({name:'interior.img',mimeType:'application/octet-stream',buffer:Buffer.from(archive)});
  await expect(page.getByRole('status')).toContainText('directory loaded');
  await page.getByLabel('Archived COL files').selectOption('1');
  await page.getByLabel('Placement interior').fill('5');
  await page.getByLabel('Optional .ipl placements').setInputFiles({name:'interior.ipl',mimeType:'text/plain',buffer:Buffer.from('inst\n500 walk_floor 5 100 200 5 0 0 0 1 -1\nend')});
  await page.getByRole('button',{name:'Assemble archive scene'}).click();
  await expect(page.getByRole('button',{name:'Walk scene',exact:true})).toBeEnabled();
  const popup=page.waitForEvent('popup');await page.getByRole('button',{name:'Walk scene',exact:true}).click();const game=await popup;
  const errors:string[]=[];game.on('pageerror',e=>errors.push(e.message));
  await game.getByRole('button',{name:'Walk imported scene'}).click();
  await expect.poll(()=>game.evaluate(()=>(window as any).__game.state().lighting.area)).toBe(5);
  await expect.poll(()=>game.evaluate(()=>(window as any).__game.state().player.grounded)).toBe(true);
  expect(await game.evaluate(()=>(window as any).__game.state().lighting.sunMultiplier)).toBe(1);
  expect(errors).toEqual([]);await game.close();
});

test('district collision sources combine archived and additional files and clear together', async ({page}) => {
  const {readFile}=await import('node:fs/promises');
  const {imgFixture}=await import('../fixtures/native-assets');
  const bytes=new Uint8Array(await readFile('tests/fixtures/dragonff-model.dff'));
  const archive=imgFixture([{name:'diagnostic_col2.dff',bytes},{name:'diagnostic_col3.dff',bytes},{name:'west.col',bytes:new Uint8Array(await readFile('tests/fixtures/dragonff-collision-v2.col'))}]);
  await page.goto('/models.html');
  await page.getByLabel('Or open a .img archive').setInputFiles({name:'district.img',mimeType:'application/octet-stream',buffer:Buffer.from(archive)});
  await expect(page.getByRole('status')).toContainText('directory loaded');
  await page.getByLabel('Optional .ipl placements').setInputFiles({name:'district.ipl',mimeType:'text/plain',buffer:Buffer.from('inst\n102 diagnostic_col2 0 0 0 0 0 0 0 1 -1\n103 diagnostic_col3 0 10 0 0 0 0 0 1 -1\nend')});
  await page.getByLabel('Include all archived COL collections').check();
  await page.getByLabel('Additional scene .col collections').setInputFiles('tests/fixtures/dragonff-collision-v3.col');
  await page.getByRole('button',{name:'Assemble archive scene'}).click();
  await expect(page.getByRole('status')).toHaveText('Archive scene assembled locally.');
  await expect(page.getByRole('button',{name:'Walk scene',exact:true})).toBeEnabled();
  expect(await page.evaluate(()=>(window as any).__modelPreview.state().collisionOverlays)).toBe(2);
  await expect(page.locator('#metadata')).toContainText('district.img / west.col; dragonff-collision-v3.col');
  await page.getByRole('button',{name:'Remove collision',exact:true}).click();
  await expect(page.getByRole('status')).toHaveText('Archive scene assembled locally.');
  await expect(page.getByLabel('Include all archived COL collections')).not.toBeChecked();
  await expect(page.getByRole('button',{name:'Walk scene',exact:true})).toBeDisabled();
  expect(await page.evaluate(()=>(window as any).__modelPreview.state().collisionOverlays)).toBe(0);
});
