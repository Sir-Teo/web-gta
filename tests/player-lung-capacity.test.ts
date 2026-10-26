import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation} from '../src/simulation/Simulation';
import {ScmStats} from '../src/engine/ScmGameState';
import {nativeLungCapacity} from '../src/simulation/nativeLungCapacity';
import {updatePlayerSwim} from '../src/simulation/playerSwim';
import {SWIM} from '../src/simulation/nativeSwim';
beforeAll(async()=>{await RAPIER.init();});
const input={moveMag:0,sprint:false,jump:false,dive:false};
test('a new player starts with the native initial-stat breath capacity',()=>{
 const sim=new Simulation();try{expect(sim.player.breath).toBe(1150);}finally{sim.dispose();}
});
for(const [lung,stamina,capacity] of [[0,100,1150],[500,500,2500],[1000,1000,4000]])test(`reset and dry recovery share capacity ${capacity} from live SCM stats`,()=>{
 const sim=new Simulation(),stats=new ScmStats();stats.set(225,lung);stats.set(22,stamina);
 sim.playerLungCapacity=()=>nativeLungCapacity(stats.get(225),stats.get(22));
 try{
  sim.player.breath=1;sim.player.requireHandleBreath=true;sim.resetPlayer();
  expect(sim.player.breath).toBe(capacity);expect(sim.player.requireHandleBreath).toBe(false);
  sim.player.breath=capacity-1;sim.player.requireHandleBreath=true;sim.beginPlayerBreathFrame(1/50);
  expect(sim.player.breath).toBe(capacity+1);sim.beginPlayerBreathFrame(1/50);expect(sim.player.breath).toBe(capacity+1);
 }finally{sim.dispose();}
});
test('a stat change extends seated breath recovery without refilling the current breath',()=>{
 const sim=new Simulation(),stats=new ScmStats();sim.playerLungCapacity=()=>nativeLungCapacity(stats.get(225),stats.get(22));
 try{
  sim.player.breath=1150;sim.player.requireHandleBreath=true;sim.beginPlayerBreathFrame(1/50);expect(sim.player.breath).toBe(1150);
  stats.set(225,1000);expect(sim.player.breath).toBe(1150);sim.beginPlayerBreathFrame(1/50);expect(sim.player.breath).toBe(1152);
  sim.player.requireHandleBreath=false;sim.handlePlayerBreath(1/50,false);expect(sim.player.breath).toBe(1154);
 }finally{sim.dispose();}
});
test('surface swim recovery uses the supplied native capacity and keeps native overshoot',()=>{
 const sim=new Simulation();try{
  Object.assign(sim.player,{position:{x:0,y:-1.5,z:0},swimming:true,swimState:SWIM.tread,breath:2499});
  updatePlayerSwim(sim.player,{...input,lungCapacity:2500},0,1/50,undefined);expect(sim.player.breath).toBe(2501);
  updatePlayerSwim(sim.player,{...input,lungCapacity:2500},0,1/50,undefined);expect(sim.player.breath).toBe(2501);
 }finally{sim.dispose();}
});
test('initial lungs support ten seconds of underwater breathing before drowning',()=>{
 const sim=new Simulation();try{
  const health=sim.player.health;for(let i=0;i<500;i++){sim.beginPlayerBreathFrame(1/50);sim.handlePlayerBreath(1/50);}
  expect(sim.player.breath).toBe(650);expect(sim.player.health).toBe(health);
 }finally{sim.dispose();}
});
