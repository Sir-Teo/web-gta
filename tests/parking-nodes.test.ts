import {expect,test} from 'vitest';
import {NativeParkingNodeSearch} from '../src/simulation/nativeParkingNodes';
import type {PathArea,PathNode} from '../src/assets/pathNodes';
const node=(x:number,y=5,z=5,behaviour=2)=>({position:[x,y,z],behaviour} as PathNode),area=(nodes:PathNode[],vehicleCount=nodes.length)=>({nodes,vehicleCount} as PathArea),box=[0,0,0,10,10,10] as const;

test('parking nodes cycle through loaded exterior areas and node indices, independently of map insertion order',()=>{
 const search=new NativeParkingNodeSearch(),areas=new Map([[63,area([node(4)])],[5,area([node(2),node(3)])],[0,area([node(1)])],[64,area([node(9)])]]);
 expect(Array.from({length:6},()=>search.find(areas,...box).x)).toEqual([1,2,3,4,1,2]);
});

test('parking scans use strict 3D bounds and behaviour 2 vehicle nodes without switched-off or water filters',()=>{
 const search=new NativeParkingNodeSearch(),nodes=[node(0),node(10),node(5,0),node(5,10),node(5,5,0),node(5,5,10),node(5,5,5,1),{...node(6),switchedOff:true,water:true,deadEnd:true},node(7)],areas=new Map([[0,area(nodes,nodes.length-1)]]);
 expect(search.find(areas,...box)).toEqual({x:6,y:5,z:5});expect(search.find(areas,10,10,10,0,0,0)).toEqual({x:6,y:5,z:5});
});

test('the shared cursor falls back to the first match when a new box is smaller, then resets instead of taking modulo',()=>{
 const search=new NativeParkingNodeSearch(),areas=new Map([[0,area([node(1),node(2),node(3),node(4)])]]);
 expect(search.find(areas,...box).x).toBe(1);expect(search.find(areas,...box).x).toBe(2);expect(search.find(areas,...box).x).toBe(3);
 expect(search.find(areas,0,0,0,2.5,10,10).x).toBe(1);expect(search.find(areas,...box).x).toBe(1);
 search.find(areas,...box);expect(search.find(undefined,...box)).toEqual({x:0,y:0,z:0});expect(search.find(areas,...box).x).toBe(1);
});

test('script bounds narrow to float32 and a degenerate or empty box returns the origin',()=>{
 const search=new NativeParkingNodeSearch(),areas=new Map([[0,area([node(5)])]]);
 expect(search.find(areas,5-1e-8,0,0,10,10,10)).toEqual({x:0,y:0,z:0});expect(search.find(areas,5,0,0,5,10,10)).toEqual({x:0,y:0,z:0});expect(search.find(areas,...box)).toEqual({x:5,y:5,z:5});
});
