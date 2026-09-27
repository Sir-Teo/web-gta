import {WEAPONS} from '../weapons/catalog';
import {skillStatWeapon,type WeaponInventory} from '../weapons/Inventory';
import type {Simulation} from './Simulation';
import {NativeZonesVisited} from '../world/nativeZonesVisited';
const KEY='web-gta.progress.v1';
/** The largest save the loader reads, well above what its own caps allow (2000 pickups, 512 stunt jumps, 200 tags). A
 * save that would not fit is not written, so the last one the loader accepts stays. */
const MAX_SAVE_LENGTH=512*1024;
const finite=(v:unknown,max:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max;
/** The player's progress the game keeps between sessions, in a bounded, versioned local save: money, weapons and
 * their practice, driving skill, collected pickups, sprayed tags, stunt jumps, explored map squares and the last
 * save point. Saves from before the Activities were removed keep loading; their fields are ignored. */
export class Progression {
/** Driving skill stat (0–1000): weak ride set below 50, standard below 100, pro above.
 * CStats::UpdateStatsWhenDriving port: +1 per 25 m driven (≈2.5 km to pro), weak/std/pro ride sets switch at the native bands. */
 drivingSkill=0;
 /** CTagManager::Save: sprayed tags' alphas by tag key. */
 tags:[string,number][]=[];
 /** Collected one-time pickups and collectables (CPickups states), by ScmPickup id. */
 readonly pickups=new Set<string>();
 /** CTheZones' explored map squares, saved as the original saves them. */
 readonly zones=new NativeZonesVisited();
 /** CStuntJumpManager found/completed jumps, by ScmStuntJump id. */
 stuntJumpsFound=new Set<string>();stuntJumpsDone=new Set<string>();
 /** Where the last save point put the player (native x/y, browser height), the clock it saved and, inside, the
  * interior (CGame::currArea) and the doors taken into it (CEntryExitManager's stack, as pool indices). */
 savedLocation?:{x:number;y:number;z:number;heading:number;timeMinutes:number;weekDay?:number;area?:number;enexStack?:number[]};private previous?:{x:number;y:number;z:number};private saveTime=0;
 /** `fresh`: a New Game whose old save could not be cleared: what is stored is not read, and the next save replaces it. */
 constructor(private inventory:WeaponInventory,private sim:Simulation,private storage?:Pick<Storage,'getItem'|'setItem'>,fresh=false){
  try{const raw=fresh?undefined:storage?.getItem(KEY);if(!raw||raw.length>MAX_SAVE_LENGTH)return;const data=JSON.parse(raw);if(data.version!==1)return;
   // CPlayerInfo::m_nMoney is signed: the HUD draws a debt as -$%07d.
   if(Number.isInteger(data.money)&&data.money>=-9999999&&data.money<=999999999)sim.money=data.money;
   if(finite(data.drivingSkill,1000))this.drivingSkill=data.drivingSkill;
   // The clip is checked against the magazines once WEAPON.DAT has loaded (the inventory holds the rows until then).
   if(Array.isArray(data.ammo))inventory.restoreAmmo(data.ammo.filter((row:unknown):row is [number,number,number]=>Array.isArray(row)&&row.length===3&&WEAPONS.some(w=>w.id===row[0])&&finite(row[1],1000)&&finite(row[2],100000)&&Number.isInteger(row[1])&&Number.isInteger(row[2])));
   // The weapons held; saves from before the slot model keep the whole arsenal.
   if(Array.isArray(data.owned)){inventory.owned.clear();inventory.owned.add(0);for(const id of data.owned)if(WEAPONS.some(w=>w.id===id))inventory.owned.add(id);}
   if(Array.isArray(data.practice))for(const row of data.practice)if(Array.isArray(row)&&WEAPONS.some(w=>w.id===row[0])&&finite(row[1],1000))inventory.practice.set(skillStatWeapon(row[0]),row[1]);
   if(Number.isInteger(data.selected))inventory.select(data.selected);
   if(Number.isInteger(data.fightingStyle)&&data.fightingStyle>=4&&data.fightingStyle<=16)inventory.fightingStyle=data.fightingStyle;
   if(Number.isInteger(data.allowedAttackMoves)&&data.allowedAttackMoves>=0&&data.allowedAttackMoves<=15)inventory.allowedAttackMoves=data.allowedAttackMoves;
   if(Array.isArray(data.pickups))for(const id of data.pickups.slice(0,2000))if(typeof id==='string'&&id.length<=64)this.pickups.add(id);
   this.zones.load(data.zonesVisited);
   if(Array.isArray(data.tags))this.tags=data.tags.slice(0,200).filter((t:unknown)=>Array.isArray(t)&&typeof t[0]==='string'&&t[0].length<=64&&finite(t[1],255)&&Number.isInteger(t[1]));
   const saved=data.savedLocation;
   if(saved&&[saved.x,saved.y,saved.z,saved.heading,saved.timeMinutes].every(v=>typeof v==='number'&&Number.isFinite(v))&&Math.abs(saved.x)<4000&&Math.abs(saved.y)<4000&&saved.z>-200&&saved.z<2000&&saved.timeMinutes>=0&&saved.timeMinutes<1440)this.savedLocation={x:saved.x,y:saved.y,z:saved.z,heading:saved.heading,timeMinutes:saved.timeMinutes,weekDay:Number.isInteger(saved.weekDay)&&saved.weekDay>=1&&saved.weekDay<=7?saved.weekDay:undefined,
    ...(Number.isInteger(saved.area)&&saved.area>0&&saved.area<=18?{area:saved.area,enexStack:Array.isArray(saved.enexStack)?saved.enexStack.slice(0,8).filter((i:unknown)=>Number.isInteger(i)&&(i as number)>=0&&(i as number)<400):[]}:{})};
   for(const [key,set] of [['stuntJumpsFound',this.stuntJumpsFound],['stuntJumpsDone',this.stuntJumpsDone]] as const)if(Array.isArray(data[key]))for(const id of data[key].slice(0,256))if(typeof id==='string'&&id.length<=64)set.add(id);
  }catch{/* Disabled storage or invalid saves leave the playable defaults intact. */}
 }
 /** AR_STATS.DAT's STAT_INC_*_SKILL increment per weapon type, once loaded. */
 skillIncrements?:ReadonlyMap<number,number>;
 /** A hit that trains the weapon: CWeapon::DoBulletImpact calls UpdateStatsWhenWeaponHit only for the types with skill
  * stats (22-32). That routine is a retail stub; the port adds AR_STATS.DAT's increment for the weapon each hit (5
  * before the file has loaded). */
 hit(id:number){
  if(id<22||id>32)return;
  const stat=skillStatWeapon(id);this.inventory.practice.set(stat,Math.min(1000,(this.inventory.practice.get(stat)??0)+(this.skillIncrements?.get(id)??5)));
 }
 /** A step of play: CStats::UpdateStatsWhenDriving's driving skill from the distance driven (a jump longer than the
  * step could cover is a teleport and counts nothing), and the save every 5 s. */
 tick(dt:number,driving:boolean,arrested:boolean){
  const p=this.sim.player.position;
  if(driving&&this.previous&&this.sim.player.health>0&&!arrested){const distance=Math.hypot(p.x-this.previous.x,p.y-this.previous.y,p.z-this.previous.z);if(distance<Math.max(1,dt*100))this.drivingSkill=Math.min(1000,this.drivingSkill+distance/25);}
  this.previous={...p};
  this.saveTime+=dt;if(this.saveTime>=5){this.saveTime=0;this.save();}
 }
 snapshot(){return {practice:this.inventory.practice.get(skillStatWeapon(this.inventory.selected))??0,skill:this.inventory.snapshot().skill,drivingSkill:this.drivingSkill,tags:this.tags,saveSlots:this.slots.map((s,i)=>({slot:i,has:!!s}))};}
 /** Whether the save was written: not without storage, not when it would be too long to load, not when the write fails. */
 save(){if(!this.storage)return false;try{const text=JSON.stringify({version:1,money:this.sim.money,selected:this.inventory.selected,fightingStyle:this.inventory.fightingStyle,allowedAttackMoves:this.inventory.allowedAttackMoves,ammo:this.inventory.ammoRows(),owned:[...this.inventory.owned],practice:[...this.inventory.practice],pickups:[...this.pickups],stuntJumpsFound:[...this.stuntJumpsFound],stuntJumpsDone:[...this.stuntJumpsDone],savedLocation:this.savedLocation,drivingSkill:this.drivingSkill,tags:this.tags,zonesVisited:this.zones.save()});if(text.length>MAX_SAVE_LENGTH)return false;this.storage.setItem(KEY,text);return true;}catch{return false;}}
 /** The front end's New Game: the progress is gone, and nothing more is saved until the page loads the new game. */
 /** Whether the old save is gone; when it could not be cleared the caller starts the new game without reading it. */
 startNewGame(){let cleared=!this.storage;try{this.storage?.setItem(KEY,'');cleared=this.storage?.getItem(KEY)==='';}catch{cleared=false;}this.storage=undefined;return cleared;}
 /** Interior save points plus the save menu: three slots with location, clock and cash. */
 slots:(null|{x:number;y:number;z:number;heading:number;timeMinutes:number;money:number})[]=[null,null,null];
 saveToSlot(slot:number){
  const p=this.sim.player;
  this.slots[slot]={x:p.position.x,y:p.position.y,z:p.position.z,heading:p.heading,timeMinutes:this.sim.timeMinutes,money:this.sim.money};
  this.savedLocation={x:p.position.x,y:p.position.y,z:p.position.z,heading:p.heading,timeMinutes:this.sim.timeMinutes};
  return this.save();
 }
 loadFromSlot(slot:number){
  const s=this.slots[slot];if(!s)return false;
  this.sim.respawn={x:s.x,y:s.y,z:s.z};this.sim.money=s.money;this.sim.timeMinutes=s.timeMinutes;
  return true;
 }
}
