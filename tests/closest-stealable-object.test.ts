import {expect,test} from 'vitest';
import {closestStealableObject} from '../src/simulation/nativeClosestStealableObject';
const point={x:0,y:0,z:0},object=(handle:number,x:number,y:number,z:number,stealable=true)=>({handle,position:{x,y,z},stealable});

test('the loot query takes planar candidates, then chooses their nearest 3D origin within twice the radius',()=>{
 expect(closestStealableObject([object(1,0,0,8)],point,5)).toBe(1);
 expect(closestStealableObject([object(1,0,0,10)],point,5)).toBe(-1);
 expect(closestStealableObject([object(1,1,0,7),object(2,4,0,0)],point,5)).toBe(2);
 expect(closestStealableObject([object(1,0,0,0,false)],point,5)).toBe(-1);
});

test('strict float32 planar bounds, first ties and no extra object-state filters match the handler',()=>{
 expect(closestStealableObject([object(1,3,4,0)],point,5)).toBe(-1);
 expect(closestStealableObject([object(1,5-1e-8,0,0)],point,5)).toBe(-1);
 expect(closestStealableObject([object(1,4.999,0,0)],point,5)).toBe(1);
 const held={...object(1,1,0,0),visible:false,usesCollision:false,heldBy:{ped:1}};
 expect(closestStealableObject([held,object(2,-1,0,0)],point,5)).toBe(1);
 for(const radius of [0,-5,NaN])expect(closestStealableObject([object(1,0,0,0)],point,radius)).toBe(-1);
});

test('non-stealable objects consume the sixteen candidate slots; out-of-range objects do not',()=>{
 const clutter=Array.from({length:16},(_,i)=>object(i,1,0,0,false)),loot=object(99,.1,0,0);
 expect(closestStealableObject([...clutter,loot],point,5)).toBe(-1);
 expect(closestStealableObject([...clutter.slice(1),loot],point,5)).toBe(99);
 expect(closestStealableObject([...clutter.map(o=>({...o,position:{x:10,y:0,z:0}})),loot],point,5)).toBe(99);
});
