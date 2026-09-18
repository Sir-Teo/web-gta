import {requireAsset} from '../assets/binary';
import type {ScmRestartPoint,ScmRestartPoints} from '../assets/scmRestartPoints';

/* CRestart port, pinned gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166,
 * Restart.cpp (`Initialise` 0x460630, `FindClosestHospitalRestartPoint`
 * 0x460850, `FindClosestPoliceRestartPoint` 0x460A50 and the override
 * helpers). Coordinates stay in native axes; the caller converts. */

export interface RestartResult {position:[number,number,number];heading:number}
/** `CTheZones::GetLevelFromPosition`: 0 is the countryside fallback. */
export const LEVEL_COUNTRYSIDE=0;

const distance=(a:readonly number[],b:readonly number[])=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const distance2D=(a:readonly number[],b:readonly number[])=>Math.hypot(a[0]-b[0],a[1]-b[1]);

export class NativeRestart {
 hospitals:ScmRestartPoint[]=[];
 police:ScmRestartPoint[]=[];
 /** OVERRIDE_NEXT_RESTART state: consumed by the next lookup of either kind. */
 overridePosition?:[number,number,number];overrideHeading=0;overrideActive=false;
 /** SET_RESPAWN_POINT_FOR_DURATION_OF_MISSION: replaces the query point once. */
 missionBasePoint?:[number,number,number];missionBaseActive=false;
 /** SET_EXTRA_HOSPITAL_RESTART_POINT / SET_EXTRA_POLICE_STATION_RESTART_POINT.
  * `Initialise` leaves both radii at zero, so a fresh game ignores them. */
 extraHospital={position:[0,0,0] as [number,number,number],heading:0,radius:0};
 extraPolice={position:[0,0,0] as [number,number,number],heading:0,radius:0};
 /** Both flags start true in `Initialise`; the wasted/busted sequence reads them. */
 fadeInAfterNextDeath=true;fadeInAfterNextArrest=true;
 constructor(points?:ScmRestartPoints){if(points)this.load(points);}
 load(points:ScmRestartPoints){
  requireAsset(points.hospitals.length>0&&points.police.length>0,'Restart tables are empty.');
  this.hospitals=[...points.hospitals];this.police=[...points.police];
 }
 /** CRestart::OverrideNextRestart (0x4607D0). */
 overrideNextRestart(position:[number,number,number],heading:number){this.overridePosition=[...position];this.overrideHeading=heading;this.overrideActive=true;}
 cancelOverrideRestart(){this.overrideActive=false;}
 setRespawnPointForDurationOfMission(position:[number,number,number]){this.missionBasePoint=[...position];this.missionBaseActive=true;}
 clearRespawnPointForDurationOfMission(){this.missionBaseActive=false;}
 /** Shared body of both lookups. The hospital routine tests the extra point
  * with `radius <= 0 || distance >= radius` before searching, and the police
  * routine with the inverted condition; both reduce to the same selection. */
 private find(table:readonly ScmRestartPoint[],extra:{position:[number,number,number];heading:number;radius:number},from:readonly [number,number,number],cityUnlocked:number,levelAt:(p:readonly [number,number,number])=>number,fallback:RestartResult):RestartResult{
  requireAsset(from.every(Number.isFinite),'Invalid restart query point.');
  requireAsset(Number.isFinite(cityUnlocked),'Invalid city-unlocked stat.');
  if(this.overrideActive){
   this.overrideActive=false;
   requireAsset(this.overridePosition,'Override restart without a position.');
   return {position:[...this.overridePosition!],heading:this.overrideHeading};
  }
  let point=from;
  if(this.missionBaseActive){this.missionBaseActive=false;requireAsset(this.missionBasePoint,'Mission respawn base without a position.');point=this.missionBasePoint!;}
  if(extra.radius>0&&distance2D(extra.position,point)<extra.radius)return {position:[...extra.position],heading:extra.heading};
  const level=levelAt(point);
  let closest=Number.POSITIVE_INFINITY,chosen:ScmRestartPoint|undefined;
  for(const candidate of table){
   if(cityUnlocked<candidate.townId)continue;
   let range=distance(candidate.position,point);
   // Points outside the query's city are pushed back sixfold, unless the
   // query is in the countryside, which restarts at any city.
   if(level!==LEVEL_COUNTRYSIDE&&level!==levelAt(candidate.position))range*=6;
   if(range<closest){closest=range;chosen=candidate;}
  }
  // The source leaves the caller's output untouched when nothing qualifies.
  return chosen?{position:[...chosen.position],heading:chosen.heading}:fallback;
 }
 /** CRestart::FindClosestHospitalRestartPoint (0x460850). */
 findClosestHospitalRestartPoint(from:readonly [number,number,number],cityUnlocked:number,levelAt:(p:readonly [number,number,number])=>number,fallback:RestartResult){
  return this.find(this.hospitals,this.extraHospital,from,cityUnlocked,levelAt,fallback);
 }
 /** CRestart::FindClosestPoliceRestartPoint (0x460A50). */
 findClosestPoliceRestartPoint(from:readonly [number,number,number],cityUnlocked:number,levelAt:(p:readonly [number,number,number])=>number,fallback:RestartResult){
  return this.find(this.police,this.extraPolice,from,cityUnlocked,levelAt,fallback);
 }
}
