import RAPIER from '@dimforge/rapier3d-compat';
import { Matrix4, Quaternion, Vector3 } from 'three';
import {requireAsset} from '../assets/binary';
import type { ColModel, ColSurface, ColMesh } from '../assets/col';
import type { IplInstance } from '../assets/ipl';
import { placementMatrix } from '../assets/placement';
export type NativeCollisionSource = { kind: 'sphere' | 'box'; index: number; surface: ColSurface } | { kind: 'mesh'; mesh: ColMesh };
/** Install source geometry as a fixed object. Source surface IDs remain metadata, not friction coefficients. */
export function installNativeCollision(world: RAPIER.World, model: ColModel, placement: IplInstance) {
  return installNativeCollisionMatrix(world,model,placementMatrix(placement));
}
/** Rigid native-local to world matrix. Procedural visual scaling must not change collision. */
export function installNativeCollisionMatrix(world:RAPIER.World,model:ColModel,matrix:Matrix4){
  const e=matrix.elements;
  requireAsset(e.every(Number.isFinite)&&e[3]===0&&e[7]===0&&e[11]===0&&e[15]===1,'Invalid native collision matrix.');
  const axes=[new Vector3(e[0],e[1],e[2]),new Vector3(e[4],e[5],e[6]),new Vector3(e[8],e[9],e[10])];
  requireAsset(axes.every(v=>Math.abs(v.lengthSq()-1)<1e-4)&&Math.abs(axes[0].dot(axes[1]))<1e-4&&Math.abs(axes[0].dot(axes[2]))<1e-4&&Math.abs(axes[1].dot(axes[2]))<1e-4&&matrix.determinant()>0,'Native collision matrix must be a proper rigid transform.');
  const position = new Vector3(), rotation = new Quaternion(), scale = new Vector3();
  matrix.decompose(position, rotation, scale);
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z));
  const sources = new Map<number, NativeCollisionSource>(); let disposed = false;
  const dispose = () => { if (disposed) return; disposed = true; sources.clear(); if (body.isValid()) world.removeRigidBody(body); };
  const add = (description: RAPIER.ColliderDesc, source: NativeCollisionSource) => {
    const collider = world.createCollider(description, body); sources.set(collider.handle, source);
  };
  const rotated = (point: ArrayLike<number>) => new Vector3(point[0], point[1], point[2]).applyQuaternion(rotation);
  try {
    model.spheres.forEach((sphere, index) => add(RAPIER.ColliderDesc.ball(sphere.radius).setTranslation(...rotated(sphere.center).toArray()), { kind: 'sphere', index, surface: sphere.surface }));
    model.boxes.forEach((box, index) => {
      const half = box.max.map((n, i) => (n - box.min[i]) / 2), center = box.max.map((n, i) => (n + box.min[i]) / 2);
      const offset = rotated(center);
      add(RAPIER.ColliderDesc.cuboid(half[0], half[1], half[2]).setTranslation(offset.x, offset.y, offset.z).setRotation(rotation), { kind: 'box', index, surface: box.surface });
    });
    if (model.mesh.indices.length) {
      // Bake static orientation before float32 physics conversion. A rotated native
      // Z-up plane otherwise introduces unstable capsule sweep normals.
      const vertices = new Float32Array(model.mesh.positions.length);
      for (let i = 0; i < vertices.length; i += 3) rotated(model.mesh.positions.subarray(i, i + 3)).toArray(vertices, i);
      add(RAPIER.ColliderDesc.trimesh(vertices, model.mesh.indices), { kind: 'mesh', mesh: model.mesh });
    }
  } catch (error) { dispose(); throw error; }
  // Shadow mesh and enclosing bounds are deliberately not physical colliders.
  return { body, sources, dispose };
}
