export type CameraGlance = 'none' | 'left' | 'right' | 'behind';

export function cameraGlance(inVehicle: boolean, left: boolean, right: boolean, behind: boolean): CameraGlance {
  if (behind || inVehicle && left && right) return 'behind';
  if (inVehicle && left) return 'left';
  if (inVehicle && right) return 'right';
  return 'none';
}

// Yaw describes the camera-to-target offset, rather than the viewing direction.
// Temporary views leave the movement camera's stored yaw/pitch untouched.
export function glanceOrientation(glance: CameraGlance, yaw: number, pitch: number, vehicleHeading?: number) {
  if (glance === 'none') return { yaw, pitch };
  if (vehicleHeading === undefined) return { yaw: yaw + Math.PI, pitch };
  const offset = glance === 'left' ? Math.PI / 2 : glance === 'right' ? -Math.PI / 2 : 0;
  return { yaw: vehicleHeading + offset, pitch: 0.2 };
}
