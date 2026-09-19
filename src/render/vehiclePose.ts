import {Quaternion,Vector3,type Object3D} from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type {Vec3} from '../core/math';
const current=new Quaternion(),lastPosition=new Vector3(),lastRotation=new Quaternion();
/** Recompose a vehicle root and bring its whole hierarchy's world matrices up to date now. Deferring that to
 * the renderer's pass is not safe: three's updateWorldMatrix(true, false), which getWorldPosition and
 * localToWorld use, clears the root's dirty flag without touching its children, so a seat or dummy query
 * between here and the render would leave the body drawn where it was. */
export function composeVehicleRoot(root:Object3D){root.updateMatrix();root.updateMatrixWorld(true);}
/** Both pose components use the same fixed-step endpoints. SLERP takes the
 * shortest rotation path, including yaw crossings at +/- pi. The root's matrix is
 * owned here: it is recomposed only when the pose moved, so a parked vehicle's
 * whole hierarchy is not recomputed every frame. */
export function interpolateVehiclePose(root:Object3D,vehicle:{body:RAPIER.RigidBody;previous:Vec3;previousRotation:RAPIER.Rotation},alpha:number){
  root.matrixAutoUpdate=false;
  lastPosition.copy(root.position);lastRotation.copy(root.quaternion);
  const p=vehicle.body.translation(),a=vehicle.previous;
  root.position.set(a.x+(p.x-a.x)*alpha,a.y+(p.y-a.y)*alpha,a.z+(p.z-a.z)*alpha);
  current.copy(vehicle.body.rotation());
  root.quaternion.copy(vehicle.previousRotation).slerp(current,alpha);
  if(!root.position.equals(lastPosition)||!root.quaternion.equals(lastRotation)||root.userData.poseComposed!==true){composeVehicleRoot(root);root.userData.poseComposed=true;}
}
