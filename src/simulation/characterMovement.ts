import type RAPIER from '@dimforge/rapier3d-compat';
/** Substep long strides so fast crouch/sprint roots cannot tunnel low ceilings.
 * Native GunCrouchFwd root is 3.74 m/s; a single 60 Hz step moves 6 cm, but lag
 * spikes (dt clamped to 100 ms upstream) can move 37 cm. Split lateral travel
 * into ≤15 cm substeps, resolving lateral before gravity per substep so floor
 * contact never consumes the sweep. */
function moveOnce(controller: RAPIER.KinematicCharacterController, collider: RAPIER.Collider, desired: RAPIER.Vector3) {
  if (desired.y >= 0 || (desired.x === 0 && desired.z === 0)) {
    controller.computeColliderMovement(collider, desired);
    return { movement: controller.computedMovement(), grounded: controller.computedGrounded() };
  }
  const start = collider.translation();
  controller.computeColliderMovement(collider, { x: desired.x, y: 0, z: desired.z });
  const lateral = controller.computedMovement();
  // Query only: restore the world-space collider pose before the body is integrated.
  try {
    collider.setTranslation({ x: start.x + lateral.x, y: start.y + lateral.y, z: start.z + lateral.z });
    controller.computeColliderMovement(collider, { x: 0, y: desired.y, z: 0 });
    const vertical = controller.computedMovement();
    return { movement: { x: lateral.x + vertical.x, y: lateral.y + vertical.y, z: lateral.z + vertical.z }, grounded: controller.computedGrounded() };
  } finally {
    collider.setTranslation(start);
  }
}
/** Resolve lateral travel before gravity so persistent floor contact cannot consume the lateral sweep. */
export function characterMovement(controller: RAPIER.KinematicCharacterController, collider: RAPIER.Collider, desired: RAPIER.Vector3) {
  const lateralLen = Math.hypot(desired.x, desired.z);
  if (lateralLen <= 0.15) return moveOnce(controller, collider, desired);
  const steps = Math.min(6, Math.ceil(lateralLen / 0.15));
  const origin = collider.translation();
  let mx = 0, my = 0, mz = 0, grounded = false;
  try {
  for (let i = 0; i < steps; i++) {
    const part = moveOnce(controller, collider, { x: desired.x / steps, y: desired.y / steps, z: desired.z / steps });
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
  return { movement: { x: mx, y: my, z: mz }, grounded };
}
