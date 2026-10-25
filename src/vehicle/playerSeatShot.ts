import {OCCUPANT_HEAD_LIFT,occupantHeadHit,type V3} from './nativeDieInCar';
/** The player uses the same CheckForShootingVehicleOccupant head handoff as an NPC. A world/tyre hit in front of
 * his vehicle, or the shooter's own vehicle, cannot hand the ray to him. Body wrappers are compared by handle. */
export function playerSeatHeadHit(target:{body:{handle:number};head:V3;canBeShot:boolean}|undefined,from:V3,direction:V3,range:number,hitBody:unknown,own:unknown){
 if(!target||!target.canBeShot||(hitBody as {handle?:number}|undefined)?.handle!==target.body.handle)return undefined;
 const shooter=own as {handle?:number;car?:{body?:{handle:number}}}|undefined;
 if((shooter?.car?.body?.handle??shooter?.handle)===target.body.handle)return undefined;
 return occupantHeadHit(from,direction,[{x:target.head.x,y:target.head.y+OCCUPANT_HEAD_LIFT,z:target.head.z}],range);
}
