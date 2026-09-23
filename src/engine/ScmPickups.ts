import {requireAsset} from '../assets/binary';
import {PICKUP_TYPE} from '../assets/scmPickups';
/* The pickups a script places. `CPickups::GenerateNewOne` (0x456F20) is one of the routines the reference
 * still calls into the executable, so the slot allocation and merging behind it are not known; what is known,
 * and what src/assets/scmPickups.ts already reads the file with, is each command's operand layout and the
 * model and pickup type the commands without a model operand imply. This table holds those records so the
 * script can place, ask after and remove its pickups while it runs, rather than only being read statically. */
export interface ScmPickup {
 handle:number;model:number|string;type:number;ammo:number;
 position:{x:number;y:number;z:number};
 /** The money a protection pickup pays a day, and the price or label a property pickup carries. */
 moneyPerDay?:number;price?:number;text?:string;
 /** Taken for good: a one-time pickup the player has had. */
 collected:boolean;
 /** A place in CPickups::aPickUpsCollected, which HAS_PICKUP_BEEN_COLLECTED (IsPickUpPickedUp) reads and clears. */
 reported?:boolean;
}
/** PICKUP_ON_STREET and PICKUP_ON_STREET_SLOW come back after their regeneration time instead of going for good. */
const regenerates=(type:number)=>type===PICKUP_TYPE.onStreet||type===PICKUP_TYPE.onStreetSlow;
export class ScmPickups {
 private readonly pickups=new Map<number,ScmPickup>();
 private next=1;
 private uncollected=0;
 get count(){return this.pickups.size;}
 /** Records not yet collected, kept as they change: the host compares it every frame. */
 get uncollectedCount(){return this.uncollected;}
 get all():readonly ScmPickup[]{return [...this.pickups.values()];}
 /** The record a handle names, or nothing once it has been removed. */
 at(handle:number){return this.pickups.get(handle);}
 private create(model:number|string,type:number,position:{x:number;y:number;z:number},extra:Partial<ScmPickup>={}){
  requireAsset([position.x,position.y,position.z].every(Number.isFinite),'Invalid pickup position.');
  const handle=this.next++;
  this.pickups.set(handle,{handle,model,type,ammo:0,position:{...position},collected:false,...extra});this.uncollected++;
  return handle;
 }
 /** CREATE_PICKUP and CREATE_PICKUP_WITH_AMMO: the script names both the model and the type. */
 createPickup(model:number|string,type:number,position:{x:number;y:number;z:number},ammo=0){
  return this.create(model,type,position,{ammo});
 }
 /** CREATE_MONEY_PICKUP: the money type, with the amount it pays as its ammo, as the file reader reads it. */
 createMoneyPickup(position:{x:number;y:number;z:number},amount:number){
  return this.create('money',PICKUP_TYPE.money,position,{ammo:amount});
 }
 /** CREATE_PROTECTION_PICKUP: the asset revenue pickup, with its daily take and its limit. */
 createProtectionPickup(position:{x:number;y:number;z:number},revenueLimit:number,revenueRate:number){
  return this.create('bigdollar',PICKUP_TYPE.assetRevenue,position,{moneyPerDay:revenueRate,price:revenueLimit});
 }
 /** CREATE_LOCKED_PROPERTY_PICKUP and its for-sale twin, which carry the label the HUD shows. */
 createLockedPropertyPickup(position:{x:number;y:number;z:number},text:string){
  return this.create('property_locked',PICKUP_TYPE.propertyLocked,position,{text});
 }
 createForSalePropertyPickup(position:{x:number;y:number;z:number},price:number,text:string){
  return this.create('property_fsale',PICKUP_TYPE.propertyForSale,position,{price,text});
 }
 /** The three collectables, each a one-time pickup of its own model. */
 createSnapshotPickup(position:{x:number;y:number;z:number}){return this.create('camerapickup',PICKUP_TYPE.snapshot,position);}
 createHorseshoePickup(position:{x:number;y:number;z:number}){return this.create('cj_horse_Shoe',PICKUP_TYPE.once,position);}
 createOysterPickup(position:{x:number;y:number;z:number}){return this.create('CJ_OYSTER',PICKUP_TYPE.once,position);}
 /** HAS_PICKUP_BEEN_COLLECTED (handler unreversed; CPickups::IsPickUpPickedUp is its only reader): true once for each
  * time the player took it, the entry cleared as it is read. A handle that names nothing has not been collected. */
 hasBeenCollected(handle:number){const pickup=this.pickups.get(handle);if(!pickup?.reported)return false;pickup.reported=false;return true;}
 /** What a host calls when the player takes one (CPickups::AddToCollectedPickupsArray). A street pickup stays to
  * regenerate; any other is gone. */
 collect(handle:number){
  const pickup=this.pickups.get(handle);if(!pickup||pickup.collected)return;
  pickup.reported=true;
  if(!regenerates(pickup.type)){pickup.collected=true;this.uncollected--;}
 }
 /** REMOVE_PICKUP: the record goes, and its handle stops naming anything. */
 remove(handle:number){const pickup=this.pickups.get(handle);if(pickup&&!pickup.collected)this.uncollected--;this.pickups.delete(handle);}
 /** DOES_PICKUP_EXIST. */
 exists(handle:number){return this.pickups.has(handle);}
}
