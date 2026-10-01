import {requireAsset} from '../assets/binary';
import {scriptThingHandle} from './ScmFires';
/* CTheScripts' script spheres, pinned gta-reversed ead3051: `AddScriptSphere` (0x483B30), `RemoveScriptSphere`
 * (0x483BA0) and `DrawScriptSpheres` (0x4810E0) are reversed. ADD_SPHERE takes the first free of sixteen slots and
 * hands back a handle carrying the slot's unique id above its index; REMOVE_SPHERE frees the slot a live handle names.
 * Every frame each sphere in use is a red C3dMarkers cylinder. (The reference's AddScriptSphere asks the effect-system
 * array for the new unique id, a refactor slip; this follows the sphere's own, which GetActualScriptThingIndex reads.) */
export const MAX_NUM_SCRIPT_SPHERES=16;
export interface ScmScriptSphere {used:boolean;uniqueId:number;
 /** m_nId: the marker id C3dMarkers keys the cylinder by, the slot plus the id the command gives. */
 id:number;position:{x:number;y:number;z:number};radius:number}
export class ScmScriptSpheres {
 readonly spheres:ScmScriptSphere[]=Array.from({length:MAX_NUM_SCRIPT_SPHERES},()=>({used:false,uniqueId:1,id:0,position:{x:0,y:0,z:0},radius:0}));
 add(id:number,position:{x:number;y:number;z:number},radius:number){
  const index=this.spheres.findIndex(s=>!s.used);
  requireAsset(index>=0,'Every script sphere is in use.');
  requireAsset([position.x,position.y,position.z,radius].every(Number.isFinite),'Invalid script sphere.');
  const sphere=this.spheres[index],{handle,referenceIndex}=scriptThingHandle(index,sphere.uniqueId);
  sphere.uniqueId=referenceIndex;sphere.id=index+id;sphere.position={...position};sphere.used=true;sphere.radius=radius;
  return handle;
 }
 /** GetActualScriptThingIndex for a sphere: the slot a live handle names, or -1. */
 index(handle:number){
  if(handle===-1)return -1;
  const index=handle&0xffff,sphere=this.spheres[index];
  return sphere?.used&&sphere.uniqueId===handle>>>16?index:-1;
 }
 remove(handle:number){const index=this.index(handle);if(index<0)return;const sphere=this.spheres[index];sphere.used=false;sphere.id=0;}
 /** What DrawScriptSpheres places this frame. */
 get active(){return this.spheres.filter(s=>s.used);}
}
