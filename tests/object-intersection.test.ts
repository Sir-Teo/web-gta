import {afterEach,beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {objectAttachmentsIgnore,objectIntersectsWorld,objectQueryGeometry} from '../src/simulation/nativeObjectIntersection';
import type {ColModel} from '../src/assets/col';
let world:RAPIER.World|undefined;
beforeAll(async()=>{await RAPIER.init();});afterEach(()=>{world?.free();world=undefined;});
const surface={material:0,flags:0,brightness:0,light:0};
const model=(part:Partial<ColModel>):ColModel=>({name:'query',id:1,version:3,flags:0,bounds:{min:[-3,-3,-3],max:[3,3,3],center:[0,0,0],radius:5.2},spheres:[],boxes:[],mesh:{positions:new Float32Array(),indices:new Uint32Array(),materials:new Uint8Array(),lights:new Uint8Array()},shadow:null,faceGroups:[],warnings:[],...part});
const origin={x:0,y:0,z:0},identity={x:0,y:0,z:0,w:1};
const sphere=()=>objectQueryGeometry(model({spheres:[{center:[0,0,0],radius:.5,surface}]}));

test('the current pose query has no touching margin and does not use stale contact records',()=>{
 world=new RAPIER.World(origin);world.createCollider(RAPIER.ColliderDesc.cuboid(1,1,1));world.step();
 expect(objectIntersectsWorld(world,sphere(),{x:1.49,y:0,z:0},identity)).toBe(true);
 expect(objectIntersectsWorld(world,sphere(),{x:1.54,y:0,z:0},identity)).toBe(false);
 expect(objectIntersectsWorld(world,sphere(),{x:20,y:0,z:0},identity)).toBe(false);
});

test('COL offsets rotate with the current native matrix',()=>{
 world=new RAPIER.World(origin);world.createCollider(RAPIER.ColliderDesc.ball(.25).setTranslation(0,0,-2));world.step();
 const g=objectQueryGeometry(model({spheres:[{center:[2,0,0],radius:.5,surface}]}));
 expect(objectIntersectsWorld(world,g,origin,identity)).toBe(false);
 expect(objectIntersectsWorld(world,g,origin,{x:0,y:Math.SQRT1_2,z:0,w:Math.SQRT1_2})).toBe(true);
});

test('native box/box pairs do not produce contacts; a sphere against the same box does',()=>{
 world=new RAPIER.World(origin);world.createCollider(RAPIER.ColliderDesc.cuboid(1,1,1));world.step();
 const g=objectQueryGeometry(model({boxes:[{min:[-.5,-.5,-.5],max:[.5,.5,.5],surface}]}));
 expect(objectIntersectsWorld(world,g,origin,identity)).toBe(false);
 const ball=world.createCollider(RAPIER.ColliderDesc.ball(.25));world.step();
 expect(objectIntersectsWorld(world,g,origin,identity)).toBe(true);
 expect(objectIntersectsWorld(world,g,origin,identity,c=>c.handle===ball.handle)).toBe(false);
});

test('self, sensors and collision-disabled candidates are excluded without moving a body',()=>{
 world=new RAPIER.World(origin);const body=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
 world.createCollider(RAPIER.ColliderDesc.ball(.5),body);world.createCollider(RAPIER.ColliderDesc.ball(1).setSensor(true));
 const wall=world.createCollider(RAPIER.ColliderDesc.ball(1));wall.setEnabled(false);world.step();
 const ignore=(c:RAPIER.Collider)=>c.parent()?.handle===body.handle,before={...body.translation()};
 expect(objectIntersectsWorld(world,sphere(),origin,identity,ignore)).toBe(false);
 wall.setEnabled(true);world.step();expect(objectIntersectsWorld(world,sphere(),origin,identity,ignore)).toBe(true);
 expect(body.translation()).toEqual(before);
});

test('a model triangle can hit the other model sphere, without triangle/triangle fallback',()=>{
 world=new RAPIER.World(origin);world.createCollider(RAPIER.ColliderDesc.ball(.2).setTranslation(0,.1,0));world.step();
 const g=objectQueryGeometry(model({mesh:{positions:new Float32Array([-2,-2,0,2,-2,0,0,2,0]),indices:new Uint32Array([0,1,2]),materials:new Uint8Array([0]),lights:new Uint8Array([0])}}));
 expect(objectIntersectsWorld(world,g,origin,identity)).toBe(true);
});

test('attachment filtering skips parent, child and shared-parent objects without hiding unrelated contacts',()=>{
 expect(objectAttachmentsIgnore(1,{kind:'object',handle:2},2,undefined)).toBe(true);
 expect(objectAttachmentsIgnore(1,undefined,2,{kind:'object',handle:1})).toBe(true);
 expect(objectAttachmentsIgnore(1,{kind:'vehicle',handle:4},2,{kind:'vehicle',handle:4})).toBe(true);
 expect(objectAttachmentsIgnore(1,{kind:'vehicle',handle:4},2,{kind:'ped',handle:4})).toBe(false);
 expect(objectAttachmentsIgnore(1,undefined,2,undefined)).toBe(false);
});
