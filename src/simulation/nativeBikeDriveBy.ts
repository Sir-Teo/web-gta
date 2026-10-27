import {blendBicycleAssociation,type BicycleAssociation} from './nativeBicycleBlend';
/** Player/pad/weapon eligibility is supplied by the host; fire is CPad's car-gun result. */
export interface BikeDriveByInput {enabled:boolean;fire:number;left:boolean;right:boolean;ammo:number;bicycle:boolean}
/** CVehicle::DoDriveByShootings 0x10049b674, bike/quad association writes.
 * Weapon state/update, shot timestamps and firing remain separate owner work. */
export function controlBikeDriveBy(associations:BicycleAssociation[],input:BikeDriveByInput|undefined,duration:(identifier:number)=>number){
 if(!input?.enabled)return;
 if((input.bicycle?input.fire===1:input.fire!==0)&&input.ammo>=1){
  const identifier=input.left?202:input.right?203:204,target=associations.find(a=>a.identifier===identifier);
  if(!target||target.delta<0)blendBicycleAssociation(associations,identifier,duration(identifier),16);
  return identifier;
 }
 for(const a of associations)if(a.identifier>=202&&a.identifier<=204)a.delta=-8;
}

/** The selected shooting pose must finish playing and blend past 0.99 before a shot attempt.
 * Sample after drive-by control, before the frame's rider/clump update. */
export function bikeDriveByAnimationReady(associations:readonly BicycleAssociation[],identifier:number|undefined){
 const target=identifier===undefined?undefined:associations.find(a=>a.identifier===identifier);
 return !!target&&!(target.flags&1)&&target.amount>Math.fround(.99);
}
