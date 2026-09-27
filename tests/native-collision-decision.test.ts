import {expect,test} from 'vitest';
import {collisionDamageResponse,weaponDamageResponse,RELATIONSHIP} from '../src/vehicle/nativeCollisionDecision';
test('R_Norm rammed by the player: of 125, nothing 50, a flee-scene drive, road rage and a ram back (CarDriveMissionKillPed) 25 each',()=>{
 expect(collisionDamageResponse(2,RELATIONSHIP.player,()=>.1)).toBe('none');
 expect(collisionDamageResponse(2,RELATIONSHIP.player,()=>.5)).toBe('fleeScene');
 expect(collisionDamageResponse(2,RELATIONSHIP.player,()=>.7)).toBe('roadRage');
 expect(collisionDamageResponse(2,RELATIONSHIP.player,()=>.9)).toBe('killPed');
 // A friend never draws a reaction; the ram back is the player's column only (729,0,0,25,0).
 expect(collisionDamageResponse(2,RELATIONSHIP.friend,()=>.99)).toBe('none');
 expect(collisionDamageResponse(2,RELATIONSHIP.threat,()=>.99)).toBe('roadRage');
});
test('tough peds ram the player back three times in five, rage or ignore him otherwise; weak peds flee; gang members inform their group (nothing here), cops hunt criminals',()=>{
 expect(collisionDamageResponse(3,RELATIONSHIP.player,()=>.1)).toBe('none');
 expect(collisionDamageResponse(3,RELATIONSHIP.player,()=>.3)).toBe('roadRage');
 expect(collisionDamageResponse(3,RELATIONSHIP.player,()=>.6)).toBe('killPed');
 expect(collisionDamageResponse(4,RELATIONSHIP.player,()=>.6)).toBe('fleeScene');
 expect(collisionDamageResponse(4,RELATIONSHIP.neutral,()=>.95)).toBe('fleeScene');
 expect(collisionDamageResponse(4,RELATIONSHIP.neutral,()=>.5)).toBe('none');
 expect(collisionDamageResponse(0,RELATIONSHIP.player,()=>.5)).toBe('none');
 expect(collisionDamageResponse(1,RELATIONSHIP.threat,()=>.5)).toBe('killCriminal');
 expect(collisionDamageResponse(1,RELATIONSHIP.player,()=>.5)).toBe('none');
 expect(collisionDamageResponse(undefined,RELATIONSHIP.player,()=>.7)).toBe('roadRage');
});
test('a tyre shot out (event 41): normal drivers flee the scene three times in four, weak ones may leave the car',()=>{
 expect(weaponDamageResponse(2,RELATIONSHIP.player,()=>.5)).toBe('fleeScene');
 expect(weaponDamageResponse(2,RELATIONSHIP.player,()=>.9)).toBe('none');
 expect(weaponDamageResponse(2,RELATIONSHIP.threat,()=>.9)).toBe('killPed');
 expect(weaponDamageResponse(3,RELATIONSHIP.player,()=>.7)).toBe('killPedOnFoot');
 expect(weaponDamageResponse(3,RELATIONSHIP.player,()=>.3)).toBe('none');
 expect(weaponDamageResponse(4,RELATIONSHIP.player,()=>.5)).toBe('fleeScene');
 expect(weaponDamageResponse(4,RELATIONSHIP.player,()=>.9)).toBe('leaveCarAndFlee');
 expect(weaponDamageResponse(4,RELATIONSHIP.neutral,()=>.5)).toBe('none');
 expect(weaponDamageResponse(0,RELATIONSHIP.player,()=>.5)).toBe('none');
 expect(weaponDamageResponse(1,RELATIONSHIP.neutral,()=>.5)).toBe('killCriminal');
});
