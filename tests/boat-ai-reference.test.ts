import {expect,test} from 'vitest';
import reference from './fixtures/boat-ai-reference.json';
import {steerAIBoatHeadingForTarget} from '../src/simulation/nativeBoatAI';
for(const [i,row] of reference.cases.entries())test(`captured native boat heading controls ${i}`,()=>{
 const r=row.input;expect(steerAIBoatHeadingForTarget({position:{x:r.position[0],y:r.position[1]},forward:{x:r.forward[0],y:r.forward[1]},moveSpeed:{x:r.moveSpeed[0],y:r.moveSpeed[1]}},{x:r.target[0],y:r.target[1]},r.cruiseSpeed)).toEqual({steer:row.steer,gas:row.gas,brake:row.brake,handbrake:false});
});
