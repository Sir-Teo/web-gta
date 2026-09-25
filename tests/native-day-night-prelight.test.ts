import { expect, test } from 'vitest';
import { blendPrelightByte, dayNightPhase, nativeDayNightPrelight, preRenderUpdate } from '../src/assets/nativeDayNightPrelight';
import { isBuildingAtomic, isDayNightAtomic, BUILDING_PIPELINE, BUILDING_DN_PIPELINE } from '../src/assets/buildingPipelines';

test('IsCBPCPipelineAttached takes an explicit building ID or a geometry with both colour sets; AtomicSetup goes by the sets', () => {
  const both = { colors: new Uint8Array(4), nightColors: new Uint8Array(4) }, day = { colors: new Uint8Array(4) }, night = { nightColors: new Uint8Array(4) };
  expect(isBuildingAtomic(undefined, both)).toBe(true);
  expect(isBuildingAtomic(undefined, day)).toBe(false);
  expect(isBuildingAtomic(undefined, night)).toBe(false);
  expect(isBuildingAtomic(0x53f2009a, both)).toBe(true);
  expect(isBuildingAtomic(BUILDING_PIPELINE, {})).toBe(true);
  expect(isBuildingAtomic(BUILDING_DN_PIPELINE, day)).toBe(true);
  expect(isDayNightAtomic(both)).toBe(true);expect(isDayNightAtomic(day)).toBe(false);expect(isDayNightAtomic(night)).toBe(false);
});

test('PreRenderUpdate ignores 0.01, staggers up to 0.3 over sixteen frames and forces larger jumps', () => {
  const state = nativeDayNightPrelight(5, .5);
  expect(state).toMatchObject({ value: .5, stored: .5, phase: 5 });
  expect(preRenderUpdate(state, .505, 5)).toBe(false);
  expect(preRenderUpdate(state, .52, 4)).toBe(false);
  expect(preRenderUpdate(state, .52, 21)).toBe(true);expect(state.value).toBe(.52);
  expect(preRenderUpdate(state, .82, 0)).toBe(false);
  expect(preRenderUpdate(state, .83, 0)).toBe(true);expect(state.stored).toBe(.83);
  expect(preRenderUpdate(state, .83, 3, true)).toBe(true);
  // The stored balance is kept unclamped; the blend uses the clamped one.
  expect(preRenderUpdate(state, 1.5, 1)).toBe(true);expect(state).toMatchObject({ stored: 1.5, value: 1 });
});

test('the prelight blend truncates to a byte and the stagger phase is stable per model', () => {
  expect(blendPrelightByte(51, 153, .5)).toBe(102);
  expect(blendPrelightByte(0, 255, .999)).toBe(254);
  expect(blendPrelightByte(200, 200, .37)).toBe(200);
  expect(dayNightPhase('lae2_roads03', 0)).toBe(dayNightPhase('lae2_roads03', 0));
  const phases = new Set(Array.from({ length: 200 }, (_, i) => dayNightPhase(`model${i}`, 0)));
  expect(phases.size).toBe(16);
});
