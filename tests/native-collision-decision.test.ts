import {expect,test} from 'vitest';
import {collisionDamageResponse,RELATIONSHIP} from '../src/vehicle/nativeCollisionDecision';
test('R_Norm rammed by the player: nothing half the time, a flee-scene drive or road rage a quarter each',()=>{
 expect(collisionDamageResponse(2,RELATIONSHIP.player,()=>.1)).toBe('none');
 expect(collisionDamageResponse(2,RELATIONSHIP.player,()=>.6)).toBe('fleeScene');
 expect(collisionDamageResponse(2,RELATIONSHIP.player,()=>.9)).toBe('roadRage');
 // A friend never draws a reaction; a threat can be rammed back (CarDriveMissionKillPed).
 expect(collisionDamageResponse(2,RELATIONSHIP.friend,()=>.99)).toBe('none');
 expect(collisionDamageResponse(2,RELATIONSHIP.threat,()=>.99)).toBe('killPed');
});
test('tough peds rage half the time, weak peds flee; gang members inform their group (nothing here), cops hunt criminals',()=>{
 expect(collisionDamageResponse(3,RELATIONSHIP.player,()=>.6)).toBe('roadRage');
 expect(collisionDamageResponse(3,RELATIONSHIP.player,()=>.4)).toBe('none');
 expect(collisionDamageResponse(4,RELATIONSHIP.player,()=>.6)).toBe('fleeScene');
 expect(collisionDamageResponse(4,RELATIONSHIP.neutral,()=>.95)).toBe('fleeScene');
 expect(collisionDamageResponse(4,RELATIONSHIP.neutral,()=>.5)).toBe('none');
 expect(collisionDamageResponse(0,RELATIONSHIP.player,()=>.5)).toBe('none');
 expect(collisionDamageResponse(1,RELATIONSHIP.threat,()=>.5)).toBe('killCriminal');
 expect(collisionDamageResponse(1,RELATIONSHIP.player,()=>.5)).toBe('none');
 expect(collisionDamageResponse(undefined,RELATIONSHIP.player,()=>.9)).toBe('roadRage');
});
