import {expect,test} from 'vitest';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';

const ped=(x:number,z:number,heading=0)=>({actor:{player:{position:{x,y:0,z},heading,speed:1.5}},health:100,blocked:0} as any);
const avoid=(self:any,people:any[],dir:{x:number;z:number},target:{x:number;z:number})=>
 (WorldPedestrians.prototype as any).avoidOtherPeds.call({people},self,1/60,dir,target);

test('a wanderer steers round a ped ahead on its line and ignores one off to the side (CTaskComplexAvoidOtherPedWhileWandering)',()=>{
 const walker=ped(0,0),ahead=ped(0,2),aside=ped(3,2);
 // Walking along +z toward a target 10 ahead: the ped 2 ahead is in the way, one 3 to the side is not.
 const step=avoid(walker,[walker,ahead,aside],{x:0,z:1},{x:0,z:10});
 expect(step).toBeDefined();expect(Math.abs(step.x)).toBeGreaterThan(1);
 expect(walker.avoid.ped).toBe(ahead);
 // The detour clears the 1.05 sphere by another 1.05 across the line.
 expect(Math.abs(walker.avoid.detour.x)).toBeCloseTo(2.1,5);
 const free=ped(0,0);expect(avoid(free,[free,aside],{x:0,z:1},{x:0,z:10})).toBeUndefined();
});

test('a cluster in the way grows the avoid sphere, and the detour lasts one 200 ms timer',()=>{
 const walker=ped(0,0),a=ped(-.4,2),b=ped(.8,2.2);
 avoid(walker,[walker,a,b],{x:0,z:1},{x:0,z:10});
 // ComputeSphere: centred on the two, as wide as the farther of them from that centre (0.61), not the 1.05 of one.
 expect(Math.abs(walker.avoid.detour.x-.2)).toBeCloseTo(Math.hypot(.6,.1)+1.05,5);
 for(let i=0;i<11;i++)avoid(walker,[walker,a,b],{x:0,z:1},{x:0,z:10});
 expect(walker.avoid).toBeDefined();
 for(let i=0;i<2;i++)avoid(walker,[walker,a,b],{x:0,z:1},{x:0,z:10});
 expect(walker.avoid).toBeUndefined();
});
