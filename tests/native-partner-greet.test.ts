import {expect,test} from 'vitest';
import {nativeGreetingTargets,nativeGreetingClips,nativeGreetingPostlude} from '../src/simulation/nativePartnerGreet';
const origin={x:0,y:0,z:0};
test('partners get opposing targets one unit apart around the biased shared centre',()=>{
 expect(nativeGreetingTargets(origin,{x:4,y:0,z:0},.5)).toEqual([{x:1.5,y:0,z:0},{x:2.5,y:0,z:0}]);expect(nativeGreetingTargets(origin,{x:4,y:0,z:0},.25)).toEqual([{x:.5,y:0,z:0},{x:1.5,y:0,z:0}]);
 const points=nativeGreetingTargets(origin,{x:3,y:0,z:4},.5)!;expect(points[0].x).toBeCloseTo(1.2,6);expect(points[0].z).toBeCloseTo(1.6,6);expect(Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y,points[1].z-points[0].z)).toBeCloseTo(1,6);
});
test('native centre corrections move an end-biased point to safety, abort unresolved close pairs and normalize coincident partners',()=>{
 expect(nativeGreetingTargets(origin,{x:4,y:0,z:0},0)).toEqual([{x:.25,y:0,z:0},{x:1.25,y:0,z:0}]);expect(nativeGreetingTargets(origin,{x:4,y:0,z:0},1)).toEqual([{x:2.75,y:0,z:0},{x:3.75,y:0,z:0}]);expect(nativeGreetingTargets(origin,{x:1,y:0,z:0},.5)).toBeUndefined();expect(nativeGreetingTargets(origin,origin,.5)).toEqual([{x:.25,y:0,z:0},{x:1.25,y:0,z:0}]);
});
test('six handshake styles use native gangs clips and the C style chooses the counterpart’s distinct clip',()=>{
 expect(Array.from({length:6},(_,style)=>nativeGreetingClips(style))).toEqual([['hndshkaa','hndshkaa'],['hndshkba','hndshkba'],['hndshkca','hndshkcb'],['hndshkda','hndshkda'],['hndshkea','hndshkea'],['hndshkfa','hndshkfa']]);expect(nativeGreetingClips(-1)).toBeUndefined();expect(nativeGreetingClips(6)).toBeUndefined();
});
test('postlude delays use four 3–7-second native random draws and a fifth bit, with complementary speaker/listener roles',()=>{
 const run=(leader:boolean)=>{const values=[0,16384,32768,65535,1],orders=nativeGreetingPostlude(leader,()=>values.shift()!);expect(values).toEqual([]);return orders.map(o=>({kind:o.kind,seconds:'seconds'in o?o.seconds:undefined}));};
 expect(run(true)).toEqual([{kind:'standStill',seconds:1},{kind:'standStill',seconds:3},{kind:'playAnim',seconds:4},{kind:'standStill',seconds:5},{kind:'playAnim',seconds:6.999}]);expect(run(false)).toEqual([{kind:'standStill',seconds:1},{kind:'playAnim',seconds:3},{kind:'standStill',seconds:4},{kind:'standStill',seconds:5},{kind:'playAnim',seconds:6.999}]);expect(nativeGreetingPostlude(true,()=>0)).toHaveLength(3);
});
