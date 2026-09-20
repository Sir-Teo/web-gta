import {TASK,makeDecision,type DecisionChoice,type DecisionMaker,type Relationship} from './nativeDecisionMaker';
/* CEventDraggedOutCar (event 7) as the default decision makers answer it, from data/decision/allowed (GangMbr, Cop,
 * R_Norm, R_Tough, R_Weak.ped). Chances by the car jacker's relationship: friend, threat, player, neutral. */
const row=(task:number,chances:readonly [number,number,number,number]):DecisionChoice=>({task,chances,inVehicle:true,onFoot:true});
export const DRAGGED_OUT_CAR_EVENT=7;
/** Indexed by pedstats' default decision maker: 0 gang member, 1 cop, 2 normal, 3 tough, 4 weak. */
export const DRAGGED_OUT_DECISION_ROWS:readonly (readonly DecisionChoice[])[]=[
 [row(TASK.informGroup,[0,100,0,100])],
 [row(TASK.stealCar,[0,0,0,100]),row(TASK.killPedOnFoot,[0,100,0,0]),row(TASK.informRespectedFriends,[0,100,0,100])],
 [row(TASK.killPedOnFoot,[10,10,10,10]),row(TASK.smartFleeEntity,[75,75,75,75]),row(TASK.stealCar,[15,15,15,15])],
 [row(TASK.killPedOnFoot,[15,100,75,50]),row(TASK.stealCar,[25,25,25,25]),row(TASK.none,[50,0,0,0])],
 [row(TASK.smartFleeEntity,[100,100,100,100])],
];
const makers:DecisionMaker[]=DRAGGED_OUT_DECISION_ROWS.map(choices=>new Map([[DRAGGED_OUT_CAR_EVENT,choices]]));
/** The drawn task. CEventHandler::ComputeDraggedOutCarResponse (reversed) only acts on KILL_PED_ON_FOOT (the steal-
 * the-car-back sequence when IsKillTaskAppropriate, else a smart flee for good), KILL_CRIMINAL, DESTROY_CAR,
 * HIT_HEAD and EVASIVE_STEP; a drawn SMART_FLEE_ENTITY or STEAL_CAR falls to its default and leaves no task. */
export function draggedOutDecisionTask(decisionMaker:number|undefined,relationship:Relationship,random:()=>number){
 return makeDecision(makers[decisionMaker??2]??makers[2],DRAGGED_OUT_CAR_EVENT,relationship,true,random);
}
