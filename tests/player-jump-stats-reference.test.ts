import {expect,test} from 'vitest';
import reference from './fixtures/player-jump-stats-reference.json';
import {nativeBodyMovementModifier} from '../src/simulation/nativeBodyMovement';
import {nativeJumpStatLaunch} from '../src/simulation/nativePlayerJump';

for(const [i,row] of reference.launches.entries())test(`captured zero-velocity jump force and speed ${i}`,()=>{
 const v=row.input,result=nativeJumpStatLaunch({modifier:nativeBodyMovementModifier(v.fat,v.muscle),run:v.run??undefined,sprint:v.sprint??undefined,player:v.player,highJump:v.highJump,megaJump:v.megaJump,climbJump:v.climbJump});
 expect(result.force).toBe(row.force![2]);expect(result.upVelocity).toBe(row.velocity[2]);expect(result.forwardSpeed).toBe(row.velocity[1]);
});
