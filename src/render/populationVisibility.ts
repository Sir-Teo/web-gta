import {Frustum,Matrix4,Sphere,Vector3,type PerspectiveCamera} from 'three';
/** Browser spawn guard: native population generation is not fully reversed.
 * Reserve an expanded screen-space volume, including viewport edges. Never
 * publish a newly loaded population entity inside it. */
export function populationOutsideView(camera:PerspectiveCamera,point:{x:number;y:number;z:number},radius:number){
 camera.updateWorldMatrix(true,false);
 const frustum=new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),camera.coordinateSystem,camera.reversedDepth);
 return !frustum.intersectsSphere(new Sphere(new Vector3(point.x,point.y,point.z),radius));
}
