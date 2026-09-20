import type {Vec3} from '../core/math';
import type RAPIER from '@dimforge/rapier3d-compat';
import {requireAsset} from '../assets/binary';
import {NATIVE_CAR_WHEELS,type CarWheel,type WheelValues} from './nativeDriveContacts';
import {sampleNativeGroundSuspension,type NativeSuspensionLine,type NativeSuspensionGroundState} from './nativeSuspension';
import {sampleNativeWheelGeometry} from './nativeWheelContact';
import type {SuspensionFrameWheel} from './nativeSuspensionFrame';
import type {NativeCollisionSource} from './nativeCollision';
/** Read all refreshed wheel rays before applying any native force. Per-wheel
 * force/bias/damping and ground/RNG states are explicit source-profile inputs. */
export function sampleNativeSuspensionWheels(controller:RAPIER.DynamicRayCastVehicleController,indices:Record<CarWheel,number>,lines:Record<CarWheel,NativeSuspensionLine>,ground:Record<CarWheel,NativeSuspensionGroundState>,parameters:Record<CarWheel,Pick<SuspensionFrameWheel,'forceLevel'|'bias'|'damping'>>,sources?:ReadonlyMap<number,NativeCollisionSource>,hover?:Partial<Record<CarWheel,{fraction:number;point:Vec3;normal:Vec3}>>){
  requireAsset(new Set(NATIVE_CAR_WHEELS.map(w=>indices[w])).size===4,'Suspension sampling requires four distinct wheel indices.');
  const compression={} as WheelValues,wheels={} as Record<CarWheel,SuspensionFrameWheel|undefined>;
  const geometry={} as Record<CarWheel,ReturnType<typeof sampleNativeWheelGeometry>>;
  for(const wheel of NATIVE_CAR_WHEELS){
    // DoHoverSuspensionRatios: a water-plane contact replaces the raycast for this wheel.
    const water=hover?.[wheel];
    const sample=sampleNativeGroundSuspension(controller,indices[wheel],lines[wheel],ground[wheel],water?.fraction);
    const contact=water?undefined:sampleNativeWheelGeometry(controller,indices[wheel],sources);
    compression[wheel]=sample.compression;geometry[wheel]=contact;
    requireAsset(sample.compression>=1||contact||water,'Compressed suspension is missing current contact geometry.');
    wheels[wheel]=water&&sample.compression<1?{...parameters[wheel],compression:sample.compression,point:water.point,normal:water.normal,groundSpeed:{x:0,y:0,z:0}}
     :contact&&sample.compression<1?{...parameters[wheel],compression:sample.compression,point:contact.point,normal:contact.normal,groundSpeed:contact.groundSpeed}:undefined;
  }
  return {compression,wheels,geometry};
}
