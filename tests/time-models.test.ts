import { expect, test } from 'vitest';
import { timeModelCounterparts } from '../src/assets/timeModels';
import { readIdeAssociations } from '../src/assets/ide';
const records = (names: string[]) => readIdeAssociations(`tobj\n${names.map((name,i)=>`${i} ${name} shared 100 0 6 18`).join('\n')}\nend`);
test('day/night counterparts link bidirectionally in either normal registration order', () => {
  for(const names of [['shop_dy','shop_nt'],['shop_nt','shop_dy']]) expect([...timeModelCounterparts(records(names))].sort()).toEqual([['shop_dy','shop_nt'],['shop_nt','shop_dy']]);
  expect(timeModelCounterparts(records(['shop_dy','unpaired']))).toEqual(new Map());
  const mixed=records(['shop_dy','shop_nt']);mixed[0].section='objs';expect(timeModelCounterparts(mixed).size).toBe(0);
});
test('marker replacement follows source case and truncation semantics, with case-insensitive lookup', () => {
  expect(timeModelCounterparts(records(['SHOP_dy','shop_nt_extra'])).get('shop_nt_extra')).toBe('shop_dy');
  expect(timeModelCounterparts(records(['shop_nt_extra','shop_dy'])).size).toBe(0);
  expect(timeModelCounterparts(records(['shop_DY','shop_NT'])).size).toBe(0);
});
