import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';
import reference from '../fixtures/player-sprint-reference.json' with {type:'json'};

test('native sprint budget, exhaustion and positive-energy restart reach real keyboard movement and animation',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const snapshots:any[]=[];
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 await page.waitForFunction(()=>{const g=(window as any).__game;return !g.state().terrainHold&&g.sim.player.grounded&&!!g.state().nativeCharacter;},undefined,{timeout:60000});
 const initial=await page.evaluate(()=>{const g=(window as any).__game,s=g.sim,stats=g.missionForProfiling().runtime.game.stats;stats.set(22,1000);s.resetSprintEnergy();
  const track=(window as any).__sprintEnergy={seed:'',rows:[] as any[],original:s.applyPlayerSprint};
  s.applyPlayerSprint=function(this:any,dt:number,controls:any,mode:number){
   const held=controls.sprintInput??controls.sprint;
   if(track.seed&&mode===0&&held&&Math.hypot(controls.x,controls.y)>0&&!controls.sprintDisabled){
    this.player.stamina=track.seed==='floor'?Math.fround(-149.9):Math.fround(.01);this.player.sprintButtonSpeed=track.seed==='floor'?4:0;track.seed='';track.rows=[];
   }
   const before={energy:this.player.stamina,buttonSpeed:this.player.sprintButtonSpeed},factor=track.original.call(this,dt,controls,mode);
   if(mode===0&&track.rows.length<240)track.rows.push({before,held,justPressed:controls.sprintJustPressed,animationSprint:controls.sprint,timeStep:Math.fround(dt*50),factor,energy:this.player.stamina,buttonSpeed:this.player.sprintButtonSpeed});return factor;
  };return {capacity:s.playerSprintCapacity(),energy:s.player.stamina,minute:s.timeMinutes};});
 snapshots.push({mode:'maximum stat',...initial});expect(initial).toMatchObject({capacity:3150,energy:3150});
 const read=()=>page.evaluate(()=>{const g=(window as any).__game,s=g.sim;return {energy:s.player.stamina,capacity:s.playerSprintCapacity(),buttonSpeed:s.player.sprintButtonSpeed,exhausted:s.player.sprintExhausted,move:s.footMove,speed:s.player.speed,minute:s.timeMinutes,character:g.state().nativeCharacter};});
 try{
  await page.keyboard.down('KeyW');await page.keyboard.down('ShiftLeft');
  await page.waitForFunction(minute=>{const g=(window as any).__game;return (g.sim.timeMinutes-minute+1440)%1440>=2&&g.sim.footMove==='sprint';},initial.minute,{timeout:45000});
  const running=await read();snapshots.push({mode:'running with maximum stat',...running});expect(running.energy).toBeGreaterThan(2950);expect(running.energy).toBeLessThan(3150);expect(running.speed).toBeGreaterThan(7.5);
  await page.evaluate(()=>(window as any).__sprintEnergy.seed='floor');
  await page.waitForFunction(()=>{const t=(window as any).__sprintEnergy;return t.rows.some((r:any)=>r.factor===0&&r.before.energy===-150);},undefined,{timeout:15000});
  const rows=await page.evaluate(()=>(window as any).__sprintEnergy.rows),first=rows[0];
  const captured=reference.cases.find(r=>r.input.mode===0&&r.input.energy===Math.fround(-149.9)&&r.input.buttonSpeed===4&&r.input.timeStep===first.timeStep&&r.input.held&&!r.input.justPressed&&!r.input.vehicle&&!r.input.neverTired&&!r.input.adrenaline&&!r.input.disabled)!;
  expect(captured).toBeDefined();expect({factor:first.factor,energy:first.energy,buttonSpeed:first.buttonSpeed}).toEqual({factor:captured.factor,energy:captured.energy,buttonSpeed:captured.buttonSpeed});
  const exhausted=await read();snapshots.push({mode:'exhausted while held',...exhausted,controller:rows.slice(0,4)});expect(exhausted.exhausted).toBe(true);expect(exhausted.move).not.toBe('sprint');expect(exhausted.energy).toBeGreaterThanOrEqual(-150);expect(exhausted.energy).toBeLessThan(0);
  await page.keyboard.up('ShiftLeft');await page.keyboard.up('KeyW');
  // A newly positive native budget can start another burst; there is no percentage threshold.
  await page.evaluate(()=>{const g=(window as any).__game;g.sim.player.stamina=Math.fround(.01);g.sim.player.sprintButtonSpeed=0;g.sim.player.sprintExhausted=false;g.missionForProfiling().runtime.game.stats.set(22,100);(window as any).__sprintEnergy.seed='restart';});
  await page.keyboard.down('KeyW');await page.keyboard.down('ShiftLeft');
  await page.waitForFunction(()=>{const g=(window as any).__game,t=(window as any).__sprintEnergy;return !t.seed&&t.rows.some((r:any)=>r.factor>=1&&r.energy<0)&&g.sim.footMove==='sprint';},undefined,{timeout:15000});
  const restarted=await read();snapshots.push({mode:'positive-budget restart',...restarted});expect(restarted.capacity).toBe(450);expect(restarted.energy).toBeLessThan(0);expect(restarted.exhausted).toBe(false);
  await page.screenshot({path:'artifacts/player-sprint-energy.png'});
 }finally{
  await page.keyboard.up('ShiftLeft');await page.keyboard.up('KeyW');await page.evaluate(()=>{const g=(window as any).__game,t=(window as any).__sprintEnergy;g.sim.applyPlayerSprint=t.original;});
  writeFileSync('artifacts/player-sprint-energy.json',JSON.stringify({snapshots,errors},null,2));
 }
 expect(errors).toEqual([]);
});
