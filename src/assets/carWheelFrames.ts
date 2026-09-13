import type {DffModel} from './dff';
import {requireAsset} from './binary';
import type {CarWheel} from '../simulation/nativeDriveContacts';
/** Conventional SA car dummy names. This resolves unambiguous imported names,
 * not the executable's descriptor table, visibility IDs or hierarchy preprocessing. */
const names:Record<CarWheel,string>={frontLeft:'wheel_lf_dummy',rearLeft:'wheel_lb_dummy',frontRight:'wheel_rf_dummy',rearRight:'wheel_rb_dummy'};
export function resolveCarWheelFrames(model:Pick<DffModel,'frames'>):Record<CarWheel,number>{
  const result={} as Record<CarWheel,number>;
  for(const wheel of Object.keys(names) as CarWheel[]){
    const matches:number[]=[];
    model.frames.forEach((frame,index)=>{if(frame.name===names[wheel])matches.push(index);});
    requireAsset(matches.length===1,`Car requires exactly one ${names[wheel]} frame; found ${matches.length}.`);
    const index=matches[0];
    requireAsset(model.frames[index].parent>=0,'Car wheel dummy cannot be a clump root.');
    result[wheel]=index;
  }
  return result;
}
