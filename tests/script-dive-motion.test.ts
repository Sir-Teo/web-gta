import {readFileSync} from 'node:fs';
import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Vector3} from 'three';
import {Simulation} from './helpers/groundedSimulation';
import {readIfp} from '../src/assets/ifp';
import {rootMotion} from '../src/animation/rootMotion';
import {pedReactionMotion} from '../src/animation/pedReactionMotion';
import {PlayerScriptTasks,type PlayerTaskBody} from '../src/simulation/playerScriptTasks';
beforeAll(async()=>RAPIER.init());
const idle={x:0,y:0,cameraYaw:0,sprint:false,jump:false};
const clip=readIfp(new Uint8Array(readFileSync('public/play/world/files/animations/ped.ifp'))).animations.find(a=>a.name.toLowerCase()==='ev_dive')!;
const motion=rootMotion(clip,{track:clip.tracks.findIndex(t=>t.boneId===0&&!!t.translations)});

test('the installed EV_DIVE root curve moves a knocked-down player, with its lateral shift and nonlinear timing',()=>{
 const sim=new Simulation(),scratch=new Vector3();sim.knockdown=6;
 try{
  const first=pedReactionMotion(motion.delta(0,.5,false,scratch),0);expect(first.z).toBeCloseTo(1.39160147);expect(first.z).not.toBeCloseTo(6.74*.5/clip.duration,1);
  for(let from=0;from<clip.duration;from+=1/60)sim.step(1/60,{...idle,reactionMotion:pedReactionMotion(motion.delta(from,Math.min(clip.duration,from+1/60),false,scratch),0)});
  expect(sim.player.position.z).toBeCloseTo(6.740234375,2);expect(sim.player.position.x).toBeCloseTo(.1025390625,2);expect(sim.knockdown).toBeGreaterThan(0);expect(sim.player.grounded).toBe(true);
 }finally{sim.dispose();}
});

test('reaction displacement uses capsule collision while ordinary pad and walking animation remain suppressed',()=>{
 const sim=new Simulation();sim.knockdown=6;sim.world.createCollider(RAPIER.ColliderDesc.cuboid(10,3,.1).setTranslation(0,3,2));sim.world.step();
 try{
  sim.step(1/60,{...idle,y:1,animationMotion:{x:0,z:1}});expect(sim.player.position.z).toBeCloseTo(0);
  for(let i=0;i<60;i++)sim.step(1/60,{...idle,y:1,animationMotion:{x:10,z:10},reactionMotion:{x:0,z:.1}});
  expect(sim.player.position.x).toBeCloseTo(0);expect(sim.player.position.z).toBeGreaterThan(1.4);expect(sim.player.position.z).toBeLessThan(1.61);expect(sim.animationMovement!.requested.z).toBe(.1);expect(Math.abs(sim.animationMovement!.applied.z)).toBeLessThan(.001);
  const before={time:sim.timeMinutes,position:{...sim.player.position}};expect(()=>sim.step(1/60,{...idle,reactionMotion:{x:NaN,z:0}})).toThrow('Reaction motion must be finite');expect({time:sim.timeMinutes,position:sim.player.position}).toEqual(before);
  sim.player.health=0;sim.step(1/60,{...idle,reactionMotion:{x:1,z:1}});expect(sim.animationMovement!.requested).toEqual({x:0,z:0});
 }finally{sim.dispose();}
});

test('the player turns at the evasive task’s rate before diving and keeps sequence ownership through recovery',()=>{
 let diving=false;const calls:number[][]=[],world={animation:async()=>undefined,placeOnGround:()=>{},dive:(yaw:number,lie:number)=>{calls.push([yaw,lie]);diving=true;return true;},diving:()=>diving},view={hasReaction:()=>true,installReactions:()=>{},playReaction:()=>{},clearReaction:()=>{},reactionName:undefined,reactionDuration:()=>clip.duration,reactionProgress:undefined},body:PlayerTaskBody={position:{x:0,y:0,z:0},heading:0,speed:0,onFoot:true,view},tasks=new PlayerScriptTasks(world);
 tasks.giveSequence([{kind:'diveAndGetUp',x:0,y:1,seconds:1},{kind:'standStill',seconds:2}],false,body);expect(calls).toEqual([]);
 const first=tasks.step(.001,body);expect(first?.kind).toBe('hold');if(first?.kind==='hold')body.heading=first.facing!;expect(body.heading).toBeGreaterThan(0);expect(body.heading).toBeLessThan(.1);expect(calls).toEqual([]);
 for(let i=0;i<100&&!calls.length;i++){const result=tasks.step(.01,body);if(result?.kind==='hold'&&result.facing!==undefined)body.heading=result.facing;}
 expect(calls).toHaveLength(1);expect(calls[0][1]).toBe(1);expect(Math.abs(Math.atan2(Math.sin(calls[0][0]-Math.PI),Math.cos(calls[0][0]-Math.PI)))).toBeLessThanOrEqual(.2);expect(tasks.progress).toBe(0);
 tasks.step(1,body);expect(tasks.progress).toBe(0);diving=false;tasks.step(.01,body);expect(tasks.progress).toBe(1);
});

test('loading a dive clip never starts a replaced task',async()=>{
 let resolve!:(clip:any)=>void,started=0;const world={animation:()=>new Promise<any>(r=>resolve=r),placeOnGround:()=>{},dive:()=>{started++;return true;}},body:PlayerTaskBody={position:{x:0,y:0,z:0},heading:0,speed:0,onFoot:true,view:{hasReaction:()=>false,installReactions:()=>{},playReaction:()=>{},clearReaction:()=>{},reactionName:undefined,reactionDuration:()=>1,reactionProgress:undefined}},tasks=new PlayerScriptTasks(world);
 tasks.give({kind:'diveAndGetUp',x:1,y:0,seconds:1},body);expect(tasks.step(.01,body)).toEqual({kind:'hold'});tasks.give({kind:'standStill',seconds:1},body);resolve(clip);await Promise.resolve();tasks.step(.01,body);expect(started).toBe(0);
});
