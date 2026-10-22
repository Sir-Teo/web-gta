import {readFileSync} from 'node:fs';
import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation} from '../src/simulation/Simulation';
import {ScmMission} from '../src/simulation/ScmMission';
import {readScmHeader,decodeScmInstructions} from '../src/assets/scm';
beforeAll(async()=>{await RAPIER.init();});
const controls={x:1,y:1,cameraYaw:0,sprint:true,jump:true,handbrake:false,animationMotion:{x:2,z:3},animationMotionY:1};
function setup(){const sim=new Simulation();sim.respawn={x:0,y:8,z:0};sim.resetPlayer();return sim;}
test('a frozen player retains solid collision and physical position under gravity, impulses, input and animation motion while the world continues',()=>{
 const sim=setup();try{
  sim.playerFrozen=true;sim.player.speed=10;sim.player.verticalSpeed=-30;sim.player.jumpMomentum={x:4,z:5};(sim as any).collisionPush={x:5,z:5};(sim as any).collisionShift={x:1,z:1};sim.playerBody.setNextKinematicTranslation({x:100,y:100,z:100});
  const falling=sim.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(4,15,0));sim.world.createCollider(RAPIER.ColliderDesc.ball(.2),falling);const striker=sim.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(-2,8.9,0).setLinvel(8,0,0).setGravityScale(0));sim.world.createCollider(RAPIER.ColliderDesc.ball(.2),striker);const clock=sim.timeMinutes;
  for(let i=0;i<120;i++)sim.step(1/60,controls);
  expect(sim.player.position.x).toBe(0);expect(sim.player.position.y).toBeCloseTo(8,5);expect(sim.player.position.z).toBe(0);expect(sim.player.speed).toBe(0);expect(sim.player.verticalSpeed).toBe(0);expect(sim.player.jumpMomentum).toEqual({x:0,z:0});expect(sim.playerCollider.isEnabled()).toBe(true);expect(striker.translation().x).toBeLessThan(-.4);expect(falling.translation().y).toBeLessThan(1);expect(sim.timeMinutes).toBeGreaterThan(clock);
  sim.playerFrozen=false;sim.step(1/60,{...controls,x:0,y:0,sprint:false,jump:false,animationMotion:undefined,animationMotionY:undefined});expect(sim.player.position.y).toBeLessThan(7.999);expect(sim.player.verticalSpeed).toBeLessThan(0);
 }finally{sim.dispose();}
});
test('POOL2’s original freeze instruction permits explicit placement while held and later release',()=>{
 const sim=setup();try{
  const bytes=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm')),block=readScmHeader(bytes).missions[8],site=decodeScmInstructions(bytes,block.start,block.end).find(i=>i.offset===374964)!,code=new Uint8Array(site.end-site.offset+2);code.set(bytes.subarray(site.offset,site.end));code.set([78,0],code.length-2);
  const m=new ScmMission(bytes,{infoLabels:['TEST'],population:[]}as any,{setPlayerFrozen:(frozen:boolean)=>{sim.playerFrozen=frozen;}}as any),slot=m.runtime.start(0,[],{space:code,mission:true});slot.thread.usesMissionCleanup=false;slot.thread.locals.setInt32(215*4,1,true);slot.thread.run(1000,100,1);expect(sim.playerFrozen).toBe(true);
  sim.playerBody.setTranslation({x:3,y:5.9,z:4},true);sim.player.position={x:3,y:5,z:4};for(let i=0;i<120;i++)sim.step(1/60,controls);expect(sim.player.position.x).toBe(3);expect(sim.player.position.y).toBeCloseTo(5,5);expect(sim.player.position.z).toBe(4);
  m.runtime.world!.freezePedPosition!(1,false);sim.step(1/60,{...controls,animationMotion:undefined,animationMotionY:undefined});expect(sim.playerFrozen).toBe(false);expect(sim.player.position.y).toBeLessThan(4.999);expect(m.skipped.size).toBe(0);expect(m.gaveUp).toEqual([]);
 }finally{sim.dispose();}
});
