import { expect, test } from 'vitest';
import { acquireLock, lockPriority, lockScore, LOCK_VIEW_ANGLE } from '../src/weapons/nativeLockOn';

const origin = { x: 0, y: 1.3, z: 0 };
const fwd = { x: 0, y: 0, z: -1 };

test('lock scoring prefers centered-near targets inside the view cone', () => {
  expect(LOCK_VIEW_ANGLE).toBe(140);
  const center = { x: 0, y: 1.3, z: -10 };
  const edge = { x: 8, y: 1.3, z: -10 };
  const behind = { x: 0, y: 1.3, z: 10 };
  expect(lockScore(origin, fwd, center, 35)).toBeGreaterThan(lockScore(origin, fwd, edge, 35));
  expect(lockScore(origin, fwd, behind, 35)).toBe(0);
  expect(lockScore(origin, fwd, center, 5)).toBe(0);
});

test('acquisition skips the cycled target and reaches the next best', () => {
  const cands = [
    { handle: 1, position: { x: 0, y: 1.3, z: -10 } },
    { handle: 2, position: { x: 1, y: 1.3, z: -12 } },
    { handle: 3, position: { x: 0, y: 1.3, z: 10 } },
  ];
  expect(acquireLock(origin, fwd, cands, 35)?.handle).toBe(1);
  expect(acquireLock(origin, fwd, cands, 35, 1)?.handle).toBe(2);
  expect(acquireLock(origin, fwd, [], 35)).toBeUndefined();
});

test('target priority prefers armed threats over closer civilians',()=>{
  expect(lockPriority('armed')).toBeGreaterThan(lockPriority('officer'));
  expect(lockPriority('officer')).toBeGreaterThan(lockPriority('attacker'));
  expect(lockPriority('attacker')).toBeGreaterThan(lockPriority('vehicle'));
  expect(lockPriority('vehicle')).toBeGreaterThan(lockPriority('civilian'));
  expect(lockPriority(undefined)).toBe(1);
  const near={handle:1,position:{x:0,y:1.3,z:-6},kind:'civilian' as const};
  const far={handle:2,position:{x:0,y:1.3,z:-9},kind:'armed' as const};
  expect(acquireLock(origin,fwd,[near,far],35)?.handle).toBe(2);
});
