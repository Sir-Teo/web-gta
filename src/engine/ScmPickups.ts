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
 collected:boolean;
}
export class ScmPickups {
 private readonly pickups=new Map<number,ScmPickup>();
 private next=1;
 get count(){return this.pickups.size;}
 get all():readonly ScmPickup[]{return [...this.pickups.values()];}
 /** The record a handle names, or nothing once it has been removed. */
 at(handle:number){return this.pickups.get(handle);}
 private create(model:number|string,type:number,position:{x:number;y:number;z:number},extra:Partial<ScmPickup>={}){
  requireAsset([position.x,position.y,position.z].every(Number.isFinite),'Invalid pickup position.');
  const handle=this.next++;
  this.pickups.set(handle,{handle,model,type,ammo:0,position:{...position},collected:false,...extra});
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
 /** HAS_PICKUP_BEEN_COLLECTED: a handle that names nothing has not been collected. */
 hasBeenCollected(handle:number){return !!this.pickups.get(handle)?.collected;}
 /** What a host calls when the player takes one. */
 collect(handle:number){const pickup=this.pickups.get(handle);if(pickup)pickup.collected=true;}
 /** REMOVE_PICKUP: the record goes, and its handle stops naming anything. */
 remove(handle:number){this.pickups.delete(handle);}
 /** DOES_PICKUP_EXIST. */
 exists(handle:number){return this.pickups.has(handle);}
}
