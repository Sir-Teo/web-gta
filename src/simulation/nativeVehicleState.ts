import {emptyWheelContacts,type WheelValues} from './nativeDriveContacts';
import type {NativeWheelFrameState} from './nativeWheelFrame';

/** Initial fields from CPhysical, CVehicle and CAutomobile constructors. This is
 * mechanical state only, not model loading, driver status, or a complete vehicle. */
export function initialNativeVehicleState(){
  const wheelFrame:NativeWheelFrameState={
    drivetrain:{contacts:emptyWheelContacts(),transmission:{gear:1,inertia:{ratio:0,smoothing:0}}},
    wheels:{frontLeft:'normal',rearLeft:'normal',frontRight:'normal',rearRight:'normal'},
  };
  const extended=():WheelValues=>({frontLeft:1,rearLeft:1,frontRight:1,rearRight:1});
  return {wheelFrame,velocityFrequency:1,carTraction:1,tireTemperature:1,
    steerAngle:0,secondSteerAngle:0,gasPedal:0,brakePedal:0,
    compression:extended(),previousCompression:extended(),rotation:emptyWheelContacts(),wheelSpeed:emptyWheelContacts()};
}
