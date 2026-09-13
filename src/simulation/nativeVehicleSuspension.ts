import type {DffModel} from '../assets/dff';
import type {VehicleIdeRecord} from '../assets/vehicleIde';
import type {prepareHandling} from './nativeHandling';
import {NATIVE_CAR_WHEELS,type CarWheel} from './nativeDriveContacts';
import {nativeSuspensionLine,type NativeSuspensionLine} from './nativeSuspension';
import {requireAsset} from '../assets/binary';
/** Ordinary-car GetWheelPosn/SetupSuspensionLines. Frame indices are explicit
 * resolved native wheel-frame identities, never inferred from array order. */
export function nativeVehicleSuspension(vehicle:VehicleIdeRecord,handling:ReturnType<typeof prepareHandling>,model:Pick<DffModel,'frames'>,frameIndices:Record<CarWheel,number>){
  requireAsset(vehicle.type==='car','Only ordinary car suspension geometry is supported.');
  requireAsset(vehicle.frontWheelSize!==undefined&&vehicle.rearWheelSize!==undefined,'Vehicle requires explicit front and rear wheel sizes.');
  requireAsset(new Set(NATIVE_CAR_WHEELS.map(w=>frameIndices[w])).size===4,'Vehicle wheels require four distinct frame identities.');
  const lines={} as Record<CarWheel,NativeSuspensionLine>;
  for(const wheel of NATIVE_CAR_WHEELS){
    const index=frameIndices[wheel];requireAsset(Number.isInteger(index)&&index>=0&&index<model.frames.length,`Invalid wheel frame for ${wheel}.`);
    const frame=model.frames[index],m=frame.matrix;
    requireAsset(m.length===16&&m.every(Number.isFinite)&&m[3]===0&&m[7]===0&&m[11]===0&&m[15]===1,'Wheel frame requires a finite affine matrix.');
    // Ordinary automobile source reads the selected frame's local position.
    // Parent transforms are only accumulated in its separate plane branch.
    lines[wheel]=nativeSuspensionLine({x:m[12],y:m[13],z:m[14]},handling.values.suspensionUpperLimit,handling.values.suspensionLowerLimit,
      wheel.startsWith('front')?vehicle.frontWheelSize:vehicle.rearWheelSize);
  }
  return lines;
}
