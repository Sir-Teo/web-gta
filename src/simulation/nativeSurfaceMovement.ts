import {readSurfaceInfo} from '../assets/surfaceInfo';
import {nativeSurfaceId} from '../assets/surfaceIds';
/** LoadSurfaceInfos narrows Sprint to bool; later records for an ID win. */
export function readSurfaceSprintRestrictions(text:string){
 const byId=new Map<number,boolean>();
 for(const record of readSurfaceInfo(text).records)byId.set(nativeSurfaceId(record.name),record.values.sprint!==0);
 return byId;
}
/** Surface restriction applies to grounded, on-foot controls before gait selection.
 * Contact selection uses the browser's bounded support probe, not CPed's full solver. */
export function surfaceBlocksSprint(restrictions:ReadonlyMap<number,boolean>|undefined,material:number|undefined){
 return material!==undefined&&restrictions?.get(material)===true;
}
