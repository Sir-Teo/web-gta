import type {DffModel} from './dff';
import {requireAsset} from './binary';
import {resolveCarWheelFrames} from './carWheelFrames';
import {NATIVE_CAR_WHEELS,type CarWheel} from '../simulation/nativeDriveContacts';

/** Ordinary single-wheel-atomic car layout. Mirrors HideDamagedAtomicCB and
 * the main-wheel collapse/clone branch of PreprocessHierarchy. The source
 * MoveObjectsCB reassigns frames without preserving child transforms.
 * Descriptor-table extras, damageable-frame collapse and wheel animation are
 * separate, unfinished stages; this is not the full native preprocessing pass. */
export function prepareCarModel(model:DffModel,wheels:Record<CarWheel,number>=resolveCarWheelFrames(model)):DffModel {
  requireAsset(new Set(NATIVE_CAR_WHEELS.map(w=>wheels[w])).size===4,'Car requires four distinct wheel frames.');
  for(const wheel of NATIVE_CAR_WHEELS)requireAsset(Number.isInteger(wheels[wheel])&&wheels[wheel]>=0&&wheels[wheel]<model.frames.length,'Invalid car wheel frame.');
  const belongs=(frame:number,ancestor:number)=>{
    for(let count=0;frame>=0;count++){
      requireAsset(count<model.frames.length&&frame<model.frames.length,'Invalid car frame hierarchy.');
      if(frame===ancestor)return true;
      frame=model.frames[frame].parent;
    }
    return false;
  };
  const sourceIndices=model.atomics.flatMap((a,i)=>belongs(a.frame,wheels.frontRight)?[i]:[]);
  requireAsset(sourceIndices.length===1,'Car main wheel requires exactly one atomic.');
  for(const wheel of NATIVE_CAR_WHEELS)if(wheel!=='frontRight')
    requireAsset(!model.atomics.some(a=>belongs(a.frame,wheels[wheel])),'Car wheel clone target already contains an atomic.');
  const atomics=model.atomics.map(a=>({...a,flags:model.frames[a.frame].name.includes('_dam')?0:a.flags}));
  const source=atomics[sourceIndices[0]];source.frame=wheels.frontRight;
  for(const wheel of NATIVE_CAR_WHEELS)if(wheel!=='frontRight')atomics.push({...source,frame:wheels[wheel]});
  // Keep empty source frames and all geometry immutable for raw inspection.
  return {...model,atomics};
}
