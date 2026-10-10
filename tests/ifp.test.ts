import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { readIfp } from '../src/assets/ifp';
import { animationTime, sampleTrack } from '../src/animation/sample';
const fixture = (version = 'anp3') => new Uint8Array(readFileSync(`tests/fixtures/animation-${version}.ifp`));
const mutate = (edit: (view: DataView, bytes: Uint8Array) => void) => { const bytes = fixture(); edit(new DataView(bytes.buffer), bytes); return bytes; };
const pose = () => ({ rotation: new Quaternion(), translation: null as Vector3 | null });
for (const version of ['anp2', 'anp3']) test(`${version} preserves absolute times, source quaternions, bone bindings and translation scale`, () => {
  const data = readIfp(fixture(version));
  expect(data.name).toBe('original_fixture'); expect(data.format).toBe(version.toUpperCase());
  const animation = data.animations[0]; expect(animation.name).toBe('diagnostic_turn'); expect(animation.duration).toBe(2);
  const [root, child] = animation.tracks;
  expect(root.boneId).toBe(0); expect(child.boneId).toBe(-1); expect(child.name).toBe(' Arm');
  expect([...root.times]).toEqual([0, 1, 2]); expect([...root.translations!]).toEqual([0, 0, 0, 1, -2, .5, 2, -4, 1]);
  expect(child.translations).toBeUndefined(); expect(root.rotations[10]).toBeCloseTo(-1, 4);
});
test('sampling interpolates translation and shortest quaternion arc without changing source keys', () => {
  const animation = readIfp(fixture()).animations[0], track = animation.tracks[0], original = track.rotations.slice(), output = pose();
  expect(sampleTrack(track, 0.5, output)).toBe(true); expect(output.translation!.toArray()).toEqual([.5, -1, .25]);
  expect(output.rotation.angleTo(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 4))).toBeLessThan(.001);
  sampleTrack(track, 1.5, output);
  expect(output.rotation.angleTo(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), 3 * Math.PI / 4))).toBeLessThan(.001);
  expect(track.rotations).toEqual(original);
  sampleTrack(animation.tracks[1], 1, output); expect(output.translation).toBeNull();
});
test('sampling handles endpoints, empty tracks, duplicate times and explicit loop policy', () => {
  const clip = readIfp(fixture()).animations[0], track = clip.tracks[0], output = pose();
  sampleTrack(track, -1, output); expect(output.translation!.x).toBe(0);
  sampleTrack(track, 10, output); expect(output.translation!.x).toBe(2);
  track.times[1] = 0; sampleTrack(track, 0, output); expect(output.translation!.x).toBe(1);
  expect(sampleTrack({ ...track, times: new Float32Array() }, 0, output)).toBe(false);
  expect(animationTime(clip, 2)).toBe(0); expect(animationTime(clip, -.5)).toBe(1.5);
  expect(animationTime(clip, 3, false)).toBe(2); expect(animationTime(clip, -1, false)).toBe(0);
  expect(animationTime({ ...clip, duration: 0 }, 10)).toBe(0);
  expect(() => sampleTrack(track, NaN, output)).toThrow('finite');
});
test('reader rejects every truncated prefix and tolerates only zero archive padding', () => {
  const bytes = fixture();
  for (let i = 0; i < bytes.length; i++) expect(() => readIfp(bytes.subarray(0, i))).toThrow();
  const padded = new Uint8Array(2048); padded.set(bytes); expect(readIfp(padded).animations).toHaveLength(1);
  padded[2047] = 1; expect(() => readIfp(padded)).toThrow('after IFP');
});
test('reader rejects unsupported types, count overflow, compression mismatch and bad keyframe size', () => {
  expect(() => readIfp(mutate((_, b) => b.set(new TextEncoder().encode('ANPX'))))).toThrow('Unsupported IFP');
  expect(() => readIfp(mutate(v => v.setUint32(32, 0xffffffff, true)))).toThrow('2048');
  expect(() => readIfp(mutate(v => v.setUint32(96, 5, true)))).toThrow('keyframe type');
  expect(() => readIfp(mutate(v => v.setUint32(100, 0xffffffff, true)))).toThrow('million');
  expect(() => readIfp(mutate(v => v.setUint32(68, 0, true)))).toThrow('compression flag');
  expect(() => readIfp(mutate(v => v.setUint32(64, 1, true)))).toThrow('byte count');
});
test('reader keeps a zero quaternion, holds a key timed before its predecessor at that time, and rejects invalid bone IDs', () => {
  // The loader keeps both as they are (PROLOG1's csplay has zero rotations, PROLOG3's cshandcuff steps back 18 ms):
  // sampling normalizes a zero rotation to none, and the times stay in order for it.
  expect([...readIfp(mutate((_, b) => b.fill(0, 108, 116))).animations[0].tracks[0].rotations.subarray(0, 4)]).toEqual([0, 0, 0, 0]);
  const held = readIfp(mutate(v => v.setInt16(148, 30, true))).animations[0].tracks[0].times;
  expect([...held]).toEqual([0, 1, 1]);
  expect(() => readIfp(mutate(v => v.setInt32(104, -2, true)))).toThrow('bone ID');
});
test('standalone and selected IMG animation reads preserve the same package and source label', async () => {
  const { readAnimation } = await import('../src/assets/readAnimation');
  const { readImgIndex } = await import('../src/assets/img');
  const { imgFixture } = await import('./fixtures/native-assets');
  const source = fixture(), file = new File([source], 'turn.ifp');
  const archive = new File([imgFixture([{ name: 'turn.ifp', bytes: source }])], 'anim.img');
  const entry = (await readImgIndex(archive))[0];
  const external = await readAnimation({ file }), packed = await readAnimation({ file: archive, entry });
  expect(packed.animation).toEqual(external.animation); expect(packed.name).toBe('anim.img / turn.ifp');
  await expect(readAnimation({ file: archive, entry: { ...entry, offset: archive.size } })).rejects.toThrow('outside');
});
