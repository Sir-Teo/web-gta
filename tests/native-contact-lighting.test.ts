import {afterEach,beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {nativeContactBrightness,nativeContactLightMultiplier,sampleNativeGroundLighting} from '../src/simulation/nativeContactLighting';
import type {InstalledCollisionSource} from '../src/simulation/nativeScene';
let world:RAPIER.World|undefined;
beforeAll(async()=>RAPIER.init());afterEach(()=>{world?.free();world=undefined;});
test('packed contact lighting blends day/night nibbles at half intensity',()=>{
 expect(nativeContactBrightness(0x0f,0)).toBe(.5);expect(nativeContactBrightness(0x0f,1)).toBe(0);
 expect(nativeContactBrightness(0xf0,.5)).toBe(.25);expect(nativeContactBrightness(0xff,.3)).toBeCloseTo(.5);
 expect(nativeContactLightMultiplier([.3,.3,.3],.2)).toBeCloseTo(.525);
 expect(nativeContactLightMultiplier([0,0,0],0)).toBeCloseTo(.05);
 for(const [byte,night] of [[256,0],[-1,0],[1,.5+1],[0,NaN]])expect(()=>nativeContactBrightness(byte,night)).toThrow();
 expect(()=>nativeContactLightMultiplier([NaN,0,0],.5)).toThrow();
});
test('support query uses the nearest known surface and does not see through unknown geometry',()=>{
 world=new RAPIER.World({x:0,y:0,z:0});
 const floor=world.createCollider(RAPIER.ColliderDesc.cuboid(2,.1,2).setTranslation(0,-.1,0));
 const player=world.createCollider(RAPIER.ColliderDesc.capsule(.55,.3).setTranslation(0,.9,0));
 const sources=new Map<number,InstalledCollisionSource>([[floor.handle,{modelName:'ground',placement:{} as any,entityKind:'building',source:{kind:'box',index:0,surface:{material:1,flags:0,brightness:0,light:0xa5}}}]]);
 world.step();expect(sampleNativeGroundLighting(world,{x:0,y:.05,z:0},player,sources)).toEqual({material:1,light:0xa5,modelName:'ground',faceIndex:undefined});
 expect(sampleNativeGroundLighting(world,{x:0,y:2,z:0},player,sources)).toBeUndefined();
 const obstacle=world.createCollider(RAPIER.ColliderDesc.cuboid(1,.02,1).setTranslation(0,.08,0));world.step();
 expect(sampleNativeGroundLighting(world,{x:0,y:.05,z:0},player,sources)).toBeUndefined();
 obstacle.setSensor(true);world.step();expect(sampleNativeGroundLighting(world,{x:0,y:.05,z:0},player,sources)?.light).toBe(0xa5);
});

test('ground mesh hits preserve distinct source triangle lighting bytes',()=>{
 world=new RAPIER.World({x:0,y:0,z:0});
 const mesh={positions:new Float32Array([-3,0,-2,-1,0,-2,-2,0,2,1,0,-2,3,0,-2,2,0,2]),indices:new Uint32Array([0,2,1,3,5,4]),materials:new Uint8Array([1,2]),lights:new Uint8Array([0x0f,0xf0])};
 const floor=world.createCollider(RAPIER.ColliderDesc.trimesh(mesh.positions,mesh.indices));
 const player=world.createCollider(RAPIER.ColliderDesc.ball(.2).setTranslation(0,1,0));
 const sources=new Map<number,InstalledCollisionSource>([[floor.handle,{modelName:'split',placement:{} as any,entityKind:'building',source:{kind:'mesh',mesh}}]]);
 world.step();
 expect(sampleNativeGroundLighting(world,{x:-2,y:.05,z:0},player,sources)).toEqual({material:1,light:0x0f,modelName:'split',faceIndex:0});
 expect(sampleNativeGroundLighting(world,{x:2,y:.05,z:0},player,sources)).toEqual({material:2,light:0xf0,modelName:'split',faceIndex:1});
});
