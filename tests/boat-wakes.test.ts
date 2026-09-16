import {expect,test} from 'vitest';
import {Scene} from 'three';
import {WAKE} from '../src/simulation/nativeBuoyancy';
import {BoatWakes,wakeAlpha,wakeWidth} from '../src/render/BoatWakes';
import type {WorldBoat} from '../src/simulation/WorldBoat';

test('wake widths grow with age and speed; alphas fade along the trail',()=>{
 const width=wakeWidth(2,WAKE.lifetime,10);
 expect(wakeWidth(2,WAKE.lifetime-75,10)).toBeGreaterThan(width);
 expect(wakeWidth(2,WAKE.lifetime-75,50)).toBeGreaterThan(wakeWidth(2,WAKE.lifetime-75,10));
 // Newest point is transparent (preserved source behavior); the tail fades out.
 expect(wakeAlpha(0,8,50,10)).toBe(0);
 expect(wakeAlpha(7,8,50,10)).toBeGreaterThan(0);
 expect(wakeAlpha(4,8,50,10)).toBeGreaterThan(wakeAlpha(6,8,50,10));
 expect(wakeAlpha(4,8,10,10)).toBeLessThan(wakeAlpha(4,8,50,10));
 expect(wakeAlpha(4,8,50,70)).toBeLessThan(wakeAlpha(4,8,50,10));
});

const rig=(coords:{x:number;y:number}[]):WorldBoat=>({
 wake:{coords,speeds:coords.map(()=>50),counters:coords.map(()=>WAKE.lifetime)},
 body:{translation:()=>({x:0,y:0,z:-60}),rotation:()=>({x:0,y:0,z:0,w:1})},
 assets:{collision:{bounds:{max:[2,3,1],min:[-2,-3,-1]}}},
}) as unknown as WorldBoat;

test('trails behind the stern ribbon the oldest segment, nothing without a trail',()=>{
 const scene=new Scene(),wakes=new BoatWakes(scene);
 const water={level:0,calls:0};
 try{
  wakes.update([rig([{x:0,y:60},{x:0,y:66},{x:0,y:72}])],{waterLevel:() => 0,camera:{x:0,z:-40},windClipped:.5,elapsedMs:1000});
  const drawn=wakes.snapshot().vertices;
  expect(drawn).toBe(2*4*6);
  expect(wakes.mesh.visible).toBe(true);
  const alpha=wakes.mesh.geometry.getAttribute('color') as unknown as {array:Float32Array};
  // Newest edge transparent per the preserved 0th-point rule.
  expect(alpha.array[3]).toBe(0);
  expect(Math.max(...alpha.array.filter((_,i)=>i%4===3))).toBeGreaterThan(0);
  expect(water.calls).toBe(0);
  // Single points and empty trails draw nothing.
  wakes.update([rig([{x:0,y:60}])],{waterLevel:() => 0,camera:{x:0,z:-40},windClipped:0,elapsedMs:2000});
  expect(wakes.snapshot().vertices).toBe(0);
  expect(wakes.mesh.visible).toBe(false);
  wakes.update([],{waterLevel:() => 0,camera:{x:0,z:-40},windClipped:0,elapsedMs:3000});
  expect(wakes.snapshot().vertices).toBe(0);
 }finally{wakes.dispose();}
});
