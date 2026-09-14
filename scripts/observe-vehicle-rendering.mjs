import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const label = process.argv[2] ?? 'current';
if (!/^[a-z0-9_-]+$/i.test(label)) throw new Error('Use a simple observation label.');
await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:5183/?mode=sandbox');
  await page.getByRole('button', { name: 'Import save', exact: true }).waitFor();
  await page.waitForFunction(() => !document.querySelector('#import').disabled);
  const save = { version: 1, pack: 'grove-authored-1', savedAt: '2026-09-13T12:00:00Z', position: { x: -4, y: 0, z: 14 }, heading: Math.PI / 2, money: 350, timeMinutes: 720,
    vehicles: [{id:'greenwood',position:{x:6.5,y:.65,z:14},rotation:{x:0,y:1,z:0,w:0}}, {id:'sedan',position:{x:-6.3,y:.65,z:52},rotation:{x:0,y:0,z:0,w:1}}] };
  await page.locator('#save-file').setInputFiles({ name: 'view.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(save)) });
  await page.getByText('Save imported. Choose Continue saved game to play.').waitFor();
  await page.getByRole('button', { name: 'Continue saved game' }).click();
  await page.waitForFunction(() => window.__game.state().tick > 60);
  const metrics = await page.evaluate(async () => {
    const frames = []; let previous = performance.now();
    for (let i = 0; i < 120; i++) { const t = await new Promise(requestAnimationFrame); const s = window.__game.state(); frames.push({ ms:t-previous, calls:s.draws, triangles:s.triangles }); previous=t; }
    return { frames, memory: window.__game.state().memory };
  });
  await page.screenshot({ path: `artifacts/vehicle-render-${label}.png` });
  await writeFile(`artifacts/vehicle-render-${label}.json`, JSON.stringify({ checkedAt: new Date().toISOString(), browser: browser.version(), viewport: [1440, 900], ...metrics }, null, 2));
  console.log(JSON.stringify({ calls: [...new Set(metrics.frames.map(f=>f.calls))], triangles: [...new Set(metrics.frames.map(f=>f.triangles))], memory: metrics.memory }));
} finally { await browser.close(); }
