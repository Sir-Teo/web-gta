import { Matrix4, Vector3 } from 'three';
import type { NativeAnimation } from '../assets/ifp';
import { rootMotion, type RootMotionPolicy } from './rootMotion';
/** Clip displacement adapter; simulation owns collision and the actor's resulting position. */
export function locomotionMotion(clip: NativeAnimation, policy: RootMotionPolicy) {
  const motion = rootMotion(clip, policy), delta = new Vector3(), origin = new Vector3();
  return {
    between(fromSeconds: number, toSeconds: number, parentToWorld: Matrix4, loop = true) {
      motion.delta(fromSeconds, toSeconds, loop, delta);
      // Transform displacement including parent scale, but excluding its translation.
      origin.set(0, 0, 0).applyMatrix4(parentToWorld); delta.applyMatrix4(parentToWorld).sub(origin);
      if (![delta.x, delta.y, delta.z].every(Number.isFinite) || Math.abs(delta.y) > 1e-4) throw new Error('Locomotion requires a finite horizontal world displacement.');
      return { x: delta.x, z: delta.z };
    },
  };
}
