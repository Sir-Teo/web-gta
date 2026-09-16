import { Matrix4, Vector3 } from 'three';
import type { NativeAnimation } from '../assets/ifp';
import { rootMotion, type RootMotionPolicy } from './rootMotion';
/** Swim stroke displacement adapter: horizontal root motion through the
 * heading basis (the submerge servo owns height on the surface; the dive
 * descent is an authored progress rate, not clip motion). The simulation
 * owns collision. Tread, glide and dive clips carry no root translation. */
export function swimMotion(clip: NativeAnimation, policy: RootMotionPolicy) {
  const motion = rootMotion(clip, { track: policy.track, axes: ['x', 'y'], anchor: policy.anchor });
  const delta = new Vector3(), origin = new Vector3();
  return {
    between(fromSeconds: number, toSeconds: number, parentToWorld: Matrix4, loop = true) {
      motion.delta(fromSeconds, toSeconds, loop, delta);
      origin.set(0, 0, 0).applyMatrix4(parentToWorld); delta.applyMatrix4(parentToWorld).sub(origin);
      if (![delta.x, delta.y, delta.z].every(Number.isFinite)) throw new Error('Swim motion requires a finite world displacement.');
      return { x: delta.x, y: delta.y, z: delta.z };
    },
  };
}
/** The translated root track (bone 0), or -1 for in-place clips. */
export function swimRootTrack(clip: NativeAnimation){
 return clip.tracks.findIndex(t=>t.boneId===0&&t.translations);
}
