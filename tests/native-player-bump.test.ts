import {expect,test} from 'vitest';
import {PEDMOVE} from '../src/combat/nativeDamageAnim';
import {playerCollisionWithPedResponse} from '../src/ped/nativePlayerBump';

const r=(player:number,victim:number,inFront:boolean,behindVictim:boolean,playerDefend=.4,victimDefend=1)=>playerCollisionWithPedResponse({player,victim,inFront,behindVictim,playerDefend,victimDefend});
test('ComputePlayerCollisionWithPedResponse by move states',()=>{
 // Both walking: the bump line; walking up behind the ped annoys the player.
 expect(r(PEDMOVE.walk,PEDMOVE.walk,true,false)).toEqual({bump:true,annoy:false,stagger:false,fall:false});
 expect(r(PEDMOVE.walk,PEDMOVE.walk,false,true).annoy).toBe(true);
 expect(r(PEDMOVE.walk,PEDMOVE.run,true,true).bump).toBe(false);
 // Standing, walked into: a stagger only when the ped was running.
 expect(r(PEDMOVE.still,PEDMOVE.walk,true,true)).toEqual({bump:true,annoy:false,stagger:false,fall:false});
 expect(r(PEDMOVE.still,PEDMOVE.run,true,true).stagger).toBe(true);
 expect(r(PEDMOVE.still,PEDMOVE.run,true,false).bump).toBe(false);
 // Sprinting into a standing ped ahead: only the line.
 expect(r(PEDMOVE.sprint,PEDMOVE.still,true,false)).toEqual({bump:true,annoy:false,stagger:false,fall:false});
 expect(r(PEDMOVE.run,PEDMOVE.still,true,false).bump).toBe(false);
 // Running past a moving ped: annoyed.
 expect(r(PEDMOVE.run,PEDMOVE.walk,true,false)).toEqual({bump:true,annoy:true,stagger:false,fall:false});
 // Head on into a running ped: the player (defend weakness 0.4) staggers when sprinting and never falls.
 expect(r(PEDMOVE.sprint,PEDMOVE.run,true,true)).toEqual({bump:true,annoy:true,stagger:true,fall:false});
 expect(r(PEDMOVE.run,PEDMOVE.run,true,true).stagger).toBe(false);
 expect(r(PEDMOVE.run,PEDMOVE.walk,true,true).bump).toBe(false);
 // A weaker player than the ped goes down.
 expect(r(PEDMOVE.sprint,PEDMOVE.sprint,true,true,2,1.8).fall).toBe(true);
 expect(playerCollisionWithPedResponse({player:PEDMOVE.sprint,victim:PEDMOVE.sprint,inFront:true,behindVictim:true,playerDefend:.4,victimDefend:1,follower:true})).toEqual({bump:true,annoy:false,stagger:false,fall:false});
});
