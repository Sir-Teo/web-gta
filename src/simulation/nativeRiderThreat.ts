import {makeDecision,RELATIONSHIP,type DecisionMaker} from '../ped/nativeDecisionMaker';
/* A script's ped riding in a car sees a ped it hates, and its own decision maker answers with a drive-by.
 *
 * CPedAcquaintanceScanner (iOS 0x1003564f4) runs for a mission ped unless a script turned it off: the scanner's
 * m_bScanAllowedScriptPed is 1 from CPedIntelligence's ctor (iOS 0x10035aa7c). Every 500 ms, and 3000 ms after it
 * raised an event, it takes the 16 peds nearest within max(seeing, hearing) (CPedScanner), the front test waived for a
 * ped in a vehicle, and nearest first raises CEventAcquaintancePedHate on one of a type its m_acquaintance hates,
 * within 40 and in clear view; CEventAcquaintancePed::AffectsPed refuses one in its own group and the scan goes on.
 * While the ped answers that hate it does not scan.
 *
 * A ped in a group hands the event to the group's decision maker; TASK_GROUP_USE_MEMBER_DECISION (1510) gives it back
 * to the ped's own (TWAR7's group 146@ for OG Loc). CEventHandler::ComputePedThreatResponse (iOS 0x1002a11d8) answers
 * TASK_SIMPLE_GANG_DRIVEBY (case 1022, 0x1002a15d8) only for a PASSENGER on CTaskSimpleCarDrive holding an instant-hit
 * gun (gta-reversed has the driver test the wrong way round), with the threat nearer than
 * r = max(its target range, max(seeing, hearing) + 5): CTaskSimpleGangDriveBy(threat, none, r, 90, AI_ALL_DIRN). */
export const EVENT_ACQUAINTANCE_PED_HATE=36,TASK_SIMPLE_GANG_DRIVEBY=1022,TASK_GROUP_USE_MEMBER_DECISION=1510;
export const ACQUAINTANCE_SCAN_SECONDS=.5,ACQUAINTANCE_RAISED_SECONDS=3;
/** The front test's and line of sight's cap in CPed::OurPedCanSeeThisOne. */
export const ACQUAINTANCE_SIGHT_RANGE=40;
/** CPedScanner's slots. */
const SCANNED_PEDS=16;
/** CTaskSimpleGangDriveBy's frequency for the answer. */
export const THREAT_DRIVE_BY_FREQUENCY=90;
/** CPedIntelligence's seeing and hearing ranges as its ctor sets them (iOS 0x10035a944, 0x10035aae4): 15, or 40 for a
 * gang's ped type (7 to 16); SET_SENSE_RANGE (iOS 0x1001e952c) sets both. */
export function senseRange(pedType:number|undefined,set?:number){
 if(set!==undefined)return set;
 return pedType!==undefined&&pedType>=7&&pedType<=16?40:15;
}
/** The drive-by's abort range: the weapon's target range, or the sense range and 5 when that is more. */
export function threatDriveByRange(weaponTargetRange:number,sense:number){return Math.max(weaponTargetRange,sense+5);}
export interface HateCandidate {position:{x:number;y:number;z:number};pedType:number|undefined;sameGroup:boolean}
/** FindClosestAcquaintance's hate for a ped in a vehicle at `from`: the nearest hated, seen, not of its group. */
export function closestHated<C extends HateCandidate>(from:{x:number;y:number;z:number},hates:(pedType:number)=>boolean,candidates:readonly C[],sense:number,sees:(candidate:C)=>boolean):C|undefined{
 const scanned=candidates.map(candidate=>({candidate,distance:Math.hypot(candidate.position.x-from.x,candidate.position.y-from.y,candidate.position.z-from.z)}))
  .filter(c=>c.distance<=sense).sort((a,b)=>a.distance-b.distance).slice(0,SCANNED_PEDS);
 for(const {candidate,distance} of scanned){
  if(candidate.pedType===undefined||!hates(candidate.pedType)||candidate.sameGroup)continue;
  if(distance>ACQUAINTANCE_SIGHT_RANGE||!sees(candidate))continue;
  return candidate;
 }
 return undefined;
}
/** Whether the hate is answered with the drive-by: the group's decision maker (`group` undefined for a ped in no group)
 * passing it to the ped's own, which picks TASK_SIMPLE_GANG_DRIVEBY in a vehicle. */
export function answersHateWithDriveBy(group:{decisionMaker:DecisionMaker|undefined}|undefined,own:DecisionMaker|undefined,random:()=>number){
 if(group&&makeDecision(group.decisionMaker,EVENT_ACQUAINTANCE_PED_HATE,RELATIONSHIP.threat,true,random)!==TASK_GROUP_USE_MEMBER_DECISION)return false;
 return makeDecision(own,EVENT_ACQUAINTANCE_PED_HATE,RELATIONSHIP.threat,true,random)===TASK_SIMPLE_GANG_DRIVEBY;
}
