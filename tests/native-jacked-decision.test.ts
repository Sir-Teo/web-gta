import {expect,test} from 'vitest';
import {draggedOutDecisionTask} from '../src/ped/nativeJackedDecision';
import {RELATIONSHIP,TASK} from '../src/ped/nativeDecisionMaker';
test('a jacked normal driver: kill 10, flee 75, steal the car 15; tough ones mostly fight, weak ones flee',()=>{
 expect(draggedOutDecisionTask(2,RELATIONSHIP.player,()=>.05)).toBe(TASK.killPedOnFoot);
 expect(draggedOutDecisionTask(2,RELATIONSHIP.player,()=>.5)).toBe(TASK.smartFleeEntity);
 expect(draggedOutDecisionTask(2,RELATIONSHIP.player,()=>.9)).toBe(TASK.stealCar);
 expect(draggedOutDecisionTask(3,RELATIONSHIP.player,()=>.5)).toBe(TASK.killPedOnFoot);
 expect(draggedOutDecisionTask(3,RELATIONSHIP.player,()=>.9)).toBe(TASK.stealCar);
 expect(draggedOutDecisionTask(3,RELATIONSHIP.friend,()=>.9)).toBe(TASK.none);
 expect(draggedOutDecisionTask(4,RELATIONSHIP.player,()=>.9)).toBe(TASK.smartFleeEntity);
 // Gang members inform their group and cops their friends: avoided tasks, so nothing; a cop hunts a threat.
 expect(draggedOutDecisionTask(0,RELATIONSHIP.player,()=>.5)).toBe(TASK.none);
 expect(draggedOutDecisionTask(1,RELATIONSHIP.player,()=>.5)).toBe(TASK.none);
 expect(draggedOutDecisionTask(1,RELATIONSHIP.threat,()=>.3)).toBe(TASK.killPedOnFoot);
});
