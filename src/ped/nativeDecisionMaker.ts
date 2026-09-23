/* SA's ped decision makers: data/decision/allowed/*.ped and *.grp, as CDecisionMakerTypesFileLoader::LoadDecisionMaker
 * (0x6076B0, reversed) reads them. Each line after the first is an event type, an unused 4, then six choices of
 * a task type, four chances by the event source's relationship (friend, threat, player, neutral), whether the task is
 * allowed in a vehicle and on foot, and six facial chances.
 * CDecisionMakerTypes::MakeDecision (0x606E70), CDecision::MakeDecision (0x6040D0) and
 * CEventSource::ComputeEventSourceType (0x4ABAC0) are retail stubs. Their documented behaviour
 * (gtamods.com/wiki/Decision_Maker) is followed here:
 * - the source's relationship picks one chance column;
 * - the ped's state picks the choices allowed in a vehicle or on foot;
 * - one choice is drawn with probability proportional to its chance among them.
 * CEventEditableResponse::ComputeResponseTaskType (reversed) passes INFORM_RESPECTED_FRIENDS, INFORM_GROUP and
 * LOOK_AT_ENTITY_OR_COORD as the tasks to avoid; they are left out of the draw.
 * The retail files also hold rows for events 0, 16, 45 and 74, which PedEvent.txt gives no decision slot
 * (CDecisionMakerTypes::LoadEventIndices is a stub); they are read but never asked for. */

/** eEventType values of the events the decision makers answer (data/decision/PedEvent.txt). */
export const EVENT={draggedOutCar:7,knockOffBike:8,damage:9,deadPed:11,potentialGetRunOver:12,potentialWalkIntoPed:13,shotFired:15,
 pedEnteredMyVehicle:17,sexyPed:20,vehicleThreat:30,gunAimedAt:31,acquaintancePedHate:36,acquaintancePedDislike:37,acquaintancePedLike:38,
 acquaintancePedRespect:39,vehicleDamageWeapon:41,gotKnockedOverByCar:43,shotFiredWhizzedBy:49,lowAngerAtPlayer:50,highAngerAtPlayer:51,
 seenPanickedPed:65,seenCop:72,vehicleDamageCollision:73,danger:75,vehicleOnFire:79} as const;
/** CEvent::GetEventPriority of those events (Events/*.h). */
export const EVENT_PRIORITY:Readonly<Record<number,number>>={[EVENT.damage]:65,[EVENT.gunAimedAt]:50,[EVENT.shotFired]:35,[EVENT.seenPanickedPed]:13,[EVENT.danger]:20};
/** eTaskType values the responses use (Enums/eTaskType.h). */
export const TASK={invalid:-1,none:200,standStill:203,lookAt:300,cower:412,handsUp:413,duck:415,duckForever:427,beDamaged:251,
 investigateDeadPed:600,reactToGunAimedAt:601,getOutOfWayOfCar:603,fleeEntity:909,smartFleeEntity:911,turnToFaceEntity:920,fleeAnyMeans:927,
 killPedOnFoot:1000,killPedOnFootStealth:1028,killCriminal:1105,informGroup:1200,informRespectedFriends:1700,
 carDriveMissionFleeScene:726,carDriveMissionKillPed:729,gangHasslePed:1212,leaveCarAndFlee:706,roadRage:1031,stealCar:702} as const;
/** The chance columns, in file order. */
export const RELATIONSHIP={friend:0,threat:1,player:2,neutral:3} as const;
export type Relationship=typeof RELATIONSHIP[keyof typeof RELATIONSHIP];
/** CDecisionMakerTypesFileLoader::LoadDefaultDecisionMaker's DEFAULT_DECISION_MAKER files, in the order pedstats.dat's
 * default decision maker column indexes them (0 group member, 1 cop, 2 rand_norm, 3 rand_tough, 4 rand_weak, 5 fireman). */
export const DEFAULT_DECISION_MAKER_FILES=['GangMbr.ped','Cop.ped','R_Norm.ped','R_Tough.ped','R_Weak.ped','Fireman.ped','m_empty.ped','Indoors.ped'] as const;

/** Six choices per event, which is what a row of a decision file holds and what a script can fill. */
export const MAX_DECISION_CHOICES=6;
export interface DecisionChoice {task:number;chances:readonly [number,number,number,number];inVehicle:boolean;onFoot:boolean}
/** One decision maker: the choices for each event type it answers. */
export type DecisionMaker=ReadonlyMap<number,readonly DecisionChoice[]>;

/** CDecisionMakerTypesFileLoader::LoadDecisionMaker: CFileLoader::LoadLine turns commas into spaces; the first line is
 * a header. Empty slots (TASK_INVALID) are dropped; TASK_NONE is a choice to do nothing. */
export function readDecisionMaker(text:string):DecisionMaker{
 const out=new Map<number,DecisionChoice[]>();
 for(const line of text.split(/\r?\n/).slice(1)){
  const v=line.replace(/,/g,' ').trim().split(/\s+/);if(v.length<2||v[0]==='')continue;
  const event=Number(v[0]);if(!Number.isInteger(event))continue;
  const choices:DecisionChoice[]=[];
  for(let i=0;i<6;i++){
   const c=v.slice(2+i*13,2+i*13+13).map(Number);if(c.length<7||c.some(Number.isNaN))break;
   if(c[0]<0)continue;
   choices.push({task:c[0],chances:[c[1],c[2],c[3],c[4]],inVehicle:c[5]!==0,onFoot:c[6]!==0});
  }
  out.set(event,choices);
 }
 return out;
}
/** data/decision/PedEvent.txt: event names by type, in the order of the decision slots. */
export function readPedEvents(text:string){
 const out=new Map<number,string>();
 for(const line of text.split(/\r?\n/)){const [name,id]=line.trim().split(/\s+/);if(name&&id&&Number.isInteger(Number(id)))out.set(Number(id),name);}
 return out;
}

const AVOID:readonly number[]=[TASK.informRespectedFriends,TASK.informGroup,TASK.lookAt];
/** CDecisionMakerTypes::MakeDecision: a task for `event` from a source of `relationship`, or TASK_NONE. `random`
 * returns [0, 1). */
export function makeDecision(dm:DecisionMaker|undefined,event:number,relationship:Relationship,inVehicle:boolean,random:()=>number,avoid:readonly number[]=AVOID):number{
 const choices=(dm?.get(event)??[]).filter(c=>(inVehicle?c.inVehicle:c.onFoot)&&!avoid.includes(c.task)&&c.chances[relationship]>0);
 const total=choices.reduce((sum,c)=>sum+c.chances[relationship],0);
 if(!(total>0))return TASK.none;
 let pick=random()*total;
 for(const c of choices){pick-=c.chances[relationship];if(pick<0)return c.task;}
 return choices[choices.length-1].task;
}
/** CEventHandler::HandleEvents (0x4C3F10) for a new event against the one a ped answers (undefined for none):
 * - an event of the current event's type is dropped;
 * - otherwise it takes over by CEvent::TakesPriorityOver, which compares priorities;
 * - CEventGunAimedAt::TakesPriorityOver also lets the player's aimed gun override damage from someone else.
 * `source` is the event's source ped, undefined for the player. */
export function takesPriorityOverCurrentEvent(current:{type:number;source?:unknown}|undefined,type:number,source?:unknown){
 if(!current)return true;
 if(current.type===type)return false;
 if(type===EVENT.gunAimedAt&&source===undefined&&current.source!==undefined&&current.type===EVENT.damage)return true;
 return (EVENT_PRIORITY[type]??0)>=(EVENT_PRIORITY[current.type]??0);
}
/** CEventHandler::IsKillTaskAppropriate (0x4BC3E0, reversed): a ped without a gun only takes on an attacker without one. */
export function isKillTaskAppropriate(o:{createdByMission?:boolean;holdsGun:boolean;attackerHoldsGun:boolean}){
 return !!o.createdByMission||o.holdsGun||!o.attackerHoldsGun;
}

export interface PedAcquaintances {respect:ReadonlySet<string>;like:ReadonlySet<string>;dislike:ReadonlySet<string>;hate:ReadonlySet<string>}
/** data/ped.dat (CPedType::LoadPedData): a ped type line, then its Respect, Like, Dislike and Hate lists; a repeated
 * list replaces the earlier one. */
export function readPedRelationships(text:string){
 const out=new Map<string,{respect:Set<string>;like:Set<string>;dislike:Set<string>;hate:Set<string>}>();
 let current:ReturnType<typeof out.get>;
 for(const raw of text.split(/\r?\n/)){
  const line=raw.replace(/#.*/,'').trim();if(!line)continue;
  const [head,...rest]=line.split(/\s+/),kind=head.toLowerCase();
  if(kind==='respect'||kind==='like'||kind==='dislike'||kind==='hate'){if(current)current[kind]=new Set(rest.map(t=>t.toUpperCase()));}
  else{current={respect:new Set(),like:new Set(),dislike:new Set(),hate:new Set()};out.set(head.toUpperCase(),current);}
 }
 return out as ReadonlyMap<string,PedAcquaintances>;
}
/** CEventSource::ComputeEventSourceType (0x4ABAC0, a retail stub) as the decision maker documentation describes it:
 * the player column for the player; the friend column for a ped the observer respects or likes; the threat column for
 * one it hates or dislikes; the neutral column otherwise, and for events without a ped. */
export function sourceRelationship(acquaintances:ReadonlyMap<string,PedAcquaintances>|undefined,observer:string|undefined,source:string|'PLAYER'|undefined):Relationship{
 if(source==='PLAYER')return RELATIONSHIP.player;
 const a=observer?acquaintances?.get(observer):undefined;
 if(!a||!source)return RELATIONSHIP.neutral;
 if(a.respect.has(source)||a.like.has(source))return RELATIONSHIP.friend;
 if(a.hate.has(source)||a.dislike.has(source))return RELATIONSHIP.threat;
 return RELATIONSHIP.neutral;
}
