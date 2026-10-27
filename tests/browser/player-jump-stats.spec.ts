import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';
import reference from '../fixtures/player-jump-stats-reference.json' with {type:'json'};

test('real jumps latch launch playback then read current body stats for captured physical impulse',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const snapshots:any[]=[];
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 await page.waitForFunction(()=>{const g=(window as any).__game;return !g.state().terrainHold&&g.sim.player.grounded&&g.render().nativeCharacter?.currentAction==='idle';},undefined,{timeout:60000});
 await page.evaluate(()=>{
  const g=(window as any).__game,c=g.render().nativeCharacter,s=g.sim,stats=g.missionForProfiling().runtime.game.stats;
  const t=(window as any).__jumpStats={character:c,characterStep:c.step,simStep:s.step,collisionMove:s.character.computeColliderMovement,launching:false,requestedMomentum:null as any,stage:'',rows:[] as any[],physical:[] as any[],changed:false,landed:false,complete:false,nextFat:0,nextMuscle:0};
  s.character.computeColliderMovement=function(this:any,...args:any[]){if(t.launching&&!t.requestedMomentum)t.requestedMomentum={...s.player.jumpMomentum};return t.collisionMove.apply(this,args);};
  c.step=function(this:any,dt:number,controls:any,sim:any){
   const result=t.characterStep.call(this,dt,controls,sim),snap=this.snapshot();
   if(t.stage&&/^launch/.test(snap.action)){
    t.rows.push({dt,action:snap.action,speed:snap.playbackSpeed,seconds:snap.seconds,fat:stats.get(21),muscle:stats.get(23),modifier:sim.playerBodyMovementModifier()});
    if(!t.changed){t.changed=true;stats.set(21,t.nextFat);stats.set(23,t.nextMuscle);}
   }
   if(t.stage&&/^landing/.test(snap.action))t.landed=true;else if(t.stage&&t.landed)t.complete=true;
   return result;
  };
  s.step=function(this:any,dt:number,controls:any){
   const launching=t.stage&&controls.jump&&this.player.grounded,before={fat:stats.get(21),muscle:stats.get(23),modifier:this.playerBodyMovementModifier()};
   t.launching=!!launching;t.requestedMomentum=null;
   const result=t.simStep.call(this,dt,controls);
   t.launching=false;
   if(launching&&this.jumpLaunched&&!this.player.grounded)t.physical.push({...before,dt,velocity:this.player.verticalSpeed,requestedMomentum:t.requestedMomentum,momentum:{...this.player.jumpMomentum},grounded:this.player.grounded});
   return result;
  };
 });
 try{
  for(const profile of [{fat:1000,muscle:1000,nextFat:0,nextMuscle:0},{fat:0,muscle:0,nextFat:1000,nextMuscle:1000}]){
   await page.evaluate(profile=>{const g=(window as any).__game,t=(window as any).__jumpStats,stats=g.missionForProfiling().runtime.game.stats;stats.set(21,profile.fat);stats.set(23,profile.muscle);Object.assign(t,{stage:`${profile.fat}/${profile.muscle}`,rows:[],physical:[],changed:false,landed:false,complete:false,nextFat:profile.nextFat,nextMuscle:profile.nextMuscle});},profile);
   await page.keyboard.press('Space');await page.waitForFunction(()=>(window as any).__jumpStats.complete,undefined,{timeout:30000});
   const result=await page.evaluate(()=>{const t=(window as any).__jumpStats;t.stage='';return {rows:t.rows,physical:t.physical};});snapshots.push({profile,...result});
   const start=reference.starts.find(r=>r.input.player&&r.input.fat===profile.fat&&r.input.muscle===profile.muscle)!;
   const launch=reference.launches.find(r=>r.input.player&&r.input.fat===profile.nextFat&&r.input.muscle===profile.nextMuscle&&!r.input.megaJump&&!r.input.climbJump&&r.input.run===null&&r.input.sprint===null)!;
   expect(result.rows.length).toBeGreaterThan(1);expect(result.rows.every((r:any)=>r.speed===start.speed)).toBe(true);
   expect(result.rows.some((r:any)=>r.modifier!==r.speed)).toBe(true);expect(result.physical).toHaveLength(1);
   const actual=result.physical[0];expect(actual).toMatchObject({fat:profile.nextFat,muscle:profile.nextMuscle,grounded:false});
   expect(actual.velocity).toBeCloseTo(launch.velocity[2]*50-20*actual.dt,6);
   expect(Math.hypot(actual.requestedMomentum.x,actual.requestedMomentum.z)).toBeCloseTo(launch.velocity[1]*50,6);
   expect(Math.hypot(actual.momentum.x,actual.momentum.z)).toBeLessThanOrEqual(launch.velocity[1]*50+1e-6);
  }
  await page.screenshot({path:'artifacts/player-jump-stats.png'});
 }finally{
  await page.keyboard.up('Space');await page.evaluate(()=>{const g=(window as any).__game,t=(window as any).__jumpStats;t.character.step=t.characterStep;g.sim.step=t.simStep;g.sim.character.computeColliderMovement=t.collisionMove;const stats=g.missionForProfiling().runtime.game.stats;stats.set(21,0);stats.set(23,0);});
  writeFileSync('artifacts/player-jump-stats.json',JSON.stringify({snapshots,errors},null,2));
 }
 expect(errors).toEqual([]);
});
