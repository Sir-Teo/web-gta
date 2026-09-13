import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { Vector3 } from 'three';
import { readIfp } from '../src/assets/ifp';
import { readDff } from '../src/assets/dff';
import { modelObject } from '../src/assets/ModelObjects';
import { bindAnimation } from '../src/animation/bind';
import { rootMotion } from '../src/animation/rootMotion';
const clip = () => readIfp(new Uint8Array(readFileSync('tests/fixtures/animation-rig.ifp'))).animations[0];
const model = () => readDff(new Uint8Array(readFileSync('tests/fixtures/dragonff-skin.dff')));
test('horizontal motion crosses clip boundaries without wrapping backward, including reverse time', () => {
  const motion = rootMotion(clip(), { track: 0 }), value = new Vector3();
  expect(motion.delta(1.75, 2.25, true, value).toArray()).toEqual([.5, -1, 0]);
  expect(motion.delta(2.25, 1.75, true, value).toArray()).toEqual([-.5, 1, 0]);
  expect(motion.delta(-.25, .25, true, value).toArray()).toEqual([.5, -1, 0]);
  expect(motion.delta(0, 6, true, value).toArray()).toEqual([6, -12, 0]);
});
test('clamped sampling stops at the clip endpoint and optional vertical extraction remains explicit', () => {
  const motion = rootMotion(clip(), { track: 0, axes: ['x', 'y', 'z'] }), value = new Vector3();
  expect(motion.delta(1.5, 10, false, value).toArray()).toEqual([.5, -1, .25]);
  expect(motion.delta(3, 4, false, value).toArray()).toEqual([0, 0, 0]);
  expect(motion.offset(2, false, value).toArray()).toEqual([2, -4, 1]);
});
test('in-place binding removes only selected translation axes and preserves vertical pose and source data', () => {
  const data = model(), object = modelObject(data), animation = clip(), original = animation.tracks[0].translations!.slice();
  const bound = bindAnimation(data, object.root, animation, { track: 0 }); bound.sample(1, false);
  const root = object.root.getObjectByName('Root')!;
  expect(new Vector3().setFromMatrixPosition(root.matrix).toArray()).toEqual([0, 0, .5]);
  expect(bound.rootMotion!.delta(0, 1, true, new Vector3()).toArray()).toEqual([1, -2, 0]);
  expect(animation.tracks[0].translations).toEqual(original);
  bound.restore(); expect(root.matrix.elements[14]).toBe(0); object.dispose();
});
test('nonzero initial offsets remain in the pose by default and rest-pose anchoring is opt-in', () => {
  const data = model(), animation = clip();
  for (let i = 0; i < animation.tracks[0].translations!.length; i += 3) animation.tracks[0].translations![i] += 4;
  const a = modelObject(data), b = modelObject(data);
  const first = bindAnimation(data, a.root, animation, { track: 0 }), rest = bindAnimation(data, b.root, animation, { track: 0, anchor: 'rest-pose' });
  first.sample(1); rest.sample(1);
  expect(a.root.getObjectByName('Root')!.matrix.elements[12]).toBe(4); expect(b.root.getObjectByName('Root')!.matrix.elements[12]).toBe(0);
  expect(first.rootMotion!.delta(0, 1, false, new Vector3()).x).toBe(1); a.dispose(); b.dispose();
});
test('motion deltas compose across different step sizes and do not mutate earlier outputs', () => {
  const motion = rootMotion(clip(), { track: 0 }), sum = new Vector3(), scratch = new Vector3();
  for (let i = 0; i < 180; i++) sum.add(motion.delta(i / 60, (i + 1) / 60, true, scratch));
  const whole = motion.delta(0, 3, true, new Vector3()); expect(sum.distanceTo(whole)).toBeLessThan(1e-5);
  motion.delta(0, .25, true, scratch); expect(whole.toArray()).toEqual([3, -6, 0]);
});
test('invalid policies, times and nontranslated tracks fail explicitly', () => {
  for (const policy of [{ track: 1 }, { track: -1 }, { track: .5 }, { track: 0, axes: [] }, { track: 0, axes: ['x', 'x'] }]) expect(() => rootMotion(clip(), policy as any)).toThrow();
  const motion = rootMotion(clip(), { track: 0 }); expect(() => motion.offset(Infinity, true, new Vector3())).toThrow('finite');
  expect(() => motion.offset(Number.MAX_VALUE, true, new Vector3())).toThrow('precision');
});
