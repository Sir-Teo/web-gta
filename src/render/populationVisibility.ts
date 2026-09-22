import {Frustum,Matrix4,Sphere,type PerspectiveCamera} from 'three';
// Scratch state: this runs per pedestrian per substep and per script query, so it must not allocate.
const frustum=new Frustum(),viewProjection=new Matrix4(),sphere=new Sphere();
/** Browser spawn guard: native population generation is not fully reversed.
 * Reserve an expanded screen-space volume, including viewport edges. Never
 * publish a newly loaded population entity inside it. */
export function populationOutsideView(camera:PerspectiveCamera,point:{x:number;y:number;z:number},radius:number){
 // A script camera can move within a frame, so the camera is refreshed on every query, as before.
 camera.updateWorldMatrix(true,false);
 frustum.setFromProjectionMatrix(viewProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),camera.coordinateSystem,camera.reversedDepth);
 sphere.center.set(point.x,point.y,point.z);sphere.radius=radius;
 return !frustum.intersectsSphere(sphere);
}
