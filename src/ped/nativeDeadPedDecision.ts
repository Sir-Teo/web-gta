import {TASK,makeDecision,type DecisionChoice,type DecisionMaker,type Relationship} from './nativeDecisionMaker';
/* CEventDeadPed (event 11) as the default decision makers answer it on foot, from data/decision/allowed (GangMbr,
 * Cop, R_Norm, R_Tough, R_Weak.ped; CDecisionMakerTypesFileLoader::LoadDecisionMaker's layout). Chances are by the
 * dead ped's relationship to the observer: friend, threat, player, neutral. */
const row=(task:number,chances:readonly [number,number,number,number]):DecisionChoice=>({task,chances,inVehicle:false,onFoot:true});
export const DEAD_PED_EVENT=11;
/** Indexed by pedstats' default decision maker: 0 gang member, 1 cop, 2 normal, 3 tough, 4 weak. */
export const DEAD_PED_DECISION_ROWS:readonly (readonly DecisionChoice[])[]=[
 [row(TASK.none,[100,100,100,100]),row(TASK.lookAt,[100,0,100,100])],
 [],
 [row(TASK.none,[10,10,10,10]),row(TASK.investigateDeadPed,[70,70,70,70]),row(TASK.smartFleeEntity,[20,20,20,20])],
 [row(TASK.none,[30,30,30,30]),row(TASK.investigateDeadPed,[50,50,50,50])],
 [row(TASK.none,[10,10,10,10]),row(TASK.investigateDeadPed,[10,30,60,50]),row(TASK.smartFleeEntity,[80,60,30,40])],
];
const makers:DecisionMaker[]=DEAD_PED_DECISION_ROWS.map(choices=>new Map([[DEAD_PED_EVENT,choices]]));
/** The drawn task (CDecision::MakeDecision; LOOK_AT_ENTITY_OR_COORD is an avoided task, so gang members do nothing). */
export function deadPedDecisionTask(decisionMaker:number|undefined,relationship:Relationship,random:()=>number){
 return makeDecision(makers[decisionMaker??2]??makers[2],DEAD_PED_EVENT,relationship,false,random);
}
