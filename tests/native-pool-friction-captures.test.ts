import {expect,test} from 'vitest';
import fixture from './fixtures/native-pool-friction.json';
import {nativePoolContactFriction,nativePoolGroundFriction} from '../src/simulation/nativePoolFriction';
const point=(v:readonly number[])=>({x:v[0],y:v[1],z:v[2]});
for(const row of fixture.cases)test(`native pool friction capture: ${row.input.name}`,()=>{
 const input=row.input,state={velocity:point(input.velocity),turn:point(input.turn),frictionMove:point(input.frictionMove??[0,0,0]),frictionTurn:point(input.frictionTurn??[0,0,0])};
 const result=input.stage==='contact'?nativePoolContactFriction(state,point(input.point!),point(input.normal!),input.friction!,input.mass??10,input.turnMass??.003):nativePoolGroundFriction(state,point(input.position??[0,0,0]),.037,input.timeStep??1,input.mass??10,input.turnMass??.003);
 for(const key of ['velocity','turn','frictionMove','frictionTurn']as const)expect(Object.values(result[key]),key).toEqual(row[key]);
});
