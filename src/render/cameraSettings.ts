export type CameraDistanceMode = 'near' | 'medium' | 'far';
export interface CameraSettings { foot: CameraDistanceMode; vehicle: CameraDistanceMode }
export const CAMERA_MODES: readonly CameraDistanceMode[] = ['near', 'medium', 'far'];
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
export function vehicleZoomScale(mode: CameraDistanceMode) { return mode === 'near' ? .75 : mode === 'far' ? 1.35 : 1; }
export function parseCameraSettings(value: unknown): CameraSettings {
  const data = value && typeof value === 'object' ? value as Partial<CameraSettings> : {};
  const mode = (key: keyof CameraSettings) => CAMERA_MODES.includes(data[key]!) ? data[key]! : DEFAULT_CAMERA[key];
  return { foot: mode('foot'), vehicle: mode('vehicle') };
}
export function nextCameraMode(mode: CameraDistanceMode): CameraDistanceMode {
  return CAMERA_MODES[(CAMERA_MODES.indexOf(mode) + 1) % CAMERA_MODES.length];
}
export function readCameraSettings(): CameraSettings {
  try { return parseCameraSettings(JSON.parse(localStorage.getItem('grove-camera-v1') ?? 'null')); }
  catch { return { ...DEFAULT_CAMERA }; }
}
export function saveCameraSettings(settings: CameraSettings) {
  try { localStorage.setItem('grove-camera-v1', JSON.stringify(settings)); } catch { /* Session controls still work without storage. */ }
}
