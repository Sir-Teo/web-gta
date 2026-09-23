import type {DffModel} from '../assets/dff';
import type {VehicleIdeRecord} from '../assets/vehicleIde';
import type {prepareHandling} from './nativeHandling';
import {NATIVE_CAR_WHEELS,type CarWheel} from './nativeDriveContacts';
import {nativeSuspensionLine,type NativeSuspensionLine} from './nativeSuspension';
import {requireAsset} from '../assets/binary';
import {resolveCarWheelFrames} from '../assets/carWheelFrames';
/** Ordinary-car GetWheelPosn/SetupSuspensionLines. Uses explicit resolved wheel-frame identities when supplied, otherwise strict
 * conventional car dummy names. Frame array order never determines wheel identity. */
export function nativeVehicleSuspension(vehicle:VehicleIdeRecord,handling:ReturnType<typeof prepareHandling>,model:Pick<DffModel,'frames'>,frameIndices?:Record<CarWheel,number>){
  // A CMonsterTruck sets its lines up with CMonsterTruck::SetupSuspensionLines, which is not reversed: it uses the car's.
  requireAsset(vehicle.type==='car'||vehicle.type==='mtruck'||vehicle.id===539,'Only ordinary car suspension geometry is supported.');
  requireAsset(vehicle.frontWheelSize!==undefined&&vehicle.rearWheelSize!==undefined,'Vehicle requires explicit front and rear wheel sizes.');
  const indices=frameIndices??resolveCarWheelFrames(model);
  requireAsset(new Set(NATIVE_CAR_WHEELS.map(w=>indices[w])).size===4,'Vehicle wheels require four distinct frame identities.');
  const lines={} as Record<CarWheel,NativeSuspensionLine>;
  for(const wheel of NATIVE_CAR_WHEELS){
    const index=indices[wheel];requireAsset(Number.isInteger(index)&&index>=0&&index<model.frames.length,`Invalid wheel frame for ${wheel}.`);
    const frame=model.frames[index],m=frame.matrix;
    requireAsset(m.length===16&&m.every(Number.isFinite)&&m[3]===0&&m[7]===0&&m[11]===0&&m[15]===1,'Wheel frame requires a finite affine matrix.');
    // Ordinary automobile source reads the selected frame's local position.
    // Parent transforms are only accumulated in its separate plane branch.
    lines[wheel]=nativeSuspensionLine({x:m[12],y:m[13],z:m[14]},handling.values.suspensionUpperLimit,handling.values.suspensionLowerLimit,
      wheel.startsWith('front')?vehicle.frontWheelSize:vehicle.rearWheelSize);
  }
  return lines;
}
