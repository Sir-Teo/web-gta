import {Vector4,type PerspectiveCamera,type Vector3} from 'three';
import {nativeSpriteMetrics} from './corona';

/** Match native normalized screen coordinates to the current browser camera.
 * sizeFov is the native CDraw scalar for sprite size, not necessarily camera.fov.
 * Caller updates the camera world/projection matrices before projecting. */
export function projectCorona(camera:PerspectiveCamera,position:Vector3,width:number,height:number,sizeFov:number,checkFar=true) {
  const clip=new Vector4(position.x,position.y,position.z,1).applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix);
  return nativeSpriteMetrics({x:(clip.x+clip.w)*.5,y:(clip.w-clip.y)*.5,z:clip.w},
    {width,height,fov:sizeFov,near:camera.near,far:camera.far},true,checkFar);
}
