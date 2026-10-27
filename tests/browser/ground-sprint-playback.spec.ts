import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('keyboard sprint taps accelerate extracting root travel then ease back while held',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const snapshots:any[]=[];
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 await page.waitForFunction(()=>{const g=(window as any).__game;return !g.state().terrainHold&&g.sim.player.grounded&&!!g.state().nativeCharacter;},undefined,{timeout:60000});
 await page.evaluate(()=>{const g=(window as any).__game,s=g.sim,t=(window as any).__sprintPlayback={stage:'',rows:[] as any[],original:s.step};
  s.step=function(this:any,dt:number,controls:any){const result=t.original.call(this,dt,controls);if(t.stage){const a=g.state().nativeCharacter.moves?.find((a:any)=>a.clip==='sprint');t.rows.push({stage:t.stage,dt,root:Math.hypot(controls.animationMotion?.x??0,controls.animationMotion?.z??0),buttonSpeed:this.player.sprintButtonSpeed,playback:a?.speed});}return result;};
 });
 const read=()=>page.evaluate(()=>{const g=(window as any).__game,s=g.sim;return {buttonSpeed:s.player.sprintButtonSpeed,energy:s.player.stamina,speed:s.player.speed,minute:s.timeMinutes,character:g.state().nativeCharacter};});
 try{
  await page.keyboard.down('KeyW');await page.keyboard.down('ShiftLeft');
  await page.waitForFunction(()=>{const g=(window as any).__game,s=g.sim,a=g.state().nativeCharacter.moves?.find((a:any)=>a.clip==='sprint');return a?.blend===1&&a.speed===1&&s.player.sprintButtonSpeed===1;},undefined,{timeout:45000});
  const normalStart=await page.evaluate(()=>{(window as any).__sprintPlayback.stage='normal';return (window as any).__game.sim.timeMinutes;});
  await page.waitForFunction(start=>((window as any).__game.sim.timeMinutes-start+1440)%1440>=2,normalStart);
  snapshots.push({stage:'ordinary held sprint',...await read()});
  // Native button memory decays 35 units per game second. Slow the game through
  // its ordinary SCM time-scale adapter so software rendering does not execute
  // six fixed steps between key edges. Schedule DOM key edges on render frames.
  // These enter Input's ordinary window listeners; no pad/controller output is seeded.
  const rows=await page.evaluate(()=>new Promise<any[]>(resolve=>{
   const g=(window as any).__game,t=(window as any).__sprintPlayback,start=g.sim.timeMinutes;let held=true;
   g.missionForProfiling().runtime.world.setTimeScale(.1);t.stage='tapped';
   const key=(down:boolean)=>document.querySelector('canvas')!.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{code:'ShiftLeft',key:'Shift',shiftKey:down,bubbles:true}));
   const tap=()=>{held=!held;key(held);if((g.sim.timeMinutes-start+1440)%1440>=2){if(!held)key(true);t.stage='';g.missionForProfiling().runtime.world.setTimeScale(1);resolve(t.rows);}else requestAnimationFrame(tap);};
   requestAnimationFrame(tap);
  }));
  const speed=(stage:string)=>{const selected=rows.filter((r:any)=>r.stage===stage);return selected.reduce((n:number,r:any)=>n+r.root,0)/selected.reduce((n:number,r:any)=>n+r.dt,0);};
  const ordinary=speed('normal'),tapped=speed('tapped');snapshots.push({stage:'keyboard tapping',...await read(),ordinaryRootSpeed:ordinary,tappedRootSpeed:tapped});
  expect(tapped).toBeGreaterThan(ordinary*1.15);expect(tapped).toBeLessThan(ordinary*1.5);
  const boosted=rows.filter((r:any)=>r.stage==='tapped'&&r.buttonSpeed>5);expect(boosted.length).toBeGreaterThan(10);
  for(const row of boosted){const f=Math.fround;expect(row.playback).toBe(f(1+f(Math.max(0,f(f(row.buttonSpeed/5)-1))*f(.3))));}
  await page.screenshot({path:'artifacts/ground-sprint-playback.png'});
  await page.waitForFunction(()=>{const g=(window as any).__game,a=g.state().nativeCharacter.moves?.find((a:any)=>a.clip==='sprint');return g.sim.player.sprintButtonSpeed===1&&a?.speed===1;},undefined,{timeout:20000});
  snapshots.push({stage:'held decay returns to ordinary sprint',...await read()});
 }finally{
  await page.keyboard.up('ShiftLeft');await page.keyboard.up('KeyW');
  await page.evaluate(()=>{const g=(window as any).__game,t=(window as any).__sprintPlayback;g.sim.step=t.original;g.missionForProfiling().runtime.world.setTimeScale(1);});
  const rows=await page.evaluate(()=>(window as any).__sprintPlayback.rows);
  writeFileSync('artifacts/ground-sprint-playback.json',JSON.stringify({snapshots,rows,errors},null,2));
 }
 expect(errors).toEqual([]);
});
