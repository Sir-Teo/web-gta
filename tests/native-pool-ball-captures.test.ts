import {expect,test} from 'vitest';
import fixture from './fixtures/native-pool-ball.json';
import {nativePoolBallStep} from '../src/simulation/nativePoolBall';
const point=(v:readonly number[])=>({x:v[0],y:v[1],z:v[2]});
for(const row of fixture.cases)test(`native pool-ball capture: ${row.input.name}`,()=>{
 const input=row.input,result=nativePoolBallStep(point(input.position),point(input.velocity),input.gravity??false,{min:point(input.min??[-1,-.5,.7]),max:point(input.max??[1,.5,.7])},input.timeStep??1,.037);
 expect(Object.values(result.position)).toEqual(row.position);expect(Object.values(result.velocity)).toEqual(row.velocity);expect(result.applyGravity).toBe(row.gravity);
 const friction=row.events.find(e=>'friction'in e);
 if(friction){expect(result.impact).toBeDefined();expect(result.impact!.friction).toBe(friction.friction);expect(Object.values(result.impact!.position)).toEqual(friction.position);expect(Object.values(result.impact!.normal)).toEqual(friction.normal);}
 else expect(result.impact).toBeUndefined();
});
