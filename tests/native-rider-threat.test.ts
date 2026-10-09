import {expect,test} from 'vitest';
import {answersHateWithDriveBy,closestHated,senseRange,threatDriveByRange} from '../src/simulation/nativeRiderThreat';
import type {DecisionChoice,DecisionMaker} from '../src/ped/nativeDecisionMaker';

const row=(task:number,inVehicle:boolean,onFoot:boolean):DecisionChoice=>({task,chances:[0,100,0,0],inVehicle,onFoot});
// TWAR7: the group's 146@ answers the hate (36) with TASK_GROUP_USE_MEMBER_DECISION in a car; OG Loc's 148@ with the
// gang drive-by on foot or in a car.
const group:DecisionMaker=new Map([[36,[row(1510,true,false)]]]);
const ogLoc:DecisionMaker=new Map([[36,[row(1022,true,true)]]]);

test('the group passes the hate to the member, whose own decision maker drives by',()=>{
 expect(answersHateWithDriveBy({decisionMaker:group},ogLoc,()=>0)).toBe(true);
 expect(answersHateWithDriveBy(undefined,ogLoc,()=>0)).toBe(true);
 // A group whose decision maker has no row for it, or answers it itself, keeps it.
 expect(answersHateWithDriveBy({decisionMaker:undefined},ogLoc,()=>0)).toBe(false);
 expect(answersHateWithDriveBy({decisionMaker:new Map([[36,[row(1502,true,true)]]])},ogLoc,()=>0)).toBe(false);
 // A decision maker that answers on foot only, or with something else.
 expect(answersHateWithDriveBy(undefined,new Map([[36,[row(1022,false,true)]]]),()=>0)).toBe(false);
 expect(answersHateWithDriveBy(undefined,new Map([[36,[row(1000,true,true)]]]),()=>0)).toBe(false);
});
test('the nearest hated ped in view and out of the group is the threat',()=>{
 const at=(x:number)=>({x,y:0,z:0});
 const cj={position:at(1),pedType:0,sameGroup:true},homie={position:at(3),pedType:8,sameGroup:false},
  freddy={position:at(20),pedType:24,sameGroup:false},far={position:at(70),pedType:24,sameGroup:false};
 const hates=(type:number)=>type===24||type===0;
 expect(closestHated(at(0),hates,[far,freddy,homie,cj],80,()=>true)).toBe(freddy);
 // Out of sight; past the 40 the sight test reaches; beyond the sense range.
 expect(closestHated(at(0),hates,[freddy],80,()=>false)).toBeUndefined();
 expect(closestHated(at(0),hates,[far],80,()=>true)).toBeUndefined();
 expect(closestHated(at(0),hates,[freddy],15,()=>true)).toBeUndefined();
});
test('the sense range and the drive-by\'s abort range',()=>{
 expect(senseRange(24)).toBe(15);
 expect(senseRange(8)).toBe(40);
 expect(senseRange(8,80)).toBe(80);
 // OG Loc's SET_SENSE_RANGE 80 against the TEC-9's target range.
 expect(threatDriveByRange(25,80)).toBe(85);
 expect(threatDriveByRange(45,15)).toBe(45);
});
