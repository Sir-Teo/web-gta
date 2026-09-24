import {expect,test} from 'vitest';
import {existsSync,readFileSync} from 'node:fs';
import {DEFAULT_DECISION_MAKER_FILES,EVENT,RELATIONSHIP,TASK,isKillTaskAppropriate,makeDecision,readDecisionMaker,readPedEvents,readPedRelationships,sourceRelationship,takesPriorityOverCurrentEvent} from '../src/ped/nativeDecisionMaker';

const depot=process.env.GTA_CONTENT_DIR,decision=`${depot}/data/decision`;
const read=(path:string)=>readFileSync(path,'latin1');
const sequence=(...values:number[])=>{let i=0;return ()=>values[i++%values.length];};

test('LoadDecisionMaker reads six choices per event: task, four chances, vehicle and foot flags, six facial chances',()=>{
 const dm=readDecisionMaker('data values2:\r\n9,4,251,50.000000,0.000000,0.000000,0.000000,0,1,0,0,0,0,0,0,1000,20.0,60.0,60.0,60.0,0,1,0,0,0,0,0,0,726,0.0,100.0,100.0,0.0,1,0,0,0,0,0,0,0,-1,0.0,0.0,0.0,0.0,0,0,0,0,0,0,0,0,-1,0.0,0.0,0.0,0.0,0,0,0,0,0,0,0,0,200,0.0,0.0,0.0,0.0,0,0,0,0,0,0,0,0,\r\n');
 expect(dm.get(9)).toEqual([
  {task:251,chances:[50,0,0,0],inVehicle:false,onFoot:true},
  {task:1000,chances:[20,60,60,60],inVehicle:false,onFoot:true},
  {task:726,chances:[0,100,100,0],inVehicle:true,onFoot:false},
  {task:200,chances:[0,0,0,0],inVehicle:false,onFoot:false},
 ]);
});
test('MakeDecision draws by the relationship column among the tasks allowed on foot or in a vehicle',()=>{
 const dm=readDecisionMaker('x\n15,4,911,5,70,50,50,0,1,0,0,0,0,0,0,415,0,0,0,50,0,1,0,0,0,0,0,0,300,0,0,20,20,0,1,0,0,0,0,0,0,726,0,100,100,0,1,0,0,0,0,0,0,0\n');
 // The player column on foot: 911 (50) and LOOK_AT (20), which the editable response avoids.
 expect(makeDecision(dm,15,RELATIONSHIP.player,false,sequence(.99))).toBe(TASK.smartFleeEntity);
 // The neutral column: 911 (50) then DUCK (50).
 expect(makeDecision(dm,15,RELATIONSHIP.neutral,false,sequence(.49))).toBe(TASK.smartFleeEntity);
 expect(makeDecision(dm,15,RELATIONSHIP.neutral,false,sequence(.5))).toBe(TASK.duck);
 expect(makeDecision(dm,15,RELATIONSHIP.player,true,sequence(0))).toBe(726);
 expect(makeDecision(dm,15,RELATIONSHIP.friend,true,sequence(0))).toBe(TASK.none);
 expect(makeDecision(dm,16,RELATIONSHIP.player,false,sequence(0))).toBe(TASK.none);
 expect(makeDecision(undefined,15,RELATIONSHIP.player,false,sequence(0))).toBe(TASK.none);
});
test('IsKillTaskAppropriate: a ped with a gun, or one facing an attacker without one, fights',()=>{
 expect(isKillTaskAppropriate({holdsGun:false,attackerHoldsGun:false})).toBe(true);
 expect(isKillTaskAppropriate({holdsGun:true,attackerHoldsGun:true})).toBe(true);
 expect(isKillTaskAppropriate({holdsGun:false,attackerHoldsGun:true})).toBe(false);
 expect(isKillTaskAppropriate({holdsGun:false,attackerHoldsGun:true,createdByMission:true})).toBe(true);
});
test('HandleEvents drops a repeat event type and lets damage beat an aimed gun beat a shot',()=>{
 expect(takesPriorityOverCurrentEvent(undefined,EVENT.shotFired)).toBe(true);
 expect(takesPriorityOverCurrentEvent({type:EVENT.damage},EVENT.damage)).toBe(false);
 expect(takesPriorityOverCurrentEvent({type:EVENT.shotFired},EVENT.damage)).toBe(true);
 expect(takesPriorityOverCurrentEvent({type:EVENT.shotFired},EVENT.gunAimedAt)).toBe(true);
 expect(takesPriorityOverCurrentEvent({type:EVENT.gunAimedAt},EVENT.shotFired)).toBe(false);
 expect(takesPriorityOverCurrentEvent({type:EVENT.damage},EVENT.gunAimedAt)).toBe(false);
 expect(takesPriorityOverCurrentEvent({type:EVENT.damage,source:{}},EVENT.gunAimedAt)).toBe(true);
 // CEventPotentialGetRunOver is 51: over an aimed gun's 50, under damage's 65, and dropped as a repeat.
 expect(takesPriorityOverCurrentEvent({type:EVENT.gunAimedAt},EVENT.potentialGetRunOver)).toBe(true);
 expect(takesPriorityOverCurrentEvent({type:EVENT.damage},EVENT.potentialGetRunOver)).toBe(false);
 expect(takesPriorityOverCurrentEvent({type:EVENT.potentialGetRunOver},EVENT.potentialGetRunOver)).toBe(false);
});
test('ped.dat acquaintances pick the friend, threat or neutral column',()=>{
 const a=readPedRelationships('CIVMALE\n    Respect CIVMALE\n    Respect CIVMALE CIVFEMALE\nGANG1\n    Hate GANG2 # rivals\n');
 expect(sourceRelationship(a,'CIVMALE','CIVFEMALE')).toBe(RELATIONSHIP.friend);
 expect(sourceRelationship(a,'GANG1','GANG2')).toBe(RELATIONSHIP.threat);
 expect(sourceRelationship(a,'GANG1','CIVMALE')).toBe(RELATIONSHIP.neutral);
 expect(sourceRelationship(a,'GANG1','PLAYER')).toBe(RELATIONSHIP.player);
 expect(sourceRelationship(a,undefined,undefined)).toBe(RELATIONSHIP.neutral);
});
test.runIf(!!depot&&existsSync(`${decision}/allowed/R_Norm.ped`))('the retail decision makers',()=>{
 const events=readPedEvents(read(`${decision}/PedEvent.txt`));
 expect(events.size).toBe(41);expect(events.get(9)).toBe('EVENT_DAMAGE');expect(events.get(31)).toBe('EVENT_GUN_AIMED_AT');
 const dms=DEFAULT_DECISION_MAKER_FILES.map(name=>readDecisionMaker(read(`${decision}/allowed/${name}`)));
 // Rows for events 0, 16, 45 and 74 have no PedEvent.txt slot; the events answered here all have one.
 const unindexed=new Set(dms.flatMap(dm=>[...dm.keys()]).filter(e=>!events.has(e)));
 expect([...unindexed].sort((a,b)=>a-b)).toEqual([0,16,45,74]);
 for(const event of [EVENT.damage,EVENT.shotFired,EVENT.gunAimedAt,EVENT.seenPanickedPed])expect(events.has(event)).toBe(true);
 const [,cop,norm,tough,weak]=dms,player=RELATIONSHIP.player;
 const shares=(dm:typeof norm,event:number)=>{const out:Record<number,number>={};for(let i=0;i<1000;i++){const t=makeDecision(dm,event,player,false,()=>(i+.5)/1000);out[t]=(out[t]??0)+1;}return out;};
 // Punched by the player: rand_norm fights 60% and flees 40%; rand_tough always fights; rand_weak always flees.
 expect(shares(norm,EVENT.damage)).toEqual({[TASK.killPedOnFoot]:600,[TASK.smartFleeEntity]:400});
 expect(shares(tough,EVENT.damage)).toEqual({[TASK.killPedOnFoot]:1000});
 expect(shares(weak,EVENT.damage)).toEqual({[TASK.smartFleeEntity]:1000});
 // The player's shots: rand_norm and rand_weak flee; rand_tough flees 40%, attacks 60%.
 expect(shares(norm,EVENT.shotFired)).toEqual({[TASK.smartFleeEntity]:1000});
 expect(shares(weak,EVENT.shotFired)).toEqual({[TASK.smartFleeEntity]:1000});
 expect(shares(tough,EVENT.shotFired)).toEqual({[TASK.smartFleeEntity]:400,[TASK.killPedOnFoot]:600});
 // Every street maker answers an aimed gun with CTaskComplexReactToGunAimedAt; cops go after criminals.
 for(const dm of [norm,tough,weak])expect(shares(dm,EVENT.gunAimedAt)).toEqual({[TASK.reactToGunAimedAt]:1000});
 expect(makeDecision(cop,EVENT.gunAimedAt,RELATIONSHIP.threat,false,()=>0)).toBe(TASK.killCriminal);
 // A friend's shots: rand_tough mostly carries on (TASK_NONE 95, flee 5).
 expect(makeDecision(tough,EVENT.shotFired,RELATIONSHIP.friend,false,()=>.5)).toBe(TASK.none);
 expect(makeDecision(tough,EVENT.shotFired,RELATIONSHIP.friend,false,()=>.01)).toBe(TASK.smartFleeEntity);
 const peds=readPedRelationships(read(`${depot}/data/ped.dat`));
 expect(sourceRelationship(peds,'CIVMALE','CIVFEMALE')).toBe(RELATIONSHIP.friend);
 expect(sourceRelationship(peds,'GANG2','GANG1')).toBe(RELATIONSHIP.threat);
 expect(sourceRelationship(peds,'COP','CRIMINAL')).toBe(RELATIONSHIP.threat);
});
