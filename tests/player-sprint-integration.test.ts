import {afterEach,beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation,type Controls} from './helpers/groundedSimulation';
import {nativeSprintCapacity,SPRINT_MODE} from '../src/simulation/nativePlayerSprint';
beforeAll(async()=>{await RAPIER.init();});
let sim:Simulation;afterEach(()=>sim?.dispose());
const run:Controls={x:0,y:-1,sprint:true,jump:false,cameraYaw:0};
test('initial sprint energy uses the captured stat modifier rather than a percentage',()=>{
 sim=new Simulation();expect(sim.player.stamina).toBe(450);expect(sim.player.sprintButtonSpeed).toBe(0);
 sim.playerSprintCapacity=()=>nativeSprintCapacity(1000);sim.resetSprintEnergy();expect(sim.player.stamina).toBe(3150);
});
test('animation previews spend no energy and the simulation commits the same result once',()=>{
 sim=new Simulation();const before={energy:sim.player.stamina,speed:sim.player.sprintButtonSpeed};
 const first=sim.previewPlayerSprint(1/50,run),second=sim.previewPlayerSprint(1/50,run);
 expect(first).toEqual(second);expect({energy:sim.player.stamina,speed:sim.player.sprintButtonSpeed}).toEqual(before);
 expect(first).toEqual({energy:449,buttonSpeed:4,factor:1});sim.step(1/50,run);
 expect(sim.player.stamina).toBe(first.energy);expect(sim.player.sprintButtonSpeed).toBe(first.buttonSpeed);
 // The character's output may choose a different move state; the physical pad remains independently held.
 sim.step(1/50,{...run,sprint:false,sprintInput:true});expect(sim.player.stamina).toBe(448);
});
test('a native walk-start association recovers after the sprint request, using its final move state',()=>{
 sim=new Simulation();sim.step(1/50,{...run,sprint:false,sprintInput:true,animationMotion:{x:0,z:0},animationMotionSpace:'world'});
 expect(sim.player.stamina).toBe(449.5);expect(sim.footMove).toBe('still');expect(sim.player.sprintButtonSpeed).toBe(4);
});
test('a released sprint retains native button memory until it decays',()=>{
 sim=new Simulation();sim.step(1/50,run);sim.step(1/50,{...run,sprint:false});
 expect(sim.footMove).toBe('sprint');expect(sim.player.stamina).toBe(448);expect(sim.player.sprintButtonSpeed).toBe(Math.fround(4-Math.fround(.2)));
});
test('the floor-reaching call still sprints, then the next call fails and running recovers',()=>{
 sim=new Simulation();sim.player.stamina=Math.fround(-149.9);sim.player.moveBlend=1.8;sim.player.sprintButtonSpeed=4;sim.player.sprintInputHeld=true;
 sim.step(1/50,run);expect(sim.player.stamina).toBe(-150);expect(sim.footMove).toBe('sprint');expect(sim.player.sprintExhausted).toBe(false);
 sim.step(1/50,run);expect(sim.footMove).toBe('run');expect(sim.player.sprintButtonSpeed).toBe(0);expect(sim.player.stamina).toBe(Math.fround(-150+Math.fround(.15)));expect(sim.player.sprintExhausted).toBe(true);
});
test('current stamina stats extend the budget without refilling an existing one',()=>{
 sim=new Simulation();let stat=100;sim.playerSprintCapacity=()=>nativeSprintCapacity(stat);sim.player.stamina=200;
 stat=1000;expect(sim.player.stamina).toBe(200);sim.resetSprintEnergy();
 for(let i=0;i<50;i++)sim.step(1/50,run);expect(sim.player.stamina).toBe(3100);
});
test('blocking sprint keeps the resource recovery path without spending through animation intent',()=>{
 sim=new Simulation();sim.player.stamina=400;sim.player.sprintButtonSpeed=4;
 sim.step(1/50,{...run,sprintDisabled:true});expect(sim.footMove).toBe('still');expect(sim.player.stamina).toBe(400.5);
});
test('underwater non-positive energy follows the native 0.1 reset and zero-cost row',()=>{
 sim=new Simulation();Object.assign(sim.player,{swimming:true,swimState:4,stamina:-150,sprintButtonSpeed:0});
 const preview=sim.previewPlayerSprint(1/50,run,SPRINT_MODE.underwater);expect(preview.energy).toBe(Math.fround(.1));expect(preview.factor).toBe(1);
 sim.step(1/50,{...run,swimWater:10});expect(sim.player.stamina).toBe(Math.fround(Math.fround(.1)+.5));
});
test('water input keeps its own controller instead of the ground task heavy/surface gate',()=>{
 sim=new Simulation();
 const input={...run,sprintDisabled:true};
 expect(sim.previewPlayerSprint(1/50,input,SPRINT_MODE.ground).factor).toBe(0);
 expect(sim.previewPlayerSprint(1/50,input,SPRINT_MODE.water).factor).toBe(1);
 sim.player.stamina=-1;sim.player.sprintButtonSpeed=4;
 expect(sim.previewPlayerSprint(1/50,{...input,playerSprintDisabled:true},SPRINT_MODE.water).factor).toBe(0);
});
test('the non-arm gun movement task does not run the ground sprint controller',()=>{
 sim=new Simulation();sim.player.stamina=400;
 const controls={...run,gunMove:{aimWithArm:false,moveAim:true,moveFire:true,firing:true,moveSpeed:1}};
 expect(sim.previewPlayerSprint(1/50,controls).factor).toBe(0);sim.step(1/50,controls);
 expect(sim.player.stamina).toBe(400.5);expect(sim.player.sprintButtonSpeed).toBe(0);
});
