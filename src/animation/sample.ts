import { Quaternion, Vector3 } from 'three';
import type { AnimationTrack, NativeAnimation } from '../assets/ifp';
/** Reusable output: leaves skeleton binding and source-to-engine conversion to the caller. */
export interface TrackPose { rotation: Quaternion; translation: Vector3 | null }
export function animationTime(animation: NativeAnimation, seconds: number, loop = true) {
  if (!Number.isFinite(seconds)) throw new Error('Animation time must be finite.');
  const duration = animation.duration;
  return duration <= 0 ? 0 : loop ? ((seconds % duration) + duration) % duration : Math.max(0, Math.min(duration, seconds));
}
const nextRotation = new Quaternion();
export function sampleTrack(track: AnimationTrack, time: number, output: TrackPose): boolean {
  if (!Number.isFinite(time)) throw new Error('Animation time must be finite.');
  const count = track.times.length;
  if (!count) return false;
  // Upper bound chooses the final key at an identical timestamp, without division by zero.
  let lo = 0, hi = count;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (track.times[mid] <= time) lo = mid + 1; else hi = mid; }
  const first = Math.max(0, lo - 1), next = Math.min(count - 1, lo);
  const span = track.times[next] - track.times[first];
  const weight = span > 0 ? Math.max(0, Math.min(1, (time - track.times[first]) / span)) : 0;
  output.rotation.fromArray(track.rotations, first * 4).normalize();
  if (weight > 0) output.rotation.slerp(nextRotation.fromArray(track.rotations, next * 4).normalize(), weight);
  if (track.translations) {
    const values = track.translations;
    output.translation ??= new Vector3();
    const a = first * 3, b = next * 3;
    output.translation.set(values[a] + (values[b] - values[a]) * weight, values[a + 1] + (values[b + 1] - values[a + 1]) * weight, values[a + 2] + (values[b + 2] - values[a + 2]) * weight);
  } else output.translation = null;
  return true;
}
