import RAPIER from '@dimforge/rapier3d-compat';

/** Uses indexed fixed scenery and current actor poses, even between teleport and physics.
 * Callers must propagate body poses to colliders after teleports. Actors are held stationary
 * during this sweep, matching World.castShape; this is not a relative-velocity prediction. */
/** Larger than any vehicle's collision bound radius (buses and planes included). */
const ACTOR_RADIUS = 20;
export function currentShapeCast(world: RAPIER.World, origin: RAPIER.Vector, rotation: RAPIER.Rotation,
  velocity: RAPIER.Vector, shape: RAPIER.Shape, targetDistance: number, maxToi: number,
  excludedBody?: RAPIER.RigidBody, excludedCollider?: RAPIER.Collider, nearestActor?: {body?: RAPIER.RigidBody},
  ignore?: {body?: (body: RAPIER.RigidBody) => boolean; fixed?: (collider: RAPIER.Collider) => boolean}): number | undefined {
  const fixedFilter = ignore?.fixed, keepFixed = fixedFilter ? (collider: RAPIER.Collider) => !fixedFilter(collider) : undefined;
  const hit = world.castShape(origin, rotation, velocity, shape, targetDistance, maxToi, true,
    RAPIER.QueryFilterFlags.ONLY_FIXED, undefined, excludedCollider, excludedBody, keepFixed);
  let nearest = hit?.time_of_impact;
  if (nearestActor) nearestActor.body = undefined;
  // Actors whose origin is beyond the sweep plus a generous vehicle radius cannot be hit.
  const reach = targetDistance + maxToi * Math.hypot(velocity.x, velocity.y, velocity.z) + ACTOR_RADIUS;
  world.bodies.forEach(body => {
    if (body.isFixed() || !body.isEnabled() || body.handle === excludedBody?.handle) return;
    const t = body.translation();
    if ((t.x - origin.x) ** 2 + (t.y - origin.y) ** 2 + (t.z - origin.z) ** 2 > reach * reach) return;
    if (ignore?.body?.(body)) return;
    for (let i = 0; i < body.numColliders(); i++) {
      const collider = body.collider(i);
      if (!collider.isEnabled() || collider.handle === excludedCollider?.handle) continue;
      const actorHit = collider.castShape({ x: 0, y: 0, z: 0 }, shape, origin, rotation, velocity,
        targetDistance, nearest ?? maxToi, true);
      if (!actorHit) continue;
      if (nearestActor && actorHit.time_of_impact < (nearest ?? Infinity)) nearestActor.body = body;
      nearest = Math.min(nearest ?? maxToi, actorHit.time_of_impact);
    }
  });
  return nearest;
}
