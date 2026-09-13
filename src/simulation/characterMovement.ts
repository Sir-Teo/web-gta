import type RAPIER from '@dimforge/rapier3d-compat';
/** Resolve lateral travel before gravity so persistent floor contact cannot consume the lateral sweep. */
export function characterMovement(controller: RAPIER.KinematicCharacterController, collider: RAPIER.Collider, desired: RAPIER.Vector3) {
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
