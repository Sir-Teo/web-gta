import type RAPIER from '@dimforge/rapier3d-compat';
/** Substep long strides so fast sprint roots cannot tunnel low ceilings. Lag
 * spikes (dt clamped to 100 ms upstream) split into ≤15 cm substeps (≤6),
 * resolving lateral before gravity per substep so floor contact never consumes
 * the sweep. Crouched seam-climbing is handled by the stance autostep in
 * Simulation instead of finer global substeps. */
/** Colliders the last sweep ran into, for contact responses the controller itself does not apply. */
function sweptColliders(controller: RAPIER.KinematicCharacterController, into: Set<number>) {
  for (let i = 0; i < controller.numComputedCollisions(); i++) { const hit = controller.computedCollision(i)?.collider; if (hit) into.add(hit.handle); }
}
function moveOnce(controller: RAPIER.KinematicCharacterController, collider: RAPIER.Collider, desired: RAPIER.Vector3, hits = new Set<number>()) {
  if (desired.y >= 0 || (desired.x === 0 && desired.z === 0)) {
    controller.computeColliderMovement(collider, desired);sweptColliders(controller, hits);
    return { movement: controller.computedMovement(), grounded: controller.computedGrounded(), hits };
  }
  const start = collider.translation();
  controller.computeColliderMovement(collider, { x: desired.x, y: 0, z: desired.z });sweptColliders(controller, hits);
  const lateral = controller.computedMovement();
  // Grounded after the lateral sweep (snap-to-ground keeps a walker on the floor), a downward sweep cannot
  // move the capsule further: skip it. This halves the controller work of every walking ped.
  if (controller.computedGrounded()) return { movement: { x: lateral.x, y: lateral.y, z: lateral.z }, grounded: true, hits };
  // Query only: restore the world-space collider pose before the body is integrated.
  try {
    collider.setTranslation({ x: start.x + lateral.x, y: start.y + lateral.y, z: start.z + lateral.z });
    controller.computeColliderMovement(collider, { x: 0, y: desired.y, z: 0 });
    const vertical = controller.computedMovement();
    return { movement: { x: lateral.x + vertical.x, y: lateral.y + vertical.y, z: lateral.z + vertical.z }, grounded: controller.computedGrounded(), hits };
  } finally {
    collider.setTranslation(start);
  }
}
/** Resolve lateral travel before gravity so persistent floor contact cannot consume the lateral sweep. */
export function characterMovement(controller: RAPIER.KinematicCharacterController, collider: RAPIER.Collider, desired: RAPIER.Vector3) {
 const lateralLen = Math.hypot(desired.x, desired.z);
 if (lateralLen <= 0.15) return moveOnce(controller, collider, desired);
 const hits = new Set<number>();
 const steps = Math.min(6, Math.ceil(lateralLen / 0.15));
  const origin = collider.translation();
  let mx = 0, my = 0, mz = 0, grounded = false;
  try {
  for (let i = 0; i < steps; i++) {
    const part = moveOnce(controller, collider, { x: desired.x / steps, y: desired.y / steps, z: desired.z / steps }, hits);
    // Advance the query pose between substeps so each sweep starts where the last ended.
    const now = collider.translation();
    collider.setTranslation({ x: now.x + part.movement.x, y: now.y + part.movement.y, z: now.z + part.movement.z });
    mx += part.movement.x; my += part.movement.y; mz += part.movement.z;
    grounded = part.grounded;
  }
  } finally {
    // Restore exactly: the caller integrates via setNextKinematicTranslation.
    collider.setTranslation(origin);
  }
  return { movement: { x: mx, y: my, z: mz }, grounded, hits };
}
