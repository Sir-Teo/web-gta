import { describe, expect, it } from 'vitest';
import { isSave, type SaveData } from '../src/persistence/saves';

const fixture = (): SaveData => ({
  version: 1, pack: 'grove-authored-1', savedAt: '2026-09-13T12:00:00Z',
  position: { x: -3, y: -0.09, z: 5 }, heading: Math.PI, money: 350, timeMinutes: 1044,
  vehicles: ['greenwood', 'sedan'].map((id, i) => ({ id, position: { x: i * 10, y: 0.64, z: 14 }, rotation: { x: 0, y: 0, z: 0, w: 1 } })),
});
describe('save validation before storage or world mutation', () => {
  it('accepts a round-tripped current content save', () => expect(isSave(JSON.parse(JSON.stringify(fixture())))).toBe(true));
  it('rejects incompatible versions and invalid numeric data', () => {
    for (const value of [null, {}, { ...fixture(), version: 2 }, { ...fixture(), pack: 'other' }, { ...fixture(), heading: NaN }, { ...fixture(), money: -1 }, { ...fixture(), timeMinutes: Infinity }]) expect(isSave(value)).toBe(false);
  });
  it('rejects out-of-world positions and non-unit rotations', () => {
    const outside = fixture(); outside.position.x = 1000; expect(isSave(outside)).toBe(false);
    const badRotation = fixture(); badRotation.vehicles[0].rotation.w = 3; expect(isSave(badRotation)).toBe(false);
  });
  it('rejects duplicate, unknown and missing vehicle identities', () => {
    const duplicate = fixture(); duplicate.vehicles[1].id = duplicate.vehicles[0].id; expect(isSave(duplicate)).toBe(false);
    const unknown = fixture(); unknown.vehicles[0].id = 'unknown'; expect(isSave(unknown)).toBe(false);
    const missing = fixture(); missing.vehicles.pop(); expect(isSave(missing)).toBe(false);
  });
});
