import {CHEATS} from './nativeCheats';
/** eCrimeType. */
export const CRIME={none:0,fireWeapon:1,damagedPed:2,damagedCop:3,damageCar:4,damageCopCar:5,carSteal:6,runRedLight:7,vehicleDamage:8,speeding:9,killPedWithCar:10,killCopPedWithCar:11,destroyHeli:12,setPedOnFire:13,setCopPedOnFire:14,setCarOnFire:15,destroyPlane:16,explosion:17,stabPed:18,stabCop:19,destroyVehicle:20,hitCar:21,aimGun:22} as const;
/** CWanted::ReportCrimeNow chaos multipliers; FIRE_WEAPON adds none. */
const CRIME_CHAOS:Record<number,number>={2:5,8:5,9:5,3:45,4:30,5:80,11:80,14:80,6:15,7:10,10:18,12:400,16:400,13:20,15:20,17:25,18:35,19:100,20:70,21:2,22:2};
/** CWanted::SetWantedLevel chaos for each star level. */
export const WANTED_CHAOS=[0,70,200,570,1220,2420,4620] as const;
/** CWanted::SetMaximumWantedLevel's chaos cap for each maximum. */
export const MAXIMUM_CHAOS=[0,115,365,875,1800,3500,6900] as const;
/** CVehicle::IsLawEnforcementVehicle model IDs. */
export const LAW_ENFORCEMENT_MODELS:ReadonlySet<number>=new Set([427,430,432,433,490,523,528,596,597,598,599,601]);
/** CCrime::FindImmediateDetectionRange. */
export function crimeDetectionRange(type:number){return type===CRIME.destroyHeli||type===CRIME.destroyPlane||type===CRIME.explosion?60:type===CRIME.destroyVehicle?30:14;}
interface QueuedCrime {type:number;id:string;start:number;reported:boolean;dontCare:boolean}
/** CWanted and CCrime::ReportCrime. Time is in milliseconds of simulation time. */
export class NativeWanted {
 chaos=0;level=0;maxCopsInPursuit=0;maxCopCarsInPursuit=0;chanceOnRoadBlock=0;multiplier=1;
 /** CWanted::m_bPoliceBackOff (SET_POLICE_IGNORE_PLAYER), m_bPoliceBackOffGarage and m_bEverybodyBackOff
  * (MakePlayerSafe, SET_EVERYONE_IGNORE_PLAYER). Any of them is PoliceBackOff(): no cops, cop cars, roadblocks or
  * helicopters are wanted, though crimes still count. */
 policeBackOff=false;policeBackOffGarage=false;everybodyBackOff=false;
 get backOff(){return this.policeBackOff||this.policeBackOffGarage||this.everybodyBackOff;}
 private storedBackOff=false;
 /** CWanted::MaximumWantedLevel and MaximumChaosLevel, the globals SET_MAX_WANTED_LEVEL sets (6 and 9200 at start). */
 maximumWantedLevel=6;maximumChaos=9200;lastLevelChange=0;
 /** CGangWars::GangWarFightingGoingOn, which zeroes the chaos a crime adds. */
 gangWarFighting:()=>boolean=()=>false;
 private crimes:(QueuedCrime|undefined)[]=Array(16).fill(undefined);
 private lastDecreased=0;private now=0;
 /** CWanted::UpdateWantedLevel. */
 updateWantedLevel(){
  this.chaos=Math.min(this.chaos,this.maximumChaos);const old=this.level;
  const rows:[number,number,number,number,number][]=[[4600,6,30,10,3],[2400,5,24,8,3],[1200,4,18,6,2],[550,3,12,4,2],[180,2,0,3,2],[50,1,0,1,1]];
  const row=rows.find(r=>this.chaos>=r[0]);
  [this.level,this.chanceOnRoadBlock,this.maxCopsInPursuit,this.maxCopCarsInPursuit]=row?[row[1],row[2],row[3],row[4]]:[0,0,0,0];
  if(old!==this.level)this.lastLevelChange=this.now;
  if(this.backOff){this.maxCopsInPursuit=0;this.maxCopCarsInPursuit=0;this.chanceOnRoadBlock=0;}
 }
 /** CWanted::SetMaximumWantedLevel (0x561E70). */
 setMaximumWantedLevel(level:number){this.maximumWantedLevel=level;this.maximumChaos=MAXIMUM_CHAOS[level];}
 /** CWanted::SetWantedLevel: clears the crime queue. */
 setWantedLevel(level:number){if(CHEATS.isActive('neverWanted'))return;this.crimes.fill(undefined);this.chaos=WANTED_CHAOS[Math.max(0,Math.min(this.maximumWantedLevel,Math.floor(level)))];this.updateWantedLevel();}
 /** CWanted::SetWantedLevelNoDrop. */
 setWantedLevelNoDrop(level:number){if(level>this.level)this.setWantedLevel(level);}
 /** CWanted::AddCrimeToQ with the GTA III/VC return value: true when the crime is new or not yet reported. */
 private addCrimeToQ(type:number,id:string,reported:boolean,dontCare:boolean){
  const existing=this.crimes.find(c=>c&&c.type===type&&c.id===id);
  if(existing){if(existing.reported)return false;existing.reported=reported;return true;}
  const free=this.crimes.findIndex(c=>!c);if(free<0)return false;
  this.crimes[free]={type,id,start:this.now,reported,dontCare};return true;
 }
 /** CWanted::ReportCrimeNow. */
 reportCrimeNow(type:number,dontCare:boolean){
  if(CHEATS.isActive('neverWanted'))return false;
  let mul=Math.max(this.multiplier,0);if(this.gangWarFighting())mul=0;if(dontCare)mul/=3;mul*=CRIME_CHAOS[type]??1;
  const before=this.level;
  if(type!==CRIME.none&&type!==CRIME.fireWeapon)this.chaos+=Math.trunc(mul);
  this.updateWantedLevel();return this.level>before;
 }
 /** CCrime::ReportCrime for a player crime. `presence(radius)` is CWanted::WorkOutPolicePresence around the player. */
 reportCrime(type:number,victim:string|undefined,presence:(radius:number)=>number,dontCare=false){
  if(type===CRIME.none)return;
  if(victim!==undefined&&this.multiplier>=0){
   if(presence(crimeDetectionRange(type))){if(this.addCrimeToQ(type,victim,true,dontCare))this.reportCrimeNow(type,dontCare);this.setWantedLevelNoDrop(1);}
   else this.addCrimeToQ(type,victim,false,dontCare);
  }
  if(type===CRIME.damagedCop)this.setWantedLevelNoDrop(1);
  if(type===CRIME.damageCopCar||type===CRIME.stabCop)this.setWantedLevelNoDrop(2);
 }
 /** CWanted::RegisterCrime from CEventDamage::ReportCriminalEvent: queued without a witness check. */
 registerCrime(type:number,victim:string,dontCare=false){this.addCrimeToQ(type,victim,false,dontCare);}
 /** CWanted::Update once per step. `policeWithin18` is WorkOutPolicePresence(player, 18); `elusive` is the default/desert
  * weather region or an interior; `elusiveVehicle` is a law vehicle, helicopter or plane. */
 update(dt:number,policeWithin18:boolean,elusive:boolean,elusiveVehicle:boolean){
  this.now+=dt*1000;
  if(this.storedBackOff!==this.backOff){this.storedBackOff=this.backOff;this.updateWantedLevel();}
  if(this.now-this.lastDecreased<=1000)return;
  if(this.level>1&&elusive&&elusiveVehicle)this.lastDecreased=this.now;
  else if(!policeWithin18){this.lastDecreased=this.now;this.chaos=Math.max(0,this.chaos-(elusive?2:1));this.updateWantedLevel();}
  // CWanted::UpdateCrimesQ.
  for(let i=0;i<this.crimes.length;i++){
   const crime=this.crimes[i];if(!crime)continue;
   if(this.now-crime.start>500&&!crime.reported){this.reportCrimeNow(crime.type,crime.dontCare);crime.reported=true;}
   if(this.now>crime.start+10000)this.crimes[i]=undefined;
  }
 }
 /** CWanted::NumOfHelisRequired. */
 get helisRequired(){return this.backOff||this.level<=2?0:this.level===3?1:2;}
 snapshot(){return {chaos:this.chaos,level:this.level,maxCopsInPursuit:this.maxCopsInPursuit,maxCopCarsInPursuit:this.maxCopCarsInPursuit,chanceOnRoadBlock:this.chanceOnRoadBlock,queued:this.crimes.filter(Boolean).length};}
}
