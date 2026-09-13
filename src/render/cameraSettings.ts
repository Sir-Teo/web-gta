export type CameraDistanceMode = 'near' | 'medium' | 'far';
export interface CameraSettings { foot: CameraDistanceMode; vehicle: CameraDistanceMode }
export const CAMERA_MODES: readonly CameraDistanceMode[] = ['near', 'medium', 'far'];
export const DEFAULT_CAMERA: CameraSettings = { foot: 'medium', vehicle: 'medium' };
// Provisional framing for the authored meshes; these are not original camera measurements.
const DISTANCES = { foot: { near: 2.8, medium: 4.8, far: 6.4 }, vehicle: { near: 5.2, medium: 7.2, far: 9.4 } };
export function cameraNominalDistance(mode: CameraDistanceMode, inVehicle: boolean, speed: number) {
  return DISTANCES[inVehicle ? 'vehicle' : 'foot'][mode] + (inVehicle ? Math.min(Math.abs(speed) * 0.035, 1) : 0);
}
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
