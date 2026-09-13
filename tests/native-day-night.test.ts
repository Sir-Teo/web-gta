import { expect, test } from 'vitest';
import { nativeDayNightBalance } from '../src/world/nativeDayNight';

test('native building colors follow fractional-minute dawn and evening transitions', () => {
  for (const [time,balance] of [[0,1],[359,1],[360,1],[390,.5],[419,1/60],[420,0],[1199,0],[1200,0],[1230,.5],[1259,59/60],[1260,1],[1439,1]]) expect(nativeDayNightBalance(time)).toBeCloseTo(balance,10);
  expect(nativeDayNightBalance(390.5)).toBeCloseTo(29.5/60,10);
  expect(nativeDayNightBalance(1230.5)).toBeCloseTo(30.5/60,10);
  expect(nativeDayNightBalance(1440+390)).toBe(.5); expect(nativeDayNightBalance(-1)).toBe(1);
  for (const value of [NaN,Infinity,-Infinity]) expect(()=>nativeDayNightBalance(value)).toThrow('finite');
});
