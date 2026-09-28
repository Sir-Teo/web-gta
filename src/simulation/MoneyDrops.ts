import {Group} from 'three';
import {modelObject} from '../assets/ModelObjects';
import {openStaticWorld} from '../assets/staticWorldArchive';
import {ModelReadCache,readModel} from '../assets/readModel';

/* Cash dropped by dead pedestrians.
 * - CPed's constructor (Ped.cpp, reversed) gives each ped m_nMoneyCount: 400 with a 3% chance, 20–69 for the
 *   POPCYCLE_GROUP_BUSINESS and CASUAL_RICH models, otherwise 0–24.
 * - CPed::CreateDeadPedMoney (0x4590F0) drops nothing from cops, medics, firemen or peds in vehicles, and only more
 *   than 10. Its caller is a stub; the Vice City ancestor calls it as the ped dies (CPed::SetDead).
 * - CPickups::CreateSomeMoney (0x458970) splits the amount into min(amount / 20 + 1, 7) wads of amount / wads + 0–3,
 *   each 1.5 further along a random step from the last, 0.5 above the ground.
 * - CPickup::Update collects a wad for a living player on foot within √1.8 across the ground and 2 vertically.
 *   CPickups::GenerateNewOne is a stub; its Vice City ancestor times PICKUP_MONEY out after 30 s.
 * Positions here are the browser frame (y up). */

type V3={x:number;y:number;z:number};
export const MONEY_TIMEOUT_SECONDS=30;
const randInt=(random:()=>number)=>Math.floor(random()*0x10000);

/** CPed's constructor: m_nMoneyCount. */
export function pedMoneyCount(random:()=>number,rich:boolean){
 if(random()*100<3)return 400;
 return rich?randInt(random)%50+20:randInt(random)%25;
}
/** CPed::CreateDeadPedMoney: the amount to drop, or 0. A script's ped drops only money SET_CHAR_MONEY gave it. */
export function deadPedMoney(ped:{money:number;pedType?:string;officer?:boolean;inVehicle?:boolean;mission?:boolean;moneyByScript?:boolean}){
 if(ped.officer||/^(COP|MEDIC|FIREMAN)$/i.test(ped.pedType??''))return 0;
 if(ped.mission&&!ped.moneyByScript)return 0;
 if(ped.inVehicle)return 0;
 return ped.money>10?ped.money:0;
}
/** CPickups::CreateSomeMoney: wad positions (before grounding) and values. */
export function moneyWads(at:V3,amount:number,random:()=>number){
 const wads=Math.min(Math.trunc(amount/20)+1,7),perWad=Math.trunc(amount/wads),out:{position:V3;value:number}[]=[];
 const p={...at};
 for(let i=0;i<wads;i++){
  // Native x (browser x) takes the sine of one random angle, native y (browser −z) the cosine of another.
  p.x+=Math.sin(random()*Math.PI*2)*1.5;p.z-=Math.cos(random()*Math.PI*2)*1.5;
  out.push({position:{...p},value:perWad+randInt(random)%4});
 }
 return out;
}

interface Wad{value:number;position:V3;age:number;root?:Group;owner?:ReturnType<typeof modelObject>}
/** The dropped wads: the `Money` pickup model (dyn_cash), collected on foot. */
export class MoneyDrops{
 private wads:Wad[]=[];
 private asset?:Promise<{model:import('../assets/dff').DffModel;textures:import('../assets/modelTextures').ModelTexture[]}|undefined>;
 constructor(private scene:{add(o:Group):void},private base:string,private ground:(point:V3)=>number|undefined,private random:()=>number=Math.random){}
 private load(){
  return this.asset??=(async()=>{
   const source=await openStaticWorld(this.base),cache=new ModelReadCache(source.file,source.entries);
   const entry=source.entry('money.dff'),textureEntry=source.entry('dyn_cash.txd');
   if(!entry)return undefined;const read=await readModel({file:source.file,entry,textureEntry},cache);return {model:read.model,textures:read.textures};
  })().catch(()=>undefined);
 }
 /** CreateSomeMoney at a dead ped's position. Wads over no ground are lost, as the original's FindGroundZFor3DCoord miss. */
 drop(at:V3,amount:number){
  for(const wad of moneyWads(at,amount,this.random)){
   const ground=this.ground(wad.position);if(ground===undefined)continue;
   const item:Wad={value:wad.value,position:{...wad.position,y:ground+.5},age:0};this.wads.push(item);
   void this.load().then(asset=>{
    if(!asset||!this.wads.includes(item))return;
    const owner=modelObject(asset.model,asset.textures);owner.root.position.set(item.position.x,item.position.y,item.position.z);
    // CPickup::GiveUsAPickUpObject turns the object to −π/2.
    owner.root.rotation.y=-Math.PI/2;this.scene.add(owner.root);item.root=owner.root;item.owner=owner;
   });
  }
 }
 /** Times wads out and hands those in reach to the player; returns the cash collected this step. */
 step(dt:number,player:{position:V3;alive:boolean;onFoot:boolean}){
  let collected=0;
  for(let i=this.wads.length-1;i>=0;i--){
   const wad=this.wads[i];wad.age+=dt;
   // The pickup's model sits 0.5 above the ground; the ped position is one unit above the feet.
   const reach=player.alive&&player.onFoot&&Math.hypot(wad.position.x-player.position.x,wad.position.z-player.position.z)<Math.sqrt(1.8)&&Math.abs(player.position.y+1-wad.position.y)<2;
   if(reach)collected+=wad.value;
   if(reach||wad.age>MONEY_TIMEOUT_SECONDS){this.retire(wad);this.wads.splice(i,1);}
  }
  return collected;
 }
 /** CPickups::PassTime moves the wads' timeouts on: a minute of passed game time is a second. */
 passTime(minutes:number){for(const wad of this.wads)wad.age+=Math.max(0,minutes);}
 /** CPickups::RemoveUnnecessaryPickups: the PICKUP_MONEY wads inside the sphere go. */
 removeInSphere(at:V3,radius:number){
  for(let i=this.wads.length-1;i>=0;i--){const wad=this.wads[i];if(Math.hypot(wad.position.x-at.x,wad.position.y-at.y,wad.position.z-at.z)<=radius){this.retire(wad);this.wads.splice(i,1);}}
 }
 private retire(wad:Wad){wad.root?.removeFromParent();wad.owner?.dispose();}
 snapshot(){return this.wads.map(w=>({value:w.value,position:{...w.position},age:w.age}));}
 dispose(){for(const wad of this.wads)this.retire(wad);this.wads.length=0;}
}
