import {TASK,RELATIONSHIP,makeDecision,type DecisionChoice,type DecisionMaker,type Relationship} from '../ped/nativeDecisionMaker';
/* CEventVehicleDamageCollision (event 73) as the default decision makers answer it, from data/decision/allowed
 * (GangMbr, Cop, R_Norm, R_Tough, R_Weak.ped; read with CDecisionMakerTypesFileLoader::LoadDecisionMaker's layout).
 * Every choice is an in-vehicle one; chances are by the source's relationship: friend, threat, player, neutral. */
const row=(task:number,chances:readonly [number,number,number,number]):DecisionChoice=>({task,chances,inVehicle:true,onFoot:false});
export const VEHICLE_DAMAGE_COLLISION_EVENT=73;
/** Indexed by pedstats' default decision maker: 0 gang member, 1 cop, 2 normal, 3 tough, 4 weak. */
export const COLLISION_DECISION_ROWS:readonly (readonly DecisionChoice[])[]=[
 [row(TASK.informGroup,[0,100,100,100])],
 [row(TASK.none,[0,0,50,0]),row(TASK.killCriminal,[0,100,0,100])],
 [row(TASK.none,[100,50,50,50]),row(TASK.carDriveMissionFleeScene,[0,25,25,25]),row(TASK.roadRage,[0,25,25,25]),row(TASK.carDriveMissionKillPed,[0,25,0,0])],
 [row(TASK.none,[100,50,50,50]),row(TASK.roadRage,[0,50,50,50]),row(TASK.carDriveMissionKillPed,[0,150,0,0])],
 [row(TASK.none,[100,0,50,90]),row(TASK.carDriveMissionFleeScene,[0,100,50,10])],
];
const makers:DecisionMaker[]=COLLISION_DECISION_ROWS.map(choices=>new Map([[VEHICLE_DAMAGE_COLLISION_EVENT,choices]]));
export type CollisionResponse='none'|'fleeScene'|'roadRage'|'killPed'|'killCriminal';
/** CTaskComplexCarDriveMissionFleeScene: MISSION_CRUISE, DRIVING_STYLE_AVOID_CARS, cruise speed 40. */
export const FLEE_SCENE_CRUISE_SPEED=40;
/** The rammed driver's answer (CEventHandler::ComputeVehicleDamageResponse maps the drawn task). */
export function collisionDamageResponse(decisionMaker:number|undefined,relationship:Relationship,random:()=>number):CollisionResponse{
 const dm=makers[decisionMaker??2]??makers[2];
 switch(makeDecision(dm,VEHICLE_DAMAGE_COLLISION_EVENT,relationship,true,random)){
  case TASK.carDriveMissionFleeScene:return 'fleeScene';
  case TASK.roadRage:return 'roadRage';
  case TASK.carDriveMissionKillPed:return 'killPed';
  case TASK.killCriminal:return 'killCriminal';
  default:return 'none';
 }
}
export {RELATIONSHIP};
