import type RAPIER from '@dimforge/rapier3d-compat';
import {requireAsset} from '../assets/binary';
import {NATIVE_CAR_WHEELS,type CarWheel} from './nativeDriveContacts';
import type {NativeSuspensionLine} from './nativeSuspension';
/** Create a contact-query controller for the native force solver. Its chassis local
 * axes must already use (native x,y,z) -> (browser x,z,-y), with no model scale. */
export function createNativeWheelRays(world:RAPIER.World,body:RAPIER.RigidBody,lines:Record<CarWheel,NativeSuspensionLine>){
  requireAsset(body.isDynamic()&&world.getRigidBody(body.handle)===body,'Wheel rays require a dynamic chassis in this world.');
  for(const wheel of NATIVE_CAR_WHEELS){
    const l=lines[wheel];
    requireAsset(l&&[l.start.x,l.start.y,l.start.z,l.end.x,l.end.y,l.end.z,l.radius,l.springLength,l.lineLength].every(Number.isFinite),'Invalid native wheel-ray geometry.');
    requireAsset(l.radius>0&&l.springLength>0&&l.lineLength>l.springLength&&l.start.x===l.end.x&&l.start.y===l.end.y&&
      Math.abs(l.start.z-l.end.z-l.lineLength)<1e-5&&Math.abs(l.springLength+l.radius-l.lineLength)<1e-5,'Inconsistent native wheel-ray dimensions.');
  }
  const controller=world.createVehicleController(body),indices={} as Record<CarWheel,number>;
  try{
    controller.indexUpAxis=1;controller.setIndexForwardAxis=2;
    for(const wheel of NATIVE_CAR_WHEELS){
      const l=lines[wheel],i=controller.numWheels();indices[wheel]=i;
      controller.addWheel({x:l.start.x,y:l.start.z,z:-l.start.y},{x:0,y:-1,z:0},{x:-1,y:0,z:0},l.springLength,l.radius);
      controller.setWheelMaxSuspensionTravel(i,l.springLength);
      controller.setWheelSuspensionStiffness(i,0);controller.setWheelSuspensionCompression(i,0);controller.setWheelSuspensionRelaxation(i,0);
      controller.setWheelMaxSuspensionForce(i,0);controller.setWheelFrictionSlip(i,0);controller.setWheelSideFrictionStiffness(i,0);
      controller.setWheelEngineForce(i,0);controller.setWheelBrake(i,0);controller.setWheelSteering(i,0);
    }
  }catch(error){world.removeVehicleController(controller);throw error;}
  let disposed=false;
  return {controller,indices,dispose(){if(!disposed){disposed=true;world.removeVehicleController(controller);}}};
}
