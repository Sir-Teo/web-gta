import { rootMotion, type RootMotionPolicy } from './rootMotion';
import { Matrix4, Object3D, Quaternion, SkinnedMesh, Sphere, Vector3 } from 'three';
import type { DffModel } from '../assets/dff';
import type { NativeAnimation } from '../assets/ifp';
import { animationTime, sampleTrack } from './sample';
/** Bind a source-space clip to one model instance. Validation never changes the current pose. */
export function bindAnimation(model: DffModel, root: Object3D, clip: NativeAnimation, motionPolicy?: RootMotionPolicy) {
  const motion = motionPolicy ? rootMotion(clip, motionPolicy) : undefined;
  const motionTrack = motionPolicy ? clip.tracks[motionPolicy.track] : undefined;
  const anchor = new Vector3();
  const targets = new Map<number, Object3D>();
  root.traverse(object => {
    const index = object.userData.nativeFrame;
    if (Number.isInteger(index)) {
      if (targets.has(index)) throw new Error('Animation binding requires one model instance.');
      targets.set(index, object);
    }
  });
  const used = new Set<number>();
  const bindings = clip.tracks.filter(t => t.times.length).map(track => {
    const matches = model.frames.map((frame, index) => ({ frame, index })).filter(({ frame }) => track.boneId >= 0 ? frame.hanim?.id === track.boneId : frame.name.trim().toLowerCase() === track.name.trim().toLowerCase());
    if (matches.length !== 1) throw new Error(`Missing or ambiguous animation bone: ${track.boneId >= 0 ? track.boneId : track.name}.`);
    const { frame, index } = matches[0], target = targets.get(index);
    if (!target || used.has(index)) throw new Error('Animation tracks require distinct existing model frames.');
    used.add(index);
    const rest = new Matrix4().fromArray(frame.matrix), position = new Vector3(), rotation = new Quaternion(), scale = new Vector3();
    rest.decompose(position, rotation, scale);
    const recomposed = new Matrix4().compose(position, rotation, scale);
    if (rest.elements.some((n, i) => !Number.isFinite(recomposed.elements[i]) || Math.abs(n - recomposed.elements[i]) > 1e-5)) throw new Error('Animation does not support sheared or singular rest transforms.');
    return { track, target, rest, position, scale, pose: { rotation: new Quaternion(), translation: null as Vector3 | null } };
  });
  if (!bindings.length) throw new Error('Animation has no nonempty tracks to bind.');
  const meshes: { mesh: SkinnedMesh; culled: boolean; sortingSphere: Sphere }[] = [];
  root.traverse(object => {
    if (!(object instanceof SkinnedMesh)) return;
    const atomic = model.atomics[object.userData.nativeAtomic];
    const bounds = atomic && model.geometries[atomic.geometry].morphBounds?.[0];
    // RenderWare's morph-sphere center is sufficient for depth sorting. Animated
    // meshes already disable culling; an unbounded radius keeps ray queries
    // conservative until updateBounds explicitly computes the current pose.
    const center = bounds ? new Vector3(...bounds.center) : new Vector3();
    meshes.push({mesh: object, culled: object.frustumCulled, sortingSphere: new Sphere(center, Infinity)});
  });
  const refresh = (animated: boolean, updateWorld = true) => {
    if (updateWorld) root.updateMatrixWorld(true);
    // Avoid CPU-skinning every vertex each frame. Exact bounds are computed on demand.
    for (const { mesh, culled, sortingSphere } of meshes) {
      mesh.boundingBox = null!;
      // A null sphere triggers CPU skinning in WebGLRenderer's sorting pass,
      // even with frustumCulled=false. Do not invalidate the sorting proxy.
      mesh.boundingSphere = animated ? sortingSphere : null!;
      mesh.frustumCulled = animated ? false : culled;
    }
  };
  return {
    trackCount: bindings.length,
    duration: clip.duration,
    rootMotion: motion,
    /** `updateWorld` false leaves world matrices to the caller, which layers several clips and updates once. */
    sample(seconds: number, loop = true, updateWorld = true) {
      const time = animationTime(clip, seconds, loop);
      for (const b of bindings) {
        sampleTrack(b.track, time, b.pose);
        if (motion && b.track === motionTrack && b.pose.translation) {
          motion.anchor(b.position, anchor);
          for (const axis of motion.axes) b.pose.translation[axis] = anchor[axis];
        }
        // Native quaternion-to-matrix conventions match Three in source space.
        // Source translation is absolute local position; rotation-only tracks retain rest translation.
        b.target.matrix.compose(b.pose.translation ?? b.position, b.pose.rotation, b.scale);
        b.target.matrixWorldNeedsUpdate = true;
      }
      refresh(true, updateWorld); return time;
    },
    updateBounds() { for (const { mesh } of meshes) { mesh.boundingSphere = null!; mesh.computeBoundingBox(); mesh.computeBoundingSphere(); } },
    restore() {
      for (const b of bindings) { b.target.matrix.copy(b.rest); b.target.matrixWorldNeedsUpdate = true; }
      refresh(false);
    },
  };
}
