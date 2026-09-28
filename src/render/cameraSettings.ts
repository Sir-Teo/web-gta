export type CameraDistanceMode = 'near' | 'medium' | 'far';
/** A vehicle's zooms end in the bumper view (CCam::Process_1stPerson, MODE_1STPERSON in a car). */
export type VehicleCameraMode = CameraDistanceMode | 'bumper';
export interface CameraSettings { foot: CameraDistanceMode; vehicle: VehicleCameraMode }
export const CAMERA_MODES: readonly CameraDistanceMode[] = ['near', 'medium', 'far'];
export const VEHICLE_CAMERA_MODES: readonly VehicleCameraMode[] = ['near', 'medium', 'far', 'bumper'];
export const DEFAULT_CAMERA: CameraSettings = { foot: 'medium', vehicle: 'medium' };
// Native-informed framing from gta-reversed Camera.cpp Init + SetZoomValueFollowPedScript:
// CCamera::Init sets TargetZoomGroundOne -0.55 / Two 1.5 / Three 3.6 with
// TargetCloseInDist 0.234 and MinRealGroundDist 1.85; script ped zooms are
// 0.25 / 1.50 / 2.90. The former authored 2.8/4.8/6.4 sat ~2x too far, making
// gait and street scale feel wrong and forcing extra scenery to render.
// Foot now uses 1.5 / 2.9 / 3.6. Vehicles take the host's per-vehicle chase distance scaled by vehicleZoomScale.
const FOOT_DISTANCES = { near: 1.5, medium: 2.9, far: 3.6 };
export function cameraNominalDistance(mode: CameraDistanceMode) { return FOOT_DISTANCES[mode]; }
/** The three car zooms (camVehicleZoom). Their distances live in the unreversed Process_FollowCar_SA; the scale on the
 * port's per-vehicle chase distance is AUTHORED, with the medium zoom the distance it always had. */
export function vehicleZoomScale(mode: VehicleCameraMode) { return mode === 'near' ? .75 : mode === 'far' ? 1.35 : 1; }
export function parseCameraSettings(value: unknown): CameraSettings {
  const data = value && typeof value === 'object' ? value as Partial<CameraSettings> : {};
  const foot = CAMERA_MODES.includes(data.foot as CameraDistanceMode) ? data.foot as CameraDistanceMode : DEFAULT_CAMERA.foot;
  const vehicle = VEHICLE_CAMERA_MODES.includes(data.vehicle as VehicleCameraMode) ? data.vehicle as VehicleCameraMode : DEFAULT_CAMERA.vehicle;
  return { foot, vehicle };
}
export function nextCameraMode(mode: CameraDistanceMode): CameraDistanceMode;
export function nextCameraMode(mode: VehicleCameraMode, vehicle: boolean, bumperAllowed?: boolean): VehicleCameraMode;
/** The next zoom: on foot the three, in a vehicle the three then the bumper view, unless the script disabled it
 * (SET_FIRST_PERSON_IN_CAR_CAMERA_MODE off). */
export function nextCameraMode(mode: VehicleCameraMode, vehicle = false, bumperAllowed = true): VehicleCameraMode {
  const modes = vehicle && bumperAllowed ? VEHICLE_CAMERA_MODES : CAMERA_MODES;
  const at = modes.indexOf(mode);
  return modes[(at + 1) % modes.length];
}
export function readCameraSettings(): CameraSettings {
  try { return parseCameraSettings(JSON.parse(localStorage.getItem('grove-camera-v1') ?? 'null')); }
  catch { return { ...DEFAULT_CAMERA }; }
}
export function saveCameraSettings(settings: CameraSettings) {
  try { localStorage.setItem('grove-camera-v1', JSON.stringify(settings)); } catch { /* Session controls still work without storage. */ }
}
