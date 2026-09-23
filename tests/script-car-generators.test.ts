import {expect,test} from 'vitest';
import {ScmMission} from '../src/simulation/ScmMission';
import {ScmGameState} from '../src/engine/ScmGameState';

test('a script generator reaches the fleet facing its own heading, off until switched on, and counts its spawns down',()=>{
 const game=new ScmGameState();
 const index=game.carGenerators.create({position:[1,2,3],angle:90,modelId:400,primaryColour:-1,secondaryColour:-1,forceSpawn:false,alarmChance:0,doorLockChance:0,minDelay:0,maxDelay:0},0);
 const records=(ScmMission.prototype as any).scriptCarGenerators.call({runtime:{game}});
 // Packed to a byte once (64 of 256), unpacked once: a quarter turn.
 expect(records[0].angle).toBeCloseTo(Math.PI/2,6);
 expect(records[0].generateCount()).toBe(0);
 game.carGenerators.switch(index,2,0);
 expect(records[0].generateCount()).toBe(2);
 records[0].spent();records[0].spent();records[0].spent();expect(records[0].generateCount()).toBe(0);
 game.carGenerators.switch(index,101,0);records[0].spent();expect(records[0].generateCount()).toBe(0xffff);
});
