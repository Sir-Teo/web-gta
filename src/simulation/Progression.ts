import {WEAPONS} from '../weapons/catalog';
import {skillStatWeapon,type WeaponInventory} from '../weapons/Inventory';
import type {Simulation} from './Simulation';
export const ACTIVITIES=[{id:'walk',name:'Neighborhood explorer',description:'Walk 500 metres on foot.',target:500,reward:200},{id:'drive',name:'Street driver',description:'Drive one kilometre.',target:1000,reward:500},{id:'escape',name:'Lose the heat',description:'Escape a pursuit of two stars or more without being arrested or killed.',target:1,reward:300}] as const;
const KEY='web-gta.progress.v1';
const finite=(v:unknown,max:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max;
/** Session activities and a bounded, versioned local save. Location is deliberately not persisted. */
export class Progression {
 distances={walk:0,drive:0};completed=new Set<string>();
 /** Collected one-time pickups and collectables (CPickups states), by ScmPickup id. */
 readonly pickups=new Set<string>();
 /** CStuntJumpManager found/completed jumps, by ScmStuntJump id. */
 stuntJumpsFound=new Set<string>();stuntJumpsDone=new Set<string>();
 /** Where the last save point put the player (native x/y, browser height) and the clock it saved. */
 savedLocation?:{x:number;y:number;z:number;heading:number;timeMinutes:number};private peakWanted=0;private previous?:{x:number;y:number;z:number};private saveTime=0;
 onReward?:(name:string,reward:number)=>void;
 constructor(private inventory:WeaponInventory,private sim:Simulation,private storage?:Pick<Storage,'getItem'|'setItem'>){
  try{const raw=storage?.getItem(KEY);if(!raw||raw.length>32768)return;const data=JSON.parse(raw);if(data.version!==1)return;
   if(finite(data.money,999999999))sim.money=data.money;
   for(const mode of ['walk','drive'] as const)if(finite(data.distances?.[mode],1e9))this.distances[mode]=data.distances[mode];
   if(Array.isArray(data.completed))for(const id of data.completed)if(ACTIVITIES.some(a=>a.id===id))this.completed.add(id);
   if(Array.isArray(data.ammo))for(const row of data.ammo){if(!Array.isArray(row)||row.length!==3)continue;const w=WEAPONS.find(w=>w.id===row[0]);if(w&&finite(row[1],inventory.maxMagazine(w.id))&&finite(row[2],100000)&&Number.isInteger(row[1])&&Number.isInteger(row[2]))inventory.ammo.set(w.id,{clip:row[1],reserve:row[2]});}
   if(Array.isArray(data.practice))for(const row of data.practice)if(Array.isArray(row)&&WEAPONS.some(w=>w.id===row[0])&&finite(row[1],1000))inventory.practice.set(skillStatWeapon(row[0]),row[1]);
   if(Number.isInteger(data.selected))inventory.select(data.selected);
   if(Array.isArray(data.pickups))for(const id of data.pickups.slice(0,2000))if(typeof id==='string'&&id.length<=64)this.pickups.add(id);
   const saved=data.savedLocation;
   if(saved&&[saved.x,saved.y,saved.z,saved.heading,saved.timeMinutes].every(v=>typeof v==='number'&&Number.isFinite(v))&&Math.abs(saved.x)<4000&&Math.abs(saved.y)<4000&&saved.z>-200&&saved.z<2000&&saved.timeMinutes>=0&&saved.timeMinutes<1440)this.savedLocation={x:saved.x,y:saved.y,z:saved.z,heading:saved.heading,timeMinutes:saved.timeMinutes};
   for(const [key,set] of [['stuntJumpsFound',this.stuntJumpsFound],['stuntJumpsDone',this.stuntJumpsDone]] as const)if(Array.isArray(data[key]))for(const id of data[key].slice(0,256))if(typeof id==='string'&&id.length<=64)set.add(id);
  }catch{/* Disabled storage or invalid saves leave the playable defaults intact. */}
 }
 hit(id:number){const stat=skillStatWeapon(id);this.inventory.practice.set(stat,Math.min(1000,(this.inventory.practice.get(stat)??0)+5));}
 failEscape(){this.peakWanted=0;}
 private complete(id:string){if(this.completed.has(id))return;const activity=ACTIVITIES.find(a=>a.id===id)!;this.completed.add(id);this.sim.money+=activity.reward;this.onReward?.(activity.name,activity.reward);this.save();}
 tick(dt:number,driving:boolean,wanted:number,arrested:boolean){
  const p=this.sim.player.position;
  if(this.previous&&this.sim.player.health>0&&!arrested){const distance=Math.hypot(p.x-this.previous.x,p.y-this.previous.y,p.z-this.previous.z);if(distance<Math.max(1,dt*100)){if(driving)this.distances.drive+=distance;else if(this.sim.player.grounded)this.distances.walk+=distance;}}
  this.previous={...p};
  if(this.sim.player.health<=0||arrested)this.peakWanted=0;else{this.peakWanted=Math.max(this.peakWanted,wanted);if(!wanted&&this.peakWanted>=2){this.complete('escape');this.peakWanted=0;}}
  for(const a of ACTIVITIES)if(a.id!=='escape'&&this.distances[a.id]>=a.target)this.complete(a.id);
  this.saveTime+=dt;if(this.saveTime>=5){this.saveTime=0;this.save();}
 }
 snapshot(){return {distances:{...this.distances},completed:[...this.completed],practice:this.inventory.practice.get(skillStatWeapon(this.inventory.selected))??0,skill:this.inventory.snapshot().skill};}
 save(){try{this.storage?.setItem(KEY,JSON.stringify({version:1,money:this.sim.money,selected:this.inventory.selected,ammo:[...this.inventory.ammo].map(([id,a])=>[id,a.clip,a.reserve]),practice:[...this.inventory.practice],distances:this.distances,completed:[...this.completed],pickups:[...this.pickups],stuntJumpsFound:[...this.stuntJumpsFound],stuntJumpsDone:[...this.stuntJumpsDone],savedLocation:this.savedLocation}));return true;}catch{return false;}}
}
