import {WEAPONS} from '../weapons/catalog';
import {skillStatWeapon,type WeaponInventory} from '../weapons/Inventory';
import type {Simulation} from './Simulation';
export const ACTIVITIES=[{id:'walk',name:'Neighborhood explorer',description:'Walk 500 metres on foot.',target:500,reward:200},{id:'drive',name:'Street driver',description:'Drive one kilometre.',target:1000,reward:500},{id:'escape',name:'Lose the heat',description:'Escape a pursuit of two stars or more without being arrested or killed.',target:1,reward:300}] as const;
const KEY='web-gta.progress.v1';
const finite=(v:unknown,max:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max;
/** Session activities and a bounded, versioned local save. Location is deliberately not persisted. */
export class Progression {
 distances={walk:0,drive:0};completed=new Set<string>();
/** Driving skill stat (0–1000): weak ride set below 50, standard below 100, pro above.
 * CStats::UpdateStatsWhenDriving port: +1 per 25 m driven (≈2.5 km to pro), weak/std/pro ride sets switch at the native bands. */
 drivingSkill=0;
 /** CTagManager::Save: sprayed tags' alphas by tag key. */
 tags:[string,number][]=[];
 /** Collected one-time pickups and collectables (CPickups states), by ScmPickup id. */
 readonly pickups=new Set<string>();
 /** CStuntJumpManager found/completed jumps, by ScmStuntJump id. */
 stuntJumpsFound=new Set<string>();stuntJumpsDone=new Set<string>();
 /** Where the last save point put the player (native x/y, browser height) and the clock it saved. */
 savedLocation?:{x:number;y:number;z:number;heading:number;timeMinutes:number;weekDay?:number};private peakWanted=0;private previous?:{x:number;y:number;z:number};private saveTime=0;
 onReward?:(name:string,reward:number)=>void;
 constructor(private inventory:WeaponInventory,private sim:Simulation,private storage?:Pick<Storage,'getItem'|'setItem'>){
  try{const raw=storage?.getItem(KEY);if(!raw||raw.length>32768)return;const data=JSON.parse(raw);if(data.version!==1)return;
   if(finite(data.money,999999999))sim.money=data.money;
   for(const mode of ['walk','drive'] as const)if(finite(data.distances?.[mode],1e9))this.distances[mode]=data.distances[mode];
   if(Array.isArray(data.completed))for(const id of data.completed)if(ACTIVITIES.some(a=>a.id===id))this.completed.add(id);
   if(finite(data.drivingSkill,1000))this.drivingSkill=data.drivingSkill;
   if(Array.isArray(data.ammo))for(const row of data.ammo){if(!Array.isArray(row)||row.length!==3)continue;const w=WEAPONS.find(w=>w.id===row[0]);if(w&&finite(row[1],inventory.maxMagazine(w.id))&&finite(row[2],100000)&&Number.isInteger(row[1])&&Number.isInteger(row[2]))inventory.ammo.set(w.id,{clip:row[1],reserve:row[2]});}
   if(Array.isArray(data.practice))for(const row of data.practice)if(Array.isArray(row)&&WEAPONS.some(w=>w.id===row[0])&&finite(row[1],1000))inventory.practice.set(skillStatWeapon(row[0]),row[1]);
   if(Number.isInteger(data.selected))inventory.select(data.selected);
   if(Array.isArray(data.pickups))for(const id of data.pickups.slice(0,2000))if(typeof id==='string'&&id.length<=64)this.pickups.add(id);
   if(Array.isArray(data.tags))this.tags=data.tags.slice(0,200).filter((t:unknown)=>Array.isArray(t)&&typeof t[0]==='string'&&t[0].length<=64&&finite(t[1],255)&&Number.isInteger(t[1]));
   const saved=data.savedLocation;
   if(saved&&[saved.x,saved.y,saved.z,saved.heading,saved.timeMinutes].every(v=>typeof v==='number'&&Number.isFinite(v))&&Math.abs(saved.x)<4000&&Math.abs(saved.y)<4000&&saved.z>-200&&saved.z<2000&&saved.timeMinutes>=0&&saved.timeMinutes<1440)this.savedLocation={x:saved.x,y:saved.y,z:saved.z,heading:saved.heading,timeMinutes:saved.timeMinutes,weekDay:Number.isInteger(saved.weekDay)&&saved.weekDay>=1&&saved.weekDay<=7?saved.weekDay:undefined};
   for(const [key,set] of [['stuntJumpsFound',this.stuntJumpsFound],['stuntJumpsDone',this.stuntJumpsDone]] as const)if(Array.isArray(data[key]))for(const id of data[key].slice(0,256))if(typeof id==='string'&&id.length<=64)set.add(id);
   if(Array.isArray(data.missions))for(const id of data.missions){const m=this.missions.find(m=>m.id===id);if(m)m.done=true;}
  }catch{/* Disabled storage or invalid saves leave the playable defaults intact. */}
 }
 /** AR_STATS.DAT's STAT_INC_*_SKILL increment per weapon type, once loaded. */
 skillIncrements?:ReadonlyMap<number,number>;
 /** A hit that trains the weapon: CWeapon::DoBulletImpact calls UpdateStatsWhenWeaponHit only for the types with skill
  * stats (22-32). That routine is a retail stub; the port adds AR_STATS.DAT's increment for the weapon each hit (5
  * before the file has loaded). */
 hit(id:number){
  this.missionHits++;
  if(id<22||id>32)return;
  const stat=skillStatWeapon(id);this.inventory.practice.set(stat,Math.min(1000,(this.inventory.practice.get(stat)??0)+(this.skillIncrements?.get(id)??5)));
 }
 failEscape(){this.peakWanted=0;}
 private complete(id:string){if(this.completed.has(id))return;const activity=ACTIVITIES.find(a=>a.id===id)!;this.completed.add(id);this.sim.money+=activity.reward;this.onReward?.(activity.name,activity.reward);this.save();}
  tick(dt:number,driving:boolean,wanted:number,arrested:boolean){
   const p=this.sim.player.position;
   if(this.previous&&this.sim.player.health>0&&!arrested){const distance=Math.hypot(p.x-this.previous.x,p.y-this.previous.y,p.z-this.previous.z);if(distance<Math.max(1,dt*100)){if(driving){this.distances.drive+=distance;this.drivingSkill=Math.min(1000,this.drivingSkill+distance/25);}else if(this.sim.player.grounded)this.distances.walk+=distance;}}
  this.previous={...p};
  if(this.sim.player.health<=0||arrested)this.peakWanted=0;else{this.peakWanted=Math.max(this.peakWanted,wanted);if(!wanted&&this.peakWanted>=2){this.complete('escape');this.peakWanted=0;}}
  for(const a of ACTIVITIES)if(a.id!=='escape'&&this.distances[a.id]>=a.target)this.complete(a.id);
  this.missionUpdate();
  this.saveTime+=dt;if(this.saveTime>=5){this.saveTime=0;this.save();}
 }
 snapshot(){return {distances:{...this.distances},completed:[...this.completed],practice:this.inventory.practice.get(skillStatWeapon(this.inventory.selected))??0,skill:this.inventory.snapshot().skill,drivingSkill:this.drivingSkill,tags:this.tags,missions:this.missions.map(m=>({id:m.id,name:m.name,description:m.description,done:m.done})),currentMission:this.currentMission()?.id??null,missionProgress:this.missionProgress()??null,saveSlots:this.slots.map((s,i)=>({slot:i,has:!!s}))};}
 save(){try{this.storage?.setItem(KEY,JSON.stringify({version:1,money:this.sim.money,selected:this.inventory.selected,ammo:[...this.inventory.ammo].map(([id,a])=>[id,a.clip,a.reserve]),practice:[...this.inventory.practice],distances:this.distances,completed:[...this.completed],pickups:[...this.pickups],stuntJumpsFound:[...this.stuntJumpsFound],stuntJumpsDone:[...this.stuntJumpsDone],savedLocation:this.savedLocation,drivingSkill:this.drivingSkill,missions:this.missions.filter(m=>m.done).map(m=>m.id)}));return true;}catch{return false;}}
 /** Interior save points plus the save menu: three slots with location, clock and cash. */
 slots:(null|{x:number;y:number;z:number;heading:number;timeMinutes:number;money:number})[]=[null,null,null];
 saveToSlot(slot:number){
  const p=this.sim.player;
  this.slots[slot]={x:p.position.x,y:p.position.y,z:p.position.z,heading:p.heading,timeMinutes:this.sim.timeMinutes,money:this.sim.money};
  this.savedLocation={x:p.position.x,y:p.position.y,z:p.position.z,heading:p.heading,timeMinutes:this.sim.timeMinutes};
  this.save();return true;
 }
 loadFromSlot(slot:number){
  const s=this.slots[slot];if(!s)return false;
  this.sim.respawn={x:s.x,y:s.y,z:s.z};this.sim.money=s.money;this.sim.timeMinutes=s.timeMinutes;
  return true;
 }
 /** Story missions (MAIN script threads): sequential chain with reach, kill,
  * drive, hit and collect objectives. Later threads unlock as earlier ones
  * complete; progress persists through the completed ids and counters. */
 missions:{id:string;name:string;description:string;target:{x:number;z:number;radius:number};reward:number;done:boolean;kills?:{gangs:number[];count:number};drive?:number;hits?:number;collect?:number}[]=[
  {id:'grove-intro',name:'Grove Street introduction',description:'Meet the homie at the Grove cul-de-sac marker.',target:{x:8,z:-25,radius:6},reward:200,done:false},
  {id:'grove-defense',name:'Grove defense',description:'Take out 3 Ballas or Vagos attackers.',target:{x:8,z:-25,radius:30},reward:350,done:false,kills:{gangs:[0,2],count:3}},
  {id:'wheelman',name:'Wheelman',description:'Drive 1.5 km for the crew.',target:{x:8,z:-25,radius:60},reward:400,done:false,drive:1500},
  {id:'marksman',name:'Marksman',description:'Land 15 hits with any weapon.',target:{x:8,z:-25,radius:60},reward:400,done:false,hits:15},
  {id:'collector',name:'Collector',description:'Pick up 5 horseshoes, oysters or snapshots.',target:{x:8,z:-25,radius:60},reward:500,done:false,collect:5},
 ];
 /** Per-mission progress counters (kills, drive base, hits, collectables). */
 private missionKills=0;private missionDriveBase=0;private missionHits=0;private missionCollect=0;
 /** The first unfinished mission in the chain (undefined when complete). */
 currentMission(){return this.missions.find(m=>!m.done);}
 recordKill(gang?:number){
  const m=this.currentMission();
  if(m?.kills&&this.reached(m)&&(gang===undefined||m.kills.gangs.includes(gang)))this.missionKills++;
 }
 recordCollect(category:string){
  if(!['horseshoe','oyster','snapshot'].includes(category))return;
  if(this.currentMission()?.collect)this.missionCollect++;
 }
 private reached(m:{target:{x:number;z:number;radius:number}}){
  const p=this.sim.player.position;
  return Math.hypot(p.x-m.target.x,p.z-m.target.z)<m.target.radius;
 }
 missionUpdate(){
  const m=this.currentMission();if(!m)return;
  if(m.kills&&this.reached(m)&&this.missionKills>=m.kills.count)this.completeMission(m);
  else if(m.drive!==undefined&&this.reached(m)&&this.distances.drive-this.missionDriveBase>=m.drive)this.completeMission(m);
  else if(m.hits!==undefined&&this.reached(m)&&this.missionHits>=m.hits)this.completeMission(m);
  else if(m.collect!==undefined&&this.reached(m)&&this.missionCollect>=m.collect)this.completeMission(m);
  else if(!m.kills&&m.drive===undefined&&m.hits===undefined&&m.collect===undefined&&this.reached(m))this.completeMission(m);
 }
 private completeMission(m:{id:string;name:string;reward:number;done:boolean}){
  m.done=true;this.sim.money+=m.reward;this.onReward?.(m.name,m.reward);
  this.missionKills=0;this.missionDriveBase=this.distances.drive;this.missionHits=0;this.missionCollect=0;
  this.save();
 }
 missionProgress(){
  const m=this.currentMission();
  if(!m)return undefined;
  if(m.kills)return {done:this.missionKills,total:m.kills.count};
  if(m.drive!==undefined)return {done:Math.floor(this.distances.drive-this.missionDriveBase),total:m.drive};
  if(m.hits!==undefined)return {done:this.missionHits,total:m.hits};
  if(m.collect!==undefined)return {done:this.missionCollect,total:m.collect};
  return {done:this.reached(m)?1:0,total:1};
 }
}