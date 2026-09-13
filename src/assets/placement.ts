import { Matrix4, Quaternion, Vector3 } from 'three';
import type { IplInstance } from './ipl';
/** GTA's IPL quaternion stores the inverse orientation. Convert once from Z-up to Y-up. */
export function placementMatrix(instance: IplInstance): Matrix4 {
  const [x, y, z, w] = instance.rotation;
  const native = new Matrix4().compose(new Vector3(...instance.position), new Quaternion(-x, -y, -z, w).normalize(), new Vector3(1, 1, 1));
  return new Matrix4().makeRotationX(-Math.PI / 2).multiply(native);
}
