import { expect, test } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';

test('boots, walks, jumps, pauses, and saves without runtime errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin game' }).click();
  const state = () => page.evaluate(() => (window as any).__game.state());
  await expect.poll(async () => (await state()).tick).toBeGreaterThan(5);
  const initial = (await state()).player.position;
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1500); await page.keyboard.up('KeyW');
  const moved = (await state()).player.position;
  expect(Math.hypot(moved.x - initial.x, moved.z - initial.z)).toBeGreaterThan(3);
  await page.keyboard.press('Space'); await page.waitForTimeout(170);
  expect((await state()).player.position.y).toBeGreaterThan(initial.y + 0.35);
  await page.waitForTimeout(1000);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Resume game' })).toBeVisible();
  const tick = (await state()).tick; await page.waitForTimeout(250); expect((await state()).tick).toBe(tick);
  await page.getByRole('button', { name: 'Save game', exact: true }).click();
  await expect(page.getByText('Game saved on this device.')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Continue saved game' }).click();
  await expect.poll(async () => (await state()).paused).toBe(false);
  expect((await state()).player.position.z).toBeCloseTo(moved.z, 0);
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'artifacts/playable-street.png' });
  expect(errors).toEqual([]);
});

test('walks to a car, drives, brakes and exits through real controls', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin game' }).click();
  const state = () => page.evaluate(() => (window as any).__game.state());
  await page.keyboard.down('KeyD'); await page.keyboard.down('KeyS');
  await page.waitForTimeout(2400);
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(1100);
  await page.keyboard.up('KeyS');
  await page.keyboard.down('KeyD'); await page.waitForTimeout(600); await page.keyboard.up('KeyD');
  await page.keyboard.press('KeyF');
  await expect.poll(async () => (await state()).transition?.phase, { intervals: [50] }).toBe('transfer');
  await page.waitForTimeout(180);
  await page.screenshot({ path: 'artifacts/vehicle-entry.png' });
  await page.keyboard.press('Escape');
  const frozen = (await state()).transition;
  await page.waitForTimeout(200);
  expect((await state()).transition).toEqual(frozen);
  await page.getByRole('button', { name: 'Save game', exact: true }).click();
  await expect(page.getByText('Finish getting in or out before saving.')).toBeVisible();
  await page.getByRole('button', { name: 'Resume game' }).click();
  await expect.poll(async () => (await state()).vehicle).toBe('greenwood');
  const before = (await state()).player.position;
  await page.keyboard.down('KeyW'); await page.waitForTimeout(2500); await page.keyboard.up('KeyW');
  const driving = await state();
  expect(driving.player.speed).toBeGreaterThan(3);
  expect(Math.hypot(driving.player.position.x - before.x, driving.player.position.z - before.z)).toBeGreaterThan(5);
  await page.screenshot({ path: 'artifacts/driving.png' });
  await page.keyboard.down('Space'); await page.waitForTimeout(2200); await page.keyboard.up('Space');
  await page.keyboard.press('KeyF');
  await expect.poll(async () => (await state()).vehicle).toBe(null);
  await page.waitForTimeout(500);
  expect((await state()).player.position.y).toBeGreaterThan(-0.2);
});

test('imports an exported save, rejects corrupt data, and continues the latest slot', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin game' }).click();
  const state = () => page.evaluate(() => (window as any).__game.state());
  await page.waitForTimeout(200);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save game', exact: true }).click();
  await expect(page.getByText('Game saved on this device.')).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export save' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();
  await page.getByRole('button', { name: 'Resume game' }).click();
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1100); await page.keyboard.up('KeyW');
  await page.waitForTimeout(150);
  const moved = (await state()).player.position;
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save game', exact: true }).click();
  await expect(page.getByText('Game saved on this device.')).toBeVisible();
  await page.getByRole('button', { name: 'Continue saved game' }).click();
  await expect.poll(async () => (await state()).paused).toBe(false);
  expect((await state()).player.position.z).toBeCloseTo(moved.z, 1);
  await page.keyboard.press('Escape');
  await page.locator('#save-file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"version":1}') });
  await expect(page.getByText('This save is damaged or belongs to a different content version.')).toBeVisible();
  expect((await state()).player.position.z).toBeCloseTo(moved.z, 1);
  await page.locator('#save-file').setInputFiles(path!);
  await expect(page.getByText('Save imported. Choose Continue saved game to play.')).toBeVisible();
  await page.getByRole('button', { name: 'Continue saved game' }).click();
  await expect.poll(async () => (await state()).paused).toBe(false);
  expect((await state()).player.position.z).toBeCloseTo(5, 0);
});

test('recovers its graphics context while preserving the simulation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin game' }).click();
  await page.waitForTimeout(200);
  const before = await page.evaluate(() => (window as any).__game.state().player.position);
  await page.evaluate(() => {
    const gl = document.querySelector<HTMLCanvasElement>('.world')!.getContext('webgl2')!;
    const extension = gl.getExtension('WEBGL_lose_context')!;
    extension.loseContext();
    setTimeout(() => extension.restoreContext(), 350);
  });
  await expect(page.getByText('Display recovered. Resume when ready.')).toBeVisible();
  await page.getByRole('button', { name: 'Resume game' }).click();
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => (window as any).__game.state());
  expect(after.paused).toBe(false);
  expect(after.player.position.z).toBeCloseTo(before.z, 1);
  await page.setViewportSize({ width: 740, height: 480 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'artifacts/resized.png' });
});

test('renders the local crowd, advances residents and freezes them with the pause menu', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin game' }).click();
  const state = () => page.evaluate(() => (window as any).__game.state());
  await expect.poll(async () => (await state()).tick).toBeGreaterThan(5);
  const initial = await state();
  expect(initial.pedestrians).toHaveLength(10);
  await page.waitForTimeout(3000);
  const moved = await state();
  expect(moved.pedestrians.filter((p: any, i: number) => Math.hypot(p.position.x - initial.pedestrians[i].position.x, p.position.z - initial.pedestrians[i].position.z) > 1)).toHaveLength(10);
  await page.screenshot({ path: 'artifacts/neighborhood-population.png' });
  await page.keyboard.press('Escape');
  const paused = (await state()).pedestrians;
  await page.waitForTimeout(300);
  expect((await state()).pedestrians).toEqual(paused);
  await page.getByRole('button', { name: 'Resume game' }).click();
  await page.waitForTimeout(1500);
  const resumed = await state();
  expect(resumed.pedestrians).not.toEqual(paused);
  expect(resumed.memory).toEqual(initial.memory);
  expect(errors).toEqual([]);
});

test('saved times restore daylight, sunset, night and dawn, including nighttime driving', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const state = () => page.evaluate(() => (window as any).__game.state());
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin game' }).click();
  await page.waitForTimeout(200); await page.keyboard.press('Escape');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export save' }).click();
  const download = await downloadPromise;
  const save = JSON.parse(await readFile((await download.path())!, 'utf8'));
  for (const [name, minutes, expectedNight] of [['daylight', 720, 0], ['sunset', 1155, 0.2125], ['dawn', 360, 0.5], ['night', 0, 1]] as const) {
    await page.locator('#save-file').setInputFiles({ name: `${name}.json`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...save, timeMinutes: minutes })) });
    await expect(page.getByText('Save imported. Choose Continue saved game to play.')).toBeVisible();
    await page.getByRole('button', { name: 'Continue saved game' }).click();
    await expect.poll(async () => (await state()).paused).toBe(false);
    await page.waitForTimeout(250);
    expect((await state()).lighting.night).toBeCloseTo(expectedNight, 1);
    expect((await state()).timeMinutes).toBeCloseTo(minutes, 0);
    await page.screenshot({ path: `artifacts/time-${name}.png` });
    await page.keyboard.press('Escape');
    const frozen = (await state()).timeMinutes;
    await page.waitForTimeout(150); expect((await state()).timeMinutes).toBe(frozen);
  }
  // Imported saves restore a north-facing camera; use the corresponding real-control approach.
  await page.getByRole('button', { name: 'Resume game' }).click();
  await page.keyboard.down('KeyD'); await page.keyboard.down('KeyS'); await page.waitForTimeout(2800);
  await page.keyboard.up('KeyD'); await page.waitForTimeout(700); await page.keyboard.up('KeyS');
  await page.keyboard.press('KeyF');
  await expect.poll(async () => (await state()).vehicle).toBe('greenwood');
  await page.keyboard.down('KeyW'); await page.waitForTimeout(2200); await page.keyboard.up('KeyW');
  await page.screenshot({ path: 'artifacts/night-driving.png' });
  expect(errors).toEqual([]);
});

test('audio unlocks on play, emits a real signal, pauses, and persists mute and volume', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const state = () => page.evaluate(() => (window as any).__game.state());
  await expect(page.getByRole('button', { name: 'Begin game' })).toBeEnabled();
  await page.waitForFunction(() => !!(window as any).__game);
  expect((await state()).audio.context).toBe('uninitialized');
  await page.getByRole('button', { name: 'Begin game' }).click();
  await expect.poll(async () => (await state()).audio.loaded).toBe(true);
  expect((await state()).audio.buffers).toBe(9);
  expect((await state()).audio.context).toBe('running');
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1300); await page.keyboard.up('KeyW');
  expect((await state()).audio.shotsPlayed).toBeGreaterThan(2);
  await expect.poll(async () => (await state()).audio.rms, { intervals: [50] }).toBeGreaterThan(0.0001);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await state()).audio.context).toBe('suspended');
  expect((await state()).audio.voices).toBe(0);
  await page.getByRole('button', { name: 'Audio', exact: true }).click();
  await page.getByLabel('Master volume').fill('35');
  await page.getByLabel('Mute all sound').check();
  await page.screenshot({ path: 'artifacts/audio-settings.png' });
  await page.getByRole('button', { name: 'Resume game' }).click();
  await page.waitForTimeout(300);
  expect((await state()).audio.context).toBe('running');
  expect((await state()).audio.rms).toBeLessThan(0.000001);
  await page.reload(); await page.getByRole('button', { name: 'Begin game' }).click();
  await expect.poll(async () => (await state()).audio.loaded).toBe(true);
  expect((await state()).audio.settings.master).toBe(0.35); expect((await state()).audio.settings.muted).toBe(true);
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Audio', exact: true }).click();
  await page.getByLabel('Mute all sound').uncheck();
  await page.getByRole('button', { name: 'Resume game' }).click();
  await expect.poll(async () => (await state()).audio.rms).toBeGreaterThan(0.00005);
  expect(errors).toEqual([]);
});

test('a missing sound leaves gameplay available and reports partial audio', async ({ page }) => {
  await page.route('**/audio/engine.wav', route => route.fulfill({ status: 404, body: '' }));
  await page.goto('/'); await page.getByRole('button', { name: 'Begin game' }).click();
  const state = () => page.evaluate(() => (window as any).__game.state());
  await expect.poll(async () => (await state()).audio.loaded).toBe(true);
  expect((await state()).audio.failed).toBe(1);
  const before = (await state()).player.position;
  await page.keyboard.down('KeyW'); await page.waitForTimeout(900); await page.keyboard.up('KeyW');
  expect(Math.abs((await state()).player.position.z - before.z)).toBeGreaterThan(2);
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Audio', exact: true }).click();
  await expect(page.getByText('Some sounds could not load. Gameplay remains available.')).toBeVisible();
});

test('pausing during audio loading stays silent when downloads finish', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/audio/*.wav', async route => { await gate; await route.continue(); });
  await page.goto('/'); await page.getByRole('button', { name: 'Begin game' }).click();
  const state = () => page.evaluate(() => (window as any).__game.state());
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await state()).audio.context).toBe('suspended');
  release();
  await expect.poll(async () => (await state()).audio.loaded).toBe(true);
  expect((await state()).audio.context).toBe('suspended'); expect((await state()).audio.voices).toBe(0);
  await page.getByRole('button', { name: 'Resume game' }).click();
  await expect.poll(async () => (await state()).audio.context).toBe('running');
  expect((await state()).audio.loops).toBe(5);
});

test('an audio-device initialization failure does not prevent playing', async ({ page }) => {
  await page.addInitScript(() => {
    const Original = window.AudioContext;
    window.AudioContext = class extends Original {
      createGain(): GainNode { throw new Error('Simulated audio device failure'); }
    };
  });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await page.getByRole('button', { name: 'Begin game' }).click();
  const state = () => page.evaluate(() => (window as any).__game.state());
  await expect.poll(async () => (await state()).audio.unavailable).toBe(true);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(900); await page.keyboard.up('KeyW');
  expect((await state()).player.position.z).toBeLessThan(3);
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Audio', exact: true }).click();
  await expect(page.getByText('Sound is unavailable in this browser.')).toBeVisible();
  expect(errors).toEqual([]);
});
