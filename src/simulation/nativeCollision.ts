import RAPIER from '@dimforge/rapier3d-compat';
import { Quaternion, Vector3 } from 'three';
import type { ColModel, ColSurface, ColMesh } from '../assets/col';
import type { IplInstance } from '../assets/ipl';
import { placementMatrix } from '../assets/placement';
export type NativeCollisionSource = { kind: 'sphere' | 'box'; index: number; surface: ColSurface } | { kind: 'mesh'; mesh: ColMesh };
/** Install source geometry as a fixed object. Source surface IDs remain metadata, not friction coefficients. */
export function installNativeCollision(world: RAPIER.World, model: ColModel, placement: IplInstance) {
  const matrix = placementMatrix(placement), position = new Vector3(), rotation = new Quaternion(), scale = new Vector3();
  matrix.decompose(position, rotation, scale);
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z).setRotation(rotation));
  const sources = new Map<number, NativeCollisionSource>(); let disposed = false;
  const dispose = () => { if (disposed) return; disposed = true; sources.clear(); if (body.isValid()) world.removeRigidBody(body); };
  const add = (description: RAPIER.ColliderDesc, source: NativeCollisionSource) => {
    const collider = world.createCollider(description, body); sources.set(collider.handle, source);
  };
  try {
    model.spheres.forEach((sphere, index) => add(RAPIER.ColliderDesc.ball(sphere.radius).setTranslation(...sphere.center), { kind: 'sphere', index, surface: sphere.surface }));
    model.boxes.forEach((box, index) => {
      const half = box.max.map((n, i) => (n - box.min[i]) / 2), center = box.max.map((n, i) => (n + box.min[i]) / 2);
      add(RAPIER.ColliderDesc.cuboid(half[0], half[1], half[2]).setTranslation(center[0], center[1], center[2]), { kind: 'box', index, surface: box.surface });
    });
    if (model.mesh.indices.length) add(RAPIER.ColliderDesc.trimesh(model.mesh.positions, model.mesh.indices), { kind: 'mesh', mesh: model.mesh });
  } catch (error) { dispose(); throw error; }
  // Shadow mesh and enclosing bounds are deliberately not physical colliders.
  return { body, sources, dispose };
}
