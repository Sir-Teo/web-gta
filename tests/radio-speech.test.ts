import { expect, test } from 'vitest';
import { RADIO_STATIONS, nextStation, radioBedParams, speechSample } from '../src/audio/native/radioSpeech';
test('radio stations cycle with per-station beds', () => {
 expect(RADIO_STATIONS).toHaveLength(11);
 expect(nextStation(RADIO_STATIONS[0], 1)).toBe(RADIO_STATIONS[1]);
 expect(nextStation(RADIO_STATIONS[0], -1)).toBe(RADIO_STATIONS[10]);
 const a = radioBedParams('K-DST'), b = radioBedParams('Bounce FM');
 expect(a.swapMin).toBeLessThan(b.swapMin);
 expect(a.speed).not.toBe(b.speed);
});
test('speech events map onto loaded vocal banks', () => {
 for (const event of ['pain', 'flee', 'greet', 'threat', 'busted', 'wasted', 'jacked'] as const) {
  const s = speechSample(event, 3);
  expect(s.bank).toBe(143);
  expect(s.sample).toBeGreaterThanOrEqual(30);
  expect(s.sample).toBeLessThan(36);
 }
});
