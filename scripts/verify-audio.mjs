import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';

const server = await createServer({ server: { host: '127.0.0.1', port: 5187, strictPort: true } });
await server.listen();
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  // Capture the real output graph; controls and simulation still run through the page UI.
  await page.addInitScript(() => {
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (...args) {
      const result = connect.apply(this, args);
      if (args[0] === this.context.destination && !window.__audioCapture) {
        const sink = this.context.createMediaStreamDestination(); connect.call(this, sink);
        const recorder = new MediaRecorder(sink.stream, { mimeType: 'audio/webm;codecs=opus' });
        const chunks = []; recorder.ondataavailable = event => chunks.push(event.data);
        window.__audioCapture = { async stop() {
          await new Promise(resolve => { recorder.onstop = resolve; recorder.stop(); });
          const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
          const offline = new OfflineAudioContext(2, 1, 44100);
          const decoded = await offline.decodeAudioData(bytes.buffer.slice(0));
          let peak = 0, energy = 0, clipped = 0;
          for (let channel = 0; channel < decoded.numberOfChannels; channel++) for (const sample of decoded.getChannelData(channel)) {
            peak = Math.max(peak, Math.abs(sample)); energy += sample * sample; if (Math.abs(sample) >= 0.999) clipped++;
          }
          let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
          return { base64: btoa(binary), seconds: decoded.duration, channels: decoded.numberOfChannels, peak,
            rms: Math.sqrt(energy / (decoded.length * decoded.numberOfChannels)), clipped };
        } };
        recorder.start();
      }
      return result;
    };
  });
  await page.goto('http://127.0.0.1:5187');
  await page.getByRole('button', { name: 'Begin game' }).click();
  const state = () => page.evaluate(() => window.__game.state());
  await expect.poll(async () => (await state()).audio.loaded).toBe(true);
  await page.keyboard.down('KeyD'); await page.keyboard.down('KeyS'); await page.waitForTimeout(2400);
  await page.keyboard.up('KeyD'); await page.waitForTimeout(1100); await page.keyboard.up('KeyS');
  await page.keyboard.down('KeyD'); await page.waitForTimeout(600); await page.keyboard.up('KeyD');
  await page.keyboard.press('KeyF'); await expect.poll(async () => (await state()).vehicle).toBe('greenwood');
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1800); await page.keyboard.up('KeyW');
  await page.keyboard.down('KeyH'); await page.waitForTimeout(650); await page.keyboard.up('KeyH');
  await page.keyboard.down('Space'); await page.waitForTimeout(1200); await page.keyboard.up('Space');
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await state()).audio.context).toBe('suspended');
  await page.waitForTimeout(350);
  const audio = (await state()).audio;
  const { base64, ...signal } = await page.evaluate(() => window.__audioCapture.stop());
  expect(signal.peak).toBeGreaterThan(0.01); expect(signal.clipped).toBe(0);
  expect(signal.rms).toBeGreaterThan(0.0001); expect(audio.voices).toBe(0); expect(errors).toEqual([]);
  const report = { checkedAt: new Date().toISOString(), browser: browser.version(), actions: 'walk, door entry, acceleration, horn, handbrake, pause', signal, audio, errors };
  await mkdir('artifacts', { recursive: true });
  await writeFile('artifacts/game-audio.webm', Buffer.from(base64, 'base64'));
  await writeFile('artifacts/audio-verification.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser?.close(); await server.close(); }
