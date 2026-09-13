import {expect,test} from 'vitest';
import {Matrix4} from 'three';
import {projectShadowReceiver,type ShadowFootprint} from '../src/render/projectShadowReceiver';
import type {ColMesh} from '../src/assets/col';
const footprint:ShadowFootprint={center:{x:0,y:2,z:0},side:{x:1,z:0},front:{x:0,z:1},depth:4};
const mesh=(positions:number[],indices=[0,2,1],lights=[0x35]):ColMesh=>({positions:new Float32Array(positions),indices:new Uint32Array(indices),lights:new Uint8Array(lights),materials:new Uint8Array(lights.length)});
const area=(positions:Float32Array)=>{
 let area=0;for(let i=0;i<positions.length;i+=9)area+=Math.abs((positions[i+3]-positions[i])*(positions[i+8]-positions[i+2])-(positions[i+6]-positions[i])*(positions[i+5]-positions[i+2]))/2;return area;
};
test('clips an oversized receiver to the complete footprint without stretching UVs',()=>{
 const result=projectShadowReceiver(mesh([-10,0,-10,10,0,-10,0,0,20]),new Matrix4(),footprint);
 expect(area(result.positions)).toBeCloseTo(4,6);
 for(let i=0;i<result.positions.length/3;i++){
  expect(result.uvs[i*2]).toBeCloseTo((result.positions[i*3]+1)/2,6);
  expect(result.uvs[i*2+1]).toBeCloseTo((result.positions[i*3+2]+1)/2,6);
  expect(result.lights[i]).toBe(0x35);expect(result.faces[i]).toBe(0);
 }
});
test('clips slope intersections at both vertical depth bounds and preserves the surface plane',()=>{
 const result=projectShadowReceiver(mesh([-10,-10,-10,10,10,-10,0,0,20]),new Matrix4(),{...footprint,center:{x:0,y:.5,z:0},depth:1});
 expect(area(result.positions)).toBeCloseTo(2,6);
 for(let i=0;i<result.positions.length;i+=3){expect(result.positions[i+1]).toBeCloseTo(result.positions[i],6);expect(result.positions[i+1]).toBeGreaterThanOrEqual(-.5);expect(result.positions[i+1]).toBeLessThanOrEqual(.5);}
});
test('transforms native Z-up receiver geometry and retains per-face lighting across shared edges',()=>{
 const source=mesh([-1,-1,0,1,-1,0,1,1,0,-1,1,0],[0,1,2,0,2,3],[0x0f,0xf0]);
 const transform=new Matrix4().makeRotationX(-Math.PI/2);transform.setPosition(2495,12,1687);
 const result=projectShadowReceiver(source,transform,{...footprint,center:{x:2495,y:13,z:1687},side:{x:0,z:1},front:{x:-1,z:0}});
 expect(area(result.positions)).toBeCloseTo(4,6);expect([...new Set(result.lights)]).toEqual([0x0f,0xf0]);
 for(let i=0;i<result.faces.length;i++){expect(result.lights[i]).toBe(result.faces[i]===0?0x0f:0xf0);expect(result.positions[i*3+1]).toBe(12);}
});
test('rejects overhangs, deep receivers, walls, backfaces and empty boundary contacts',()=>{
 for(const source of [mesh([-1,3,-1,1,3,-1,0,3,1]),mesh([-1,-3,-1,1,-3,-1,0,-3,1]),mesh([0,0,-1,0,2,-1,0,0,1]),mesh([-1,0,-1,1,0,-1,0,0,1],[0,1,2]),mesh([1,0,-1,3,0,-1,1,0,1])])expect(projectShadowReceiver(source,new Matrix4(),footprint).positions).toHaveLength(0);
});
test('rejects malformed geometry and fails atomically at its output budget',()=>{
 const source=mesh([-10,0,-10,10,0,-10,0,0,20]);
 expect(()=>projectShadowReceiver(source,new Matrix4(),footprint,3)).toThrow('budget');
 expect(()=>projectShadowReceiver(source,new Matrix4(),{...footprint,front:footprint.side})).toThrow('projection');
 source.indices[0]=99;expect(()=>projectShadowReceiver(source,new Matrix4(),footprint)).toThrow('index');
});
