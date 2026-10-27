import {WEAPONS} from '../weapons/catalog';
import {skillStatWeapon,type WeaponInventory} from '../weapons/Inventory';
import type {Simulation} from './Simulation';
import type {ScmStats} from '../engine/ScmGameState';
import {NativeZonesVisited} from '../world/nativeZonesVisited';
import {HIDEOUT_SLOT_COUNT,STORED_CARS_PER_GARAGE,readStoredCar,type StoredCar} from '../engine/ScmGarages';
/** The revision a stored save carries (0 for none, or one written before revisions). */
const storedRevision=(raw:string|null|undefined)=>{const m=raw?/"revision":(\d+)/.exec(raw):null;return m?Number(m[1]):0;};
const KEY='web-gta.progress.v1';
/** The largest save the loader reads, well above what its own caps allow (2000 pickups, 512 stunt jumps, 200 tags). A
 * save that would not fit is not written, so the last one the loader accepts stays. */
const MAX_SAVE_LENGTH=512*1024;
const finite=(v:unknown,max:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max;
/** The player's progress the game keeps between sessions, in a bounded, versioned local save: money, weapons and
 * their practice, driving/body/training stats, collected pickups, sprayed tags, stunt jumps, explored map squares, the cars in
 * the safehouse garages and the last save point. Saves from before the Activities were removed keep loading; their fields are ignored. */
export class Progression {
/** Driving skill stat (0–1000): weak ride set below 50, standard below 100, pro above.
 * CStats::UpdateStatsWhenDriving port: +1 per 25 m driven (≈2.5 km to pro), weak/std/pro ride sets switch at the native bands. */
 drivingSkill=0;
 /** CStats::Save/Load (PC 0x5D3B40/0x5D3BF0) store fat/stamina/muscle (21–23) as floats and lungs (225) as int.
  * This browser-save subset keeps their current values; native training counters are not serialized. */
 readonly trainingStats={stamina:100,lungCapacity:0,fat:0,muscle:0};
 /** Body fields belong to a loaded save, or to MAIN after its initial defaults have run. */
 private bodyStatsOwned=new Set<'fat'|'muscle'>();
 /** CTagManager::Save: sprayed tags' alphas by tag key. */
 tags:[string,number][]=[];
 /** Collected one-time pickups and collectables (CPickups states), by ScmPickup id. */
 readonly pickups=new Set<string>();
 /** CTheZones' explored map squares, saved as the original saves them. */
 readonly zones=new NativeZonesVisited();
 /** CStuntJumpManager found/completed jumps, by ScmStuntJump id. */
 stuntJumpsFound=new Set<string>();stuntJumpsDone=new Set<string>();
 /** CGarages::aCarsInSafeHouse, which CGarages::Save writes: the cars each safehouse garage keeps behind its door. */
 storedCars:(StoredCar|null)[][]=Array.from({length:HIDEOUT_SLOT_COUNT},()=>Array<StoredCar|null>(STORED_CARS_PER_GARAGE).fill(null));
 /** Where the last save point put the player (native x/y, browser height), the clock it saved and, inside, the
  * interior (CGame::currArea) and the doors taken into it (CEntryExitManager's stack, as pool indices). */
 savedLocation?:{x:number;y:number;z:number;heading:number;timeMinutes:number;weekDay?:number;area?:number;enexStack?:number[]};private previous?:{x:number;y:number;z:number};private saveTime=0;
 /** Whether stored progress was loaded (cash, weapons, stats or a save point), which New Game would throw away. */
 hadSave=false;
 /** The save's revision this tab last read or wrote; a write bumps it. */
 private revision=0;
 /** The text the next save would write if nothing has changed since the last one. */
 private lastWritten?:string;
 /** Another tab saved newer progress, so this one stopped saving. */
 conflict=false;
 /** `fresh`: a New Game whose old save could not be cleared: what is stored is not read, and the next save replaces it. */
 constructor(private inventory:WeaponInventory,private sim:Simulation,private storage?:Pick<Storage,'getItem'|'setItem'>,fresh=false){
  try{const raw=fresh?undefined:storage?.getItem(KEY);if(!raw||raw.length>MAX_SAVE_LENGTH)return;const data=JSON.parse(raw);if(data.version!==1)return;this.hadSave=true;if(Number.isSafeInteger(data.revision)&&data.revision>0)this.revision=data.revision;
   // CPlayerInfo::m_nMoney is signed: the HUD draws a debt as -$%07d.
   if(Number.isInteger(data.money)&&data.money>=-9999999&&data.money<=999999999)sim.money=data.money;
   if(finite(data.drivingSkill,1000))this.drivingSkill=data.drivingSkill;
   const training=data.trainingStats,lung=training?.lungCapacity;
   for(const field of ['stamina','fat','muscle'] as const){const value=training?.[field];if(typeof value==='number'&&Number.isFinite(value)&&Number.isFinite(Math.fround(value))){this.trainingStats[field]=Math.fround(value);if(field!=='stamina')this.bodyStatsOwned.add(field);}}
   if(Number.isInteger(lung)&&lung>=-2147483648&&lung<=2147483647)this.trainingStats.lungCapacity=lung;
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
   if(Array.isArray(data.storedCars))this.storedCars.forEach((slot,i)=>{const row=data.storedCars[i];if(Array.isArray(row))for(let k=0;k<STORED_CARS_PER_GARAGE;k++)slot[k]=readStoredCar(row[k])??null;});
  }catch{/* Disabled storage or invalid saves leave the playable defaults intact. */}
 }
 /** Share one value with SET/INCREMENT_STAT, natural training, breath/sprint capacity and body movement.
  * Binding itself neither awards a gain nor refills the player. */
 bindTrainingStats(stats:ScmStats,options:{deferBody?:boolean}={}){
  stats.bind(22,{get:()=>this.trainingStats.stamina,set:value=>{this.trainingStats.stamina=value;}});
  stats.bind(225,{get:()=>this.trainingStats.lungCapacity,set:value=>{this.trainingStats.lungCapacity=value;}});
  if(!options.deferBody)this.bindBodyStats(stats);
 }
 /** MAIN gives a fresh CJ fat 200 and muscle 50 after CStats::Init zeroes them.
  * Apply saved fields after that setup, or adopt its current values when those fields were absent. */
 bindBodyStats(stats:ScmStats){
  for(const [field,id] of [['fat',21],['muscle',23]] as const){
   if(!this.bodyStatsOwned.has(field)){this.trainingStats[field]=stats.get(id);this.bodyStatsOwned.add(field);}
   stats.bind(id,{get:()=>this.trainingStats[field],set:value=>{this.trainingStats[field]=value;}});
  }
 }
 private savedTrainingStats(){const {stamina,lungCapacity,fat,muscle}=this.trainingStats;return {stamina,lungCapacity,...(this.bodyStatsOwned.has('fat')?{fat}:{}),...(this.bodyStatsOwned.has('muscle')?{muscle}:{})};}
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
  this.saveTime+=dt;if(this.saveTime>=5){this.saveTime=0;this.autosave();}
 }
 snapshot(){return {practice:this.inventory.practice.get(skillStatWeapon(this.inventory.selected))??0,skill:this.inventory.snapshot().skill,drivingSkill:this.drivingSkill,tags:this.tags};}
 /** Told once when the periodic save starts failing (storage full, blocked, or the save too long), and again only
  * after one has succeeded since. */
 onSaveFailed?:(reason:'storage'|'conflict')=>void;
 private saveFailing=false;
 private autosave(){
  if(!this.storage)return;
  const ok=this.save();if(!ok&&!this.saveFailing)this.onSaveFailed?.(this.conflict?'conflict':'storage');this.saveFailing=!ok;
 }
 /** Whether the save was written: not without storage, not when it would be too long to load, not when the write fails. */
 save(){if(!this.storage)return false;try{const text=JSON.stringify({version:1,money:this.sim.money,selected:this.inventory.selected,fightingStyle:this.inventory.fightingStyle,allowedAttackMoves:this.inventory.allowedAttackMoves,ammo:this.inventory.ammoRows(),owned:[...this.inventory.owned],practice:[...this.inventory.practice],pickups:[...this.pickups],stuntJumpsFound:[...this.stuntJumpsFound],stuntJumpsDone:[...this.stuntJumpsDone],savedLocation:this.savedLocation,drivingSkill:this.drivingSkill,trainingStats:this.savedTrainingStats(),tags:this.tags,zonesVisited:this.zones.save(),storedCars:this.storedCars,revision:this.revision+1});if(text.length>MAX_SAVE_LENGTH)return false;
  // Nothing changed since the last write: the stored save is already this one.
  if(text===this.lastWritten)return true;
  // Another tab that has saved since this one loaded (a higher revision) is not overwritten with this tab's older state.
  if(storedRevision(this.storage.getItem(KEY))>this.revision){this.conflict=true;return false;}
  this.storage.setItem(KEY,text);this.revision++;this.lastWritten=JSON.stringify({...JSON.parse(text),revision:this.revision+1});return true;}catch{return false;}}
 /** The front end's New Game: the progress is gone, and nothing more is saved until the page loads the new game. */
 /** Whether the old save is gone; when it could not be cleared the caller starts the new game without reading it. */
 startNewGame(){let cleared=!this.storage;try{this.storage?.setItem(KEY,'');cleared=this.storage?.getItem(KEY)==='';}catch{cleared=false;}this.storage=undefined;return cleared;}
}
