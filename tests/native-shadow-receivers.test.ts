import {afterEach,beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {nativeShadowReceivers} from '../src/simulation/nativeShadowReceivers';
import {installNativeCollision} from '../src/simulation/nativeCollision';
import type {InstalledCollisionSource} from '../src/simulation/nativeScene';
import type {ColModel} from '../src/assets/col';
import type {IplInstance} from '../src/assets/ipl';
const footprint={center:{x:2495,y:13,z:1687},side:{x:1,z:0},front:{x:0,z:1},depth:4};
let world:RAPIER.World;
beforeAll(async()=>RAPIER.init());afterEach(()=>world?.free());
function setup(){world=new RAPIER.World({x:0,y:0,z:0});return new Map<number,InstalledCollisionSource>();}
function add(sources:Map<number,InstalledCollisionSource>,x=2495,light=0x35){
 const placement:IplInstance={modelId:1,modelName:'floor',instanceType:0,interior:0,position:[x,-1687,12],rotation:[0,0,0,1],lodIndex:-1};
 const model={spheres:[],boxes:[],mesh:{positions:new Float32Array([-2,-2,0,2,-2,0,2,2,0,-2,2,0]),indices:new Uint32Array([0,1,2,0,2,3]),materials:new Uint8Array([1,1]),lights:new Uint8Array([light,light])}} as unknown as ColModel;
 const installed=installNativeCollision(world,model,placement);
 installed.sources.forEach((source,handle)=>sources.set(handle,{source,placement,modelName:'floor',entityKind:'building'}));
 return installed;
}
test('spatially selects placed native meshes and excludes distant, unknown, sensor and moving geometry',()=>{
 const sources=setup();const near=add(sources);add(sources,2595);
 const sensor=add(sources),moving=add(sources),unknown=add(sources);
 world.getCollider([...sensor.sources.keys()][0]).setSensor(true);
 moving.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased,true);
 sources.delete([...unknown.sources.keys()][0]);world.step();
 const result=nativeShadowReceivers(world,sources,footprint);
 expect(result.candidateCount).toBe(1);expect(result.triangleCount).toBe(2);expect(result.chunks).toHaveLength(1);
 expect(result.chunks[0].handle).toBe([...near.sources.keys()][0]);expect(result.vertexCount).toBeGreaterThan(0);
 for(let i=0;i<result.vertexCount;i++){expect(result.chunks[0].geometry.positions[i*3+1]).toBe(12);expect(result.chunks[0].geometry.lights[i]).toBe(0x35);}
 near.dispose();world.step();expect(nativeShadowReceivers(world,sources,footprint).chunks).toHaveLength(0);
});
test('enforces combined candidate, input-triangle and output-vertex budgets without truncation',()=>{
 const sources=setup();add(sources,2495,0x0f);add(sources,2495,0xf0);world.step();
 const all=nativeShadowReceivers(world,sources,footprint);expect(all.chunks).toHaveLength(2);
 expect(all.chunks.map(c=>c.geometry.lights[0])).toEqual([0x0f,0xf0]);
 expect(()=>nativeShadowReceivers(world,sources,footprint,{candidates:1})).toThrow('candidate budget');
 expect(()=>nativeShadowReceivers(world,sources,footprint,{triangles:3})).toThrow('triangle budget');
 expect(()=>nativeShadowReceivers(world,sources,footprint,{vertices:all.vertexCount-1})).toThrow('vertex budget');
 expect(nativeShadowReceivers(world,sources,footprint,{vertices:all.vertexCount}).vertexCount).toBe(all.vertexCount);
 expect(()=>nativeShadowReceivers(world,sources,footprint,{triangles:NaN})).toThrow('budget');
});
