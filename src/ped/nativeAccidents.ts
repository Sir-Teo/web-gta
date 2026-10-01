/* CAccidentManager (AccidentManager.cpp, reversed) and CAccident (Accident.h): the sixteen slots of the dead a medic
 * may revive, which CTaskComplexMedicTreatInjuredPed asks for the nearest free one.
 *
 * ReportAccident's caller is a raw call in the reference; the port reports a ped the first time it is seen dead. */

export const NUM_ACCIDENTS=16;

/** What CAccident asks of its ped. Positions are native (x, y ground plane, z up). */
export interface AccidentPed {
 /** IsCreatedBy(PED_MISSION). */
 readonly mission:boolean;
 /** bAllowMedicsToReviveMe (cleared by the script for its own dead). */
 readonly allowMedics:boolean;
 /** physicalFlags.bSubmergedInWater. */
 submerged():boolean;
 /** bRemoveHead. */
 readonly headless:boolean;
 position():{x:number;y:number;z:number};
}

export interface Accident<P> {ped?:P;treated:boolean;revived:boolean}

export class NativeAccidentManager<P extends AccidentPed> {
 readonly accidents:Accident<P>[]=Array.from({length:NUM_ACCIDENTS},()=>({treated:false,revived:false}));
 /** CAccidentManager::ReportAccident (0x56CE80): a ped not the script's, and that medics may revive, takes the first
  * empty slot unless it holds one already. */
 report(ped:P){
  if(ped.mission||!ped.allowMedics)return;
  let slot:Accident<P>|undefined;
  for(const a of this.accidents){
   if(a.ped===ped)return;
   if(!a.ped&&!slot)slot=a;
  }
  if(slot){slot.ped=ped;slot.treated=false;slot.revived=false;}
 }
 /** CAccident::IsFree (0x56CE00). */
 isFree(a:Accident<P>):a is Accident<P>&{ped:P}{return !!a.ped&&!a.treated&&!a.revived&&!a.ped.submerged();}
 /** CAccidentManager::GetNumberOfFreeAccidents (0x56CEE0). */
 numberOfFree(){let n=0;for(const a of this.accidents)if(this.isFree(a))n++;return n;}
 /** CAccidentManager::GetNearestFreeAccidentExceptThisOne (0x56CF90): by 3D distance; a headless body is passed over
  * when asked. */
 nearestFreeExcept(posn:{x:number;y:number;z:number},thisOne:Accident<P>|undefined,ignoreHeadless:boolean){
  let best:(Accident<P>&{ped:P})|undefined,min=Number.MAX_VALUE;
  for(const a of this.accidents){
   if(!this.isFree(a)||a.ped.headless&&ignoreHeadless||thisOne===a)continue;
   const p=a.ped.position(),d=Math.hypot(p.x-posn.x,p.y-posn.y,p.z-posn.z);
   if(d<min){min=d;best=a;}
  }
  return best;
 }
 /** CAccidentManager::GetNearestFreeAccident (0x56D050). */
 nearestFree(posn:{x:number;y:number;z:number},ignoreHeadless:boolean){return this.nearestFreeExcept(posn,undefined,ignoreHeadless);}
 /** The registered reference nulled when the ped leaves the world (CEntity::CleanUpOldReference). */
 forget(ped:P){for(const a of this.accidents)if(a.ped===ped)a.ped=undefined;}
 /** The slot holding a ped, if any. */
 of(ped:P){return this.accidents.find(a=>a.ped===ped);}
}
