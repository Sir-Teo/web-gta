import {readFileSync} from 'node:fs';
import {afterEach,beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Group,Scene} from 'three';
import {ScmObjects} from '../src/engine/ScmObjects';
import {ScriptObjectViews} from '../src/simulation/ScriptObjectViews';
import {ScmMission} from '../src/simulation/ScmMission';
import {readScmHeader,decodeScmInstructions} from '../src/assets/scm';
import {readImgEntry,readImgIndex} from '../src/assets/img';
import {readObjectData,indexObjectData} from '../src/assets/objectData';
let world:RAPIER.World;beforeAll(async()=>{await RAPIER.init();});afterEach(()=>{world?.free();world=undefined as any;});
function fixture(response=7){
 world=new RAPIER.World({x:0,y:-9.81,z:0});const objects=new ScmObjects();objects.objectInfo=()=>({mass:5,colDamageEffect:0,colDamageMultiplier:1,smashMultiplier:1,specialCollisionResponse:response});
 const object=objects.create('door',{x:0,y:0,z:0},{external:false,missionCleanup:false}),views=new ScriptObjectViews(new Scene(),'fixture',[],world),body=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());world.createCollider(RAPIER.ColliderDesc.cuboid(1,1,.08).setTranslation(1,1,0),body);
 (views as any).views.set(object.handle,{model:'door',group:new Group(),applied:new Float64Array(8),shown:true,physical:{body},collisionOn:true,materials:[]});views.physicsOf=()=>({turnMass:5,elasticity:.1,damping:-50*Math.log(.98)});
 const tick=(count=1)=>{for(let i=0;i<count;i++){views.update(objects.all,1/60);world.step();}views.update(objects.all,0);};return{objects,object,views,body,tick};
}
test('unlocking keeps a hinge asleep until contact, permits angular motion and retains its anchored solid collision',()=>{
 const {objects,object,body,tick}=fixture();tick();expect(body.isKinematic()).toBe(true);objects.lockDoor(object.handle,false);tick(20);expect(body.isDynamic()).toBe(true);expect(body.isSleeping()).toBe(true);expect(object.door!.startAngle).toBe(-1001);
 const striker=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(1.5,1,1).setLinvel(0,0,-8).setGravityScale(0));world.createCollider(RAPIER.ColliderDesc.ball(.2).setMass(5),striker);tick(15);
 expect(Math.abs(object.heading)).toBeGreaterThan(.05);expect(object.door!.startAngle).toBeCloseTo(0);expect(body.translation()).toEqual({x:0,y:0,z:0});expect(body.collider(0).isEnabled()).toBe(true);
 objects.lockDoor(object.handle,true);tick();expect(object.heading).toBeCloseTo(0);expect(object.velocity).toEqual({x:0,y:0,z:0});expect(object.turnSpeed).toEqual({x:0,y:0,z:0});expect(body.isKinematic()).toBe(true);
});
test('an opened lock door closes under its native spring and relocks; a swing door stays unlocked',()=>{
 for(const response of [7,6]){
  const {objects,object,body,tick}=fixture(response);objects.lockDoor(object.handle,false);tick();object.door!.startAngle=0;body.setRotation({x:0,y:Math.sin(.8/2),z:0,w:Math.cos(.8/2)},true);tick();expect(object.door!.open).toBe(true);expect(body.angvel().y).toBeLessThan(0);tick(1200);
  expect(Math.abs(object.heading)).toBeLessThan(.011);expect(object.isStatic).toBe(true);expect(object.doorLocked).toBe(response===7);world.free();world=undefined as any;
 }
});
test('hinge travel rebounds at 108 degrees and keeps an arbitrary wrapped home heading',()=>{
 const {objects,object,body,tick}=fixture(6);object.heading=3;objects.lockDoor(object.handle,false);tick();object.door!.startAngle=3;
 const angle=3+2;body.setRotation({x:0,y:Math.sin(angle/2),z:0,w:Math.cos(angle/2)},true);body.setAngvel({x:0,y:2,z:0},true);tick(0);
 let heading=object.heading;if(heading<0)heading+=Math.PI*2;expect(heading-3).toBeCloseTo(Math.PI*.6);expect(body.angvel().y).toBeCloseTo(-.4);expect(body.translation()).toEqual({x:0,y:0,z:0});
 objects.lockDoor(object.handle,true);tick();expect(object.heading).toBeCloseTo(3);
});
test('the original GF_DATE array operands unlock and relock all seven original door models',async()=>{
 const bytes=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm')),header=readScmHeader(bytes),img=new Blob([readFileSync('public/play/world/files/scripts/script.img')]),entry=(await readImgIndex(img)).find(e=>e.name==='gf_date.scm')!,space=await readImgEntry(img,entry),sites=decodeScmInstructions(space,0,header.streamed.find(s=>s.name==='GF_DATE')!.size).filter(i=>i.opcode===0x905),defs=indexObjectData(readObjectData(readFileSync('public/play/world/files/object.dat','utf8'))),m=new ScmMission(bytes,{infoLabels:['TEST'],population:[]} as any,{} as any),objects=m.runtime.game.objects;
 objects.objectInfo=model=>{const v=defs.get(String(model).toLowerCase())!.values;return{mass:v.mass!,colDamageEffect:0,colDamageMultiplier:1,smashMultiplier:1,specialCollisionResponse:v.specialCollisionResponse};};
 const globals=new DataView(m.runtime.scriptSpace.buffer,m.runtime.scriptSpace.byteOffset,m.runtime.scriptSpace.byteLength);
 for(let index=0;index<7;index++){
  const name=header.objectNames[[51,53,54,55,52,51,56][index]],object=objects.create(name,{x:0,y:0,z:0},{external:false,missionCleanup:false});expect(object.doorLocked).toBe(true);object.heading=.7;object.door!.startAngle=.2;object.turnSpeed={x:1,y:2,z:3};globals.setInt32(1556,index,true);globals.setInt32(4968+index*4,object.handle,true);
  for(const site of sites){const code=new Uint8Array(site.end-site.offset+2);code.set(space.subarray(site.offset,site.end));code.set([78,0],code.length-2);const slot=m.runtime.start(0,[],{space:code,mission:true});slot.thread.usesMissionCleanup=false;slot.thread.run(1000,100,1);if(site.offset===4219){expect(object.doorLocked).toBe(false);expect(object.heading).toBe(.7);}else{expect(object.doorLocked).toBe(true);expect(object.heading).toBe(.2);}expect(object.turnSpeed).toEqual({x:0,y:0,z:0});}
 }
 expect(m.skipped.size).toBe(0);expect(m.gaveUp).toEqual([]);
});

test('HEIST1 locks its original interior swing door without resetting its authored rotation before first movement',()=>{
 const bytes=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm')),block=readScmHeader(bytes).missions[96],ins=decodeScmInstructions(bytes,block.start,block.end),first=ins.find(i=>i.offset===2281943)!,last=ins.find(i=>i.opcode===0x905)!,code=new Uint8Array(last.end-first.offset+2);code.set(bytes.subarray(first.offset,last.end));code.set([78,0],code.length-2);const m=new ScmMission(bytes,{infoLabels:['TEST'],population:[]} as any,{} as any);m.runtime.game.objects.objectInfo=()=>({mass:5,colDamageEffect:0,colDamageMultiplier:1,smashMultiplier:1,specialCollisionResponse:6});const slot=m.runtime.start(0,[],{space:code,mission:true});slot.thread.usesMissionCleanup=false;slot.thread.run(1000,100,1);const object=m.runtime.game.objects.at(slot.thread.locals.getInt32(111*4,true));expect(String(object.model).toLowerCase()).toBe('gen_doorint01');expect(object.doorLocked).toBe(true);expect(object.door!.startAngle).toBe(-1001);expect(object.heading).toBeCloseTo(Math.PI/2);expect(m.skipped.size).toBe(0);expect(m.gaveUp).toEqual([]);
});
