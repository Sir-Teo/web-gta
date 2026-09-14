import { Matrix4, Quaternion, Vector3 } from 'three';
import type { IplInstance } from './ipl';
/** GTA's IPL quaternion stores the inverse orientation. Retain native Z-up here. */
export function nativePlacementMatrix(instance: IplInstance): Matrix4 {
  const [x, y, z, w] = instance.rotation;
  return new Matrix4().compose(new Vector3(...instance.position), new Quaternion(-x, -y, -z, w).normalize(), new Vector3(1, 1, 1));
}
/** Convert the native placement once from Z-up to the renderer's Y-up. */
export function placementMatrix(instance: IplInstance): Matrix4 {
  return new Matrix4().makeRotationX(-Math.PI / 2).multiply(nativePlacementMatrix(instance));
}
