import {describe,expect,test} from 'vitest';
import {MAX_DECISION_CHOICES,RELATIONSHIP,TASK,makeDecision} from '../src/ped/nativeDecisionMaker';
import type {DecisionChoice} from '../src/ped/nativeDecisionMaker';

/** The rows a script writes are the rows a decision file would have held, so the same chooser reads them. */
const rows=(choices:DecisionChoice[])=>new Map([[9,choices]]);

describe('the decision rows a script writes',()=>{
 test('a single choice with a chance in one column is taken only for that column',()=>{
  // The chances go into the four slots in the order the command gives them, whatever the two namings call
  // them; here only the first slot has any chance at all.
  const table=rows([{task:TASK.fleeEntity,chances:[100,0,0,0],inVehicle:false,onFoot:true}]);
  expect(makeDecision(table,9,RELATIONSHIP.friend,false,()=>0.5)).toBe(TASK.fleeEntity);
  // Nothing applicable is TASK_NONE, a choice to do nothing, rather than no answer at all.
  expect(makeDecision(table,9,RELATIONSHIP.threat,false,()=>0.5)).toBe(TASK.none);
 });

 test('a choice allowed only on foot is not offered to a ped in a car, and the other way about',()=>{
  const table=rows([{task:TASK.fleeEntity,chances:[100,100,100,100],inVehicle:false,onFoot:true},
   {task:TASK.carDriveMissionFleeScene,chances:[100,100,100,100],inVehicle:true,onFoot:false}]);
  expect(makeDecision(table,9,RELATIONSHIP.player,false,()=>0.5)).toBe(TASK.fleeEntity);
  expect(makeDecision(table,9,RELATIONSHIP.player,true,()=>0.5)).toBe(TASK.carDriveMissionFleeScene);
 });

 test('two choices share the draw in proportion to their chances',()=>{
  const table=rows([{task:TASK.fleeEntity,chances:[25,0,0,0],inVehicle:false,onFoot:true},
   {task:TASK.killPedOnFoot,chances:[75,0,0,0],inVehicle:false,onFoot:true}]);
  // A draw in the first quarter takes the first choice; the rest take the second.
  expect(makeDecision(table,9,RELATIONSHIP.friend,false,()=>0.1)).toBe(TASK.fleeEntity);
  expect(makeDecision(table,9,RELATIONSHIP.friend,false,()=>0.9)).toBe(TASK.killPedOnFoot);
 });

 test('an event with no row of its own has no answer',()=>{
  const table=rows([{task:TASK.fleeEntity,chances:[100,0,0,0],inVehicle:false,onFoot:true}]);
  expect(makeDecision(table,11,RELATIONSHIP.friend,false,()=>0.5)).toBe(TASK.none);
 });

 test('a row holds six choices, as a decision file’s own row does',()=>{
  expect(MAX_DECISION_CHOICES).toBe(6);
 });
});
