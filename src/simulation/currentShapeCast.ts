import RAPIER from '@dimforge/rapier3d-compat';

/** Uses indexed fixed scenery and current actor poses, even between teleport and physics.
 * Callers must propagate body poses to colliders after teleports. Actors are held stationary
 * during this sweep, matching World.castShape; this is not a relative-velocity prediction. */
export function currentShapeCast(world: RAPIER.World, origin: RAPIER.Vector, rotation: RAPIER.Rotation,
  velocity: RAPIER.Vector, shape: RAPIER.Shape, targetDistance: number, maxToi: number,
  excludedBody?: RAPIER.RigidBody, excludedCollider?: RAPIER.Collider): number | undefined {
  const hit = world.castShape(origin, rotation, velocity, shape, targetDistance, maxToi, true,
    RAPIER.QueryFilterFlags.ONLY_FIXED, undefined, excludedCollider, excludedBody);
  let nearest = hit?.time_of_impact;
  world.bodies.forEach(body => {
    if (body.isFixed() || !body.isEnabled() || body.handle === excludedBody?.handle) return;
    for (let i = 0; i < body.numColliders(); i++) {
      const collider = body.collider(i);
      if (!collider.isEnabled() || collider.handle === excludedCollider?.handle) continue;
      const actorHit = collider.castShape({ x: 0, y: 0, z: 0 }, shape, origin, rotation, velocity,
        targetDistance, nearest ?? maxToi, true);
      if (actorHit) nearest = Math.min(nearest ?? maxToi, actorHit.time_of_impact);
    }
  });
  return nearest;
}
