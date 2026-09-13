import { Quaternion, Vector3 } from 'three';
import type { NativeAnimation } from '../assets/ifp';
import { animationTime, sampleTrack } from './sample';
export type MotionAxis = 'x' | 'y' | 'z';
export interface RootMotionPolicy {
  /** Explicit index into the clip's source tracks; never inferred from a name. */
  track: number;
  /** Native Z-up coordinates: x/y locomotion by default, z remains in the pose. */
  axes?: readonly MotionAxis[];
  anchor?: 'first-frame' | 'rest-pose';
}
/** Translation in the selected track's parent coordinate space, before world/heading conversion. */
export function rootMotion(clip: NativeAnimation, policy: RootMotionPolicy) {
  const track = clip.tracks[policy.track];
  if (!Number.isInteger(policy.track) || !track?.times.length || !track.translations) throw new Error('Root motion requires an explicit translated track.');
  const axes = [...(policy.axes ?? ['x', 'y'])] as MotionAxis[];
  if (!axes.length || new Set(axes).size !== axes.length || axes.some(axis => !['x', 'y', 'z'].includes(axis))) throw new Error('Invalid root-motion axes.');
  if (policy.anchor && !['first-frame', 'rest-pose'].includes(policy.anchor)) throw new Error('Invalid root-motion anchor.');
  const pose = { rotation: new Quaternion(), translation: new Vector3() as Vector3 | null };
  sampleTrack(track, 0, pose); const start = pose.translation!.clone();
  sampleTrack(track, clip.duration, pose); const cycle = pose.translation!.clone().sub(start);
  const previous = new Vector3(), next = new Vector3();
  const offset = (seconds: number, loop: boolean, target: Vector3) => {
    const time = animationTime(clip, seconds, loop);
    const cycles = loop && clip.duration > 0 ? Math.floor(seconds / clip.duration) : 0;
    if (!Number.isSafeInteger(cycles)) throw new Error('Root-motion cycle count exceeds precision limit.');
    sampleTrack(track, time, pose);
    target.copy(pose.translation!).sub(start).addScaledVector(cycle, cycles);
    for (const axis of ['x', 'y', 'z'] as const) if (!axes.includes(axis)) target[axis] = 0;
    return target;
  };
  return {
    axes,
    /** Preserve the first key's offset or use the rig's rest translation when removing motion. */
    anchor(rest: Vector3, target: Vector3) { return target.copy(policy.anchor === 'rest-pose' ? rest : start); },
    offset,
    delta(fromSeconds: number, toSeconds: number, loop: boolean, target: Vector3) {
      offset(fromSeconds, loop, previous); offset(toSeconds, loop, next);
      return target.subVectors(next, previous);
    },
  };
}
