import {requireAsset} from '../assets/binary';
import type {ScmRestartPoint,ScmRestartPoints} from '../assets/scmRestartPoints';

/* CRestart port, pinned gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166,
 * Restart.cpp (`Initialise` 0x460630, `FindClosestHospitalRestartPoint`
 * 0x460850, `FindClosestPoliceRestartPoint` 0x460A50 and the override
 * helpers). Coordinates stay in native axes; the caller converts. */

export interface RestartResult {position:[number,number,number];heading:number}
/** `CTheZones::GetLevelFromPosition`: 0 is the countryside fallback. */
export const LEVEL_COUNTRYSIDE=0;
/** CRestart::MAX_RESTART_POINTS (Restart.h): ten hospital and ten police slots. */
export const MAX_RESTART_POINTS=10;

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
 /* Bumped when the table is loaded or a point is added or set. Nothing in CRestart carries this; the host reads
  * it to know the script has filled its table, which the game's respawn then shares. */
 revision=0;
 constructor(points?:ScmRestartPoints){if(points)this.load(points);}
 load(points:ScmRestartPoints){this.revision++;
  requireAsset(points.hospitals.length>0&&points.police.length>0,'Restart tables are empty.');
  this.hospitals=[...points.hospitals];this.police=[...points.police];
 }
 /** CRestart::AddHospitalRestartPoint (0x460730). The native tables hold ten entries each and the routine does
  * not check, so an eleventh would write over the statics that follow; the script adds eight and seven. */
 addHospitalRestartPoint(position:readonly [number,number,number],heading:number,townId:number){this.revision++;this.add(this.hospitals,position,heading,townId);}
 /** CRestart::AddPoliceRestartPoint (0x460780). */
 addPoliceRestartPoint(position:readonly [number,number,number],heading:number,townId:number){this.revision++;this.add(this.police,position,heading,townId);}
 private add(table:ScmRestartPoint[],position:readonly [number,number,number],heading:number,townId:number){
  requireAsset(position.every(Number.isFinite)&&Number.isFinite(heading),'Invalid restart point.');
  requireAsset(Number.isInteger(townId),'Invalid restart town identifier.');
  requireAsset(table.length<MAX_RESTART_POINTS,'Native restart-point capacity exceeded.');
  table.push({position:[position[0],position[1],position[2]],heading,townId});
 }
 /** SET_EXTRA_HOSPITAL_RESTART_POINT: the coordinates, radius and heading of CRestart's extra hospital point. A
  * radius of zero turns it off, which is how the script clears it. */
 setExtraHospitalRestartPoint(position:readonly [number,number,number],radius:number,heading:number){this.revision++;this.setExtra(this.extraHospital,position,radius,heading);}
 /** SET_EXTRA_POLICE_STATION_RESTART_POINT. */
 setExtraPoliceStationRestartPoint(position:readonly [number,number,number],radius:number,heading:number){this.revision++;this.setExtra(this.extraPolice,position,radius,heading);}
 private setExtra(extra:{position:[number,number,number];heading:number;radius:number},position:readonly [number,number,number],radius:number,heading:number){
  requireAsset(position.every(Number.isFinite)&&Number.isFinite(radius)&&Number.isFinite(heading),'Invalid extra restart point.');
  extra.position=[position[0],position[1],position[2]];extra.radius=radius;extra.heading=heading;
 }
 /** CRestart::OverrideNextRestart (0x4607D0). */
 overrideNextRestart(position:[number,number,number],heading:number){this.revision++;this.overridePosition=[...position];this.overrideHeading=heading;this.overrideActive=true;}
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
