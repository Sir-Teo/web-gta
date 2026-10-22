import {readFileSync} from 'node:fs';
import {afterEach,beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Group,Scene} from 'three';
import {ScmObjects} from '../src/engine/ScmObjects';
import {ScriptObjectViews} from '../src/simulation/ScriptObjectViews';
import {ScmMission} from '../src/simulation/ScmMission';
import {readScmHeader,decodeScmInstructions} from '../src/assets/scm';
import {readObjectData,indexObjectData} from '../src/assets/objectData';
import {SCRIPT_OBJECT_SOLVER_GROUPS} from '../src/simulation/solverGroups';
let world:RAPIER.World;beforeAll(async()=>{await RAPIER.init();});afterEach(()=>{world?.free();world=undefined as any;});
function fixture(){
 world=new RAPIER.World({x:0,y:-9.81,z:0});const objects=new ScmObjects();objects.objectInfo=()=>({mass:10,colDamageEffect:0,colDamageMultiplier:1,smashMultiplier:1,specialCollisionResponse:9});objects.setPoolTableCoords(-1,-.5,.7,1,.5,.7);
 const views=new ScriptObjectViews(new Scene(),'fixture',[],world),hits:{x:number;y:number;z:number}[]=[];views.poolTable=()=>objects.poolTable;views.physicsOf=()=>({turnMass:.003,elasticity:.75,damping:-50*Math.log(.992)});views.onPoolCushion=p=>hits.push(p);
 const create=(x:number,y:number)=>{const object=objects.create('k_poolballcue',{x,y,z:1},{external:false,missionCleanup:false}),body=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x,1,-y));world.createCollider(RAPIER.ColliderDesc.ball(.037),body);(views as any).views.set(object.handle,{model:object.model,group:new Group(),applied:new Float64Array(8),shown:true,physical:{body},collisionOn:true,materials:[],col:{bounds:{radius:.037}}});return{object,body};};
 const tick=(count=1)=>{for(let i=0;i<count;i++){views.update(objects.all,1/60);views.beforePhysics(objects.all,1/60);world.step();views.afterPhysics();}views.update(objects.all,0);};return{objects,views,hits,create,tick};
}
test('static pool balls retain a staged cue shot, stay on their plane and rebound from cushions',()=>{
 const {objects,create,tick,hits}=fixture(),{object,body}=create(.8,.2);tick();expect(body.isDynamic()).toBe(true);expect(body.isSleeping()).toBe(true);expect(body.gravityScale()).toBe(0);
 objects.setVelocity(object.handle,{x:2,y:0,z:0});body.wakeUp();tick(30);expect(object.velocity.x).toBe(.04);expect(object.position.x).toBeCloseTo(.8);expect(body.isSleeping()).toBe(true);
 objects.setDynamic(object.handle,true);tick(10);expect(object.velocity.x).toBeLessThan(0);expect(object.position.z).toBe(1);expect(object.poolBall!.applyGravity).toBe(false);expect(object.lastWeaponDamage).toBe(54);expect(hits.length).toBe(1);
});
test('a struck resting ball wakes and receives horizontal velocity without falling',()=>{
 const {objects,create,tick}=fixture(),a=create(-.3,.2),b=create(0,.2);tick();objects.setVelocity(a.object.handle,{x:2.5,y:0,z:0});objects.setDynamic(a.object.handle,true);tick(12);
 expect(b.object.position.x).toBeGreaterThan(.02);expect(b.object.velocity.x).toBeGreaterThan(0);expect(b.object.isStatic).toBe(false);expect(b.object.position.z).toBe(1);expect(b.body.isDynamic()).toBe(true);
});
test('a side pocket enables gravity, clamps outward travel and stops at the script catch height',()=>{
 const {objects,create,tick,hits}=fixture(),{object,body}=create(0,.48);tick();objects.setVelocity(object.handle,{x:0,y:5,z:0});objects.setDynamic(object.handle,true);tick();expect(object.poolBall!.applyGravity).toBe(true);expect(body.gravityScale()).toBe(1);expect(object.velocity.y).toBeLessThanOrEqual(.036001);expect(hits.length).toBe(1);tick(50);
 expect(object.position.z).toBeCloseTo(.7,6);expect(object.velocity).toEqual({x:0,y:0,z:0});expect(object.turnSpeed).toEqual({x:0,y:0,z:0});expect(body.isSleeping()).toBe(true);
 // Native freeze/teleport do not clear bApplyGravity after a pocket.
 objects.freezePosition(object.handle,true);tick();objects.freezePosition(object.handle,false);object.position.z=1;tick();expect(object.poolBall!.applyGravity).toBe(true);
});
test('rolling balls ignore ordinary physical objects and pocketed balls regain those contacts',()=>{
 const {objects,create,tick}=fixture(),{object}=create(.3,.2),table=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(.5,1,-.2));world.createCollider(RAPIER.ColliderDesc.cuboid(.05,.2,.3).setSolverGroups(SCRIPT_OBJECT_SOLVER_GROUPS),table);
 tick();objects.setVelocity(object.handle,{x:2,y:0,z:0});objects.setDynamic(object.handle,true);tick(12);expect(object.position.x).toBeGreaterThan(.6);expect(object.velocity.x).toBeGreaterThan(0);
 objects.setDynamic(object.handle,false);object.position={x:.5,y:.2,z:1.5};object.poolBall!.applyGravity=true;objects.setVelocity(object.handle,{x:0,y:0,z:0});tick();objects.setDynamic(object.handle,true);tick(90);expect(object.position.z).toBeGreaterThan(1.23);expect(object.position.z).toBeLessThan(1.25);
});
test('cloth contact converts sliding speed into visible rolling rotation',()=>{
 const {objects,create,tick}=fixture(),{object,body}=create(0,.2);tick();objects.setVelocity(object.handle,{x:2,y:0,z:0});objects.setDynamic(object.handle,true);tick(6);
 expect(object.velocity.x).toBeLessThan(.04);expect(object.velocity.x).toBeGreaterThan(.03);expect(object.turnSpeed.y).toBeGreaterThan(.04);expect(body.angvel().z).toBeLessThan(-2);expect(Math.abs(object.matrix!.up.x)).toBeGreaterThan(.05);
});
test('a cushion queues tangential friction and applies its spin on the following control step',()=>{
 const {objects,create,tick}=fixture(),{object}=create(.98,.2);tick();objects.setVelocity(object.handle,{x:5,y:1,z:0});objects.setDynamic(object.handle,true);tick();expect(object.lastWeaponDamage).toBe(54);expect(object.turnSpeed.z).toBeCloseTo(0,8);const tangent=object.velocity.y;
 tick();expect(object.turnSpeed.z).toBeLessThan(-.1);expect(object.velocity.y).toBeLessThan(tangent);
});
test('the original POOL2 table instructions copy their corners unchanged and all 16 native ball definitions select pool physics',()=>{
 const bytes=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm')),header=readScmHeader(bytes),block=header.missions[8],instructions=decodeScmInstructions(bytes,block.start,block.end),m=new ScmMission(bytes,{infoLabels:['TEST'],population:[]}as any,{}as any);
 for(const offset of [368265,390614]){
  const site=instructions.find(i=>i.offset===offset)!,code=new Uint8Array(site.end-site.offset+2);code.set(bytes.subarray(site.offset,site.end));code.set([78,0],code.length-2);const slot=m.runtime.start(0,[],{space:code,mission:true});slot.thread.usesMissionCleanup=false;for(const [index,value]of [[98,3],[100,4],[99,-2],[101,-5]])slot.thread.locals.setFloat32(index*4,value,true);new DataView(m.runtime.scriptSpace.buffer,m.runtime.scriptSpace.byteOffset,m.runtime.scriptSpace.byteLength).setFloat32(300,.7,true);slot.thread.run(1000,100,1);expect(m.runtime.game.objects.poolTable).toEqual({min:{x:3,y:4,z:Math.fround(.7)},max:{x:-2,y:-5,z:Math.fround(.7)}});
 }
 const defs=indexObjectData(readObjectData(readFileSync('public/play/world/files/object.dat','utf8')));m.runtime.game.objects.objectInfo=model=>{const v=defs.get(String(model).toLowerCase())!.values;return{mass:v.mass!,colDamageEffect:0,colDamageMultiplier:1,smashMultiplier:1,specialCollisionResponse:v.specialCollisionResponse};};
 for(let i=105;i<=120;i++){const object=m.runtime.game.objects.create(header.objectNames[i],{x:0,y:0,z:1},{external:false,missionCleanup:false});expect(object.poolBall).toEqual({applyGravity:false});expect(object.mass).toBe(10);}
 expect(m.skipped.size).toBe(0);expect(m.gaveUp).toEqual([]);
});
