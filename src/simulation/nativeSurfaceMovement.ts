import {readSurfaceInfo} from '../assets/surfaceInfo';
import {nativeSurfaceId} from '../assets/surfaceIds';
/** LoadSurfaceInfos narrows Sprint and Climbable to bool; later records for an ID win. */
export function readSurfaceMovementFlags(text:string){
 const sprint=new Map<number,boolean>(),climbable=new Map<number,boolean>();
 for(const record of readSurfaceInfo(text).records){const id=nativeSurfaceId(record.name);sprint.set(id,record.values.sprint!==0);climbable.set(id,record.values.climbable!==0);}
 return {sprint,climbable};
}
export function readSurfaceSprintRestrictions(text:string){return readSurfaceMovementFlags(text).sprint;}
/** Surface restriction applies to grounded, on-foot controls before gait selection.
 * Contact selection uses the browser's bounded support probe, not CPed's full solver. */
export function surfaceBlocksSprint(restrictions:ReadonlyMap<number,boolean>|undefined,material:number|undefined){
 return material!==undefined&&restrictions?.get(material)===true;
}
