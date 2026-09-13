import RAPIER from '@dimforge/rapier3d-compat';
import { Box3, Vector3 } from 'three';
import type { ScenePart } from '../assets/scene';
import { placementMatrix } from '../assets/placement';
/** Find a supported, upright capsule location on imported collision, preferring mesh/box surfaces. */
export function importedSpawn(world: RAPIER.World, parts: ScenePart[], handles: Set<number>, player: RAPIER.Collider) {
  for (const part of parts) {
    if (!part.collision) continue;
    for (const placement of part.placements.slice(0, 64)) {
      const bounds = new Box3(new Vector3(...part.collision.bounds.min), new Vector3(...part.collision.bounds.max)).applyMatrix4(placementMatrix(placement));
      for (const fx of [0.5, 0.25, 0.75, 0.125, 0.875]) for (const fz of [0.5, 0.25, 0.75, 0.125, 0.875]) {
        const x = bounds.min.x + (bounds.max.x - bounds.min.x) * fx, z = bounds.min.z + (bounds.max.z - bounds.min.z) * fz;
        const y = bounds.max.y + 3;
        const hit = world.castRayAndGetNormal(new RAPIER.Ray({ x, y, z }, { x: 0, y: -1, z: 0 }), y - bounds.min.y + 1, true, undefined, undefined, player, undefined, c => handles.has(c.handle));
        if (!hit || hit.normal.y < 0.8 || hit.collider.shapeType() === RAPIER.ShapeType.Ball) continue;
        const foot = { x, y: y - hit.timeOfImpact + 0.05, z };
        if (!world.intersectionWithShape({ x, y: foot.y + 0.9, z }, { x: 0, y: 0, z: 0, w: 1 }, new RAPIER.Capsule(0.55, 0.3), undefined, undefined, player)) return foot;
      }
    }
  }
  throw new Error('No clear supported spawn was found on the imported collision.');
}
