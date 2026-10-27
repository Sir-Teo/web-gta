import {OCCUPANT_HEAD_LIFT,occupantHeadHit,type V3} from './nativeDieInCar';
import {pedSphereHit,type PedHitSphere} from '../combat/nativePedHitSpheres';
const ownBody=(own:unknown)=>{const shooter=own as {handle?:number;car?:{body?:{handle:number}}}|undefined;return shooter?.car?.body?.handle??shooter?.handle;};
/** The player uses the same CheckForShootingVehicleOccupant head handoff as an NPC. A world/tyre hit in front of
 * his vehicle, or the shooter's own vehicle, cannot hand the ray to him. Body wrappers are compared by handle. */
export function playerSeatHeadHit(target:{body:{handle:number};head:V3;canBeShot:boolean}|undefined,from:V3,direction:V3,range:number,hitBody:unknown,own:unknown){
 if(!target||!target.canBeShot||(hitBody as {handle?:number}|undefined)?.handle!==target.body.handle)return undefined;
 if(ownBody(own)===target.body.handle)return undefined;
 return occupantHeadHit(from,direction,[{x:target.head.x,y:target.head.y+OCCUPANT_HEAD_LIFT,z:target.head.z}],range);
}
/** CWorld's direct biker collision reaches CJ's current animated body before the first world/tyre hit. The host
 * supplies this model only for its existing motorcycle/bicycle rider class; ordinary cars need the head handoff. */
export function playerBikeHit(target:{body:{handle:number};canBeShot:boolean;spheres:()=>readonly PedHitSphere[]}|undefined,from:V3,direction:V3,range:number,own:unknown){
 if(!target||!target.canBeShot||ownBody(own)===target.body.handle)return undefined;
 return pedSphereHit(from,direction,range,target.spheres());
}
