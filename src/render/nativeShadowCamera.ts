import {Vector3,type OrthographicCamera} from 'three';
import type {Vec3} from '../core/math';
/** CShadowCamera::SetFrustum/SetCenter in browser coordinates. The caller supplies
 * the native light orientation and stable entity bounding sphere independently. */
export function configureNativeShadowCamera(camera:OrthographicCamera,center:Vec3,radius:number){
 const r=Math.fround(radius),near=Math.fround(r/1000),far=Math.fround(2*r);
 if(![center.x,center.y,center.z,r,near,far,...camera.quaternion.toArray()].every(Number.isFinite)||near<=0||far<=near||camera.quaternion.lengthSq()<1e-12)throw new Error('Invalid native shadow camera framing.');
 if(camera.parent)throw new Error('Native shadow camera requires an unparented camera.');
 camera.quaternion.normalize();camera.scale.set(1,1,1);
 const forward=new Vector3(0,0,-1).applyQuaternion(camera.quaternion);
 camera.left=-r;camera.right=r;camera.top=r;camera.bottom=-r;camera.near=near;camera.far=far;camera.zoom=1;
 camera.position.set(center.x,center.y,center.z).addScaledVector(forward,-far/2);
 camera.clearViewOffset();camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
}
