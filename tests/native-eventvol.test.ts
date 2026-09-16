import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {NativeAudioEngine} from '../src/audio/native/NativeAudioEngine';
import type {NativeBankLoader} from '../src/audio/native/NativeBankLoader';

const loader={loadSoundBank(){}} as unknown as NativeBankLoader;

test('EVENTVOL.DAT matches the verified retail table',()=>{
  const bytes=readFileSync('public/play/audio/eventvol.dat');
  expect(bytes.length).toBe(45402);
  expect(createHash('sha256').update(bytes).digest('hex')).toBe('ad8bab3deff68a93787566dab34b33d37876ba9e15308386e2166837024059a8');
  const manifest=JSON.parse(readFileSync('public/play/audio/eventvol.json','utf8'));
  expect(manifest.bytes).toBe(45402);
  expect(manifest.sha256).toBe('ad8bab3deff68a93787566dab34b33d37876ba9e15308386e2166837024059a8');
});

test('default volumes come from the table once supplied, else 0 dB',()=>{
  const engine=new NativeAudioEngine(loader);
  expect(engine.defaultVolume(0)).toBe(0);
  const bytes=new Uint8Array(readFileSync('public/play/audio/eventvol.dat'));
  engine.eventVolumes=new Int8Array(bytes.buffer);
  // First bytes are signed dB levels (0xFE = -2, 0xFA = -6).
  expect(engine.defaultVolume(0)).toBe(-2);
  expect(engine.defaultVolume(1)).toBe(-6);
  expect(engine.defaultVolume(999999)).toBe(0);
});
