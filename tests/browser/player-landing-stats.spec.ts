import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';
import reference from '../fixtures/player-landing-reference.json' with {type:'json'};

test('real jumps latch captured body-stat landing playback through later stat changes',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const snapshots:any[]=[];
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 await page.waitForFunction(()=>{const g=(window as any).__game;return !g.state().terrainHold&&g.sim.player.grounded&&g.render().nativeCharacter?.currentAction==='idle';},undefined,{timeout:60000});
 await page.evaluate(()=>{
  const g=(window as any).__game,c=g.render().nativeCharacter,stats=g.missionForProfiling().runtime.game.stats;
  const t=(window as any).__landingStats={original:c.step,character:c,stage:'',rows:[] as any[],changed:false,complete:false,nextFat:0,nextMuscle:0};
  c.step=function(this:any,dt:number,controls:any,sim:any){
   const result=t.original.call(this,dt,controls,sim),s=this.snapshot();
   if(t.stage&&/^landing/.test(s.action)){
    t.rows.push({dt,action:s.action,speed:s.playbackSpeed,seconds:s.seconds,fat:stats.get(21),muscle:stats.get(23),modifier:sim.playerBodyMovementModifier(),grounded:sim.player.grounded});
    if(!t.changed){t.changed=true;stats.set(21,t.nextFat);stats.set(23,t.nextMuscle);}
   }else if(t.stage&&t.rows.length)t.complete=true;
   return result;
  };
 });
 try{
  for(const profile of [{fat:1000,muscle:1000,nextFat:0,nextMuscle:0},{fat:0,muscle:0,nextFat:1000,nextMuscle:1000}]){
   await page.evaluate(profile=>{const g=(window as any).__game,t=(window as any).__landingStats,stats=g.missionForProfiling().runtime.game.stats;stats.set(21,profile.fat);stats.set(23,profile.muscle);Object.assign(t,{stage:`${profile.fat}/${profile.muscle}`,rows:[],changed:false,complete:false,nextFat:profile.nextFat,nextMuscle:profile.nextMuscle});},profile);
   await page.keyboard.press('Space');
   await page.waitForFunction(()=>(window as any).__landingStats.complete,undefined,{timeout:30000});
   const rows=await page.evaluate(()=>{const t=(window as any).__landingStats;t.stage='';return t.rows;});
   snapshots.push({profile,rows});const captured=reference.modifiers.find(r=>r.fat===profile.fat&&r.muscle===profile.muscle)!;
   expect(captured).toBeDefined();expect(rows.length).toBeGreaterThan(1);
   expect(rows.every((r:any)=>r.speed===captured.modifier)).toBe(true);
   expect(rows[0]).toMatchObject({fat:profile.fat,muscle:profile.muscle,modifier:captured.modifier});
   expect(rows.some((r:any)=>r.fat===profile.nextFat&&r.muscle===profile.nextMuscle&&r.modifier!==r.speed)).toBe(true);
  }
  await page.screenshot({path:'artifacts/player-landing-stats.png'});
 }finally{
  await page.keyboard.up('Space');
  await page.evaluate(()=>{const g=(window as any).__game,t=(window as any).__landingStats;t.character.step=t.original;const stats=g.missionForProfiling().runtime.game.stats;stats.set(21,0);stats.set(23,0);});
  writeFileSync('artifacts/player-landing-stats.json',JSON.stringify({snapshots,errors},null,2));
 }
 expect(errors).toEqual([]);
});
