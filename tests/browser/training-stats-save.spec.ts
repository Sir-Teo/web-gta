import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';
import bodyReference from '../fixtures/player-landing-reference.json' with {type:'json'};

test('earned stamina, lungs and body stats survive pagehide/reload and initialize their gameplay providers',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const rows:any[]=[];
 const play=()=>page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const read=()=>page.evaluate(()=>{const g=(window as any).__game,s=g.missionForProfiling().runtime.game.stats;return {stamina:s.get(22),lung:s.get(225),fat:s.get(21),muscle:s.get(23),bodyModifier:g.sim.playerBodyMovementModifier(),capacity:g.sim.playerLungCapacity(),breath:g.sim.player.breath};});
 const bodyModifier=bodyReference.modifiers.find(r=>r.fat===500&&r.muscle===500)!.modifier;
 await page.goto('/');await play();await endStoryMission(page);rows.push({mode:'initial',...await read()});expect(rows[0]).toMatchObject({stamina:100,lung:0,fat:200,muscle:50,capacity:1150});
 // Actual CStats increments are the common path used by natural training and SCM commands.
 await page.evaluate(()=>{const g=(window as any).__game,s=g.missionForProfiling().runtime.game.stats;s.increment(22,50);s.increment(225,50);s.increment(21,300);s.increment(23,450);g.sim.player.breath=4;});
 rows.push({mode:'earned before reload',...await read()});expect(rows[1]).toMatchObject({stamina:150,lung:50,fat:500,muscle:500,bodyModifier,capacity:1300});
 // pagehide invokes the game's ordinary save hook; do not write a synthetic save or call a debug save helper.
 await page.reload();
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('web-gta.progress.v1')??'null'));rows.push({mode:'stored',trainingStats:stored?.trainingStats});expect(stored?.trainingStats).toEqual({stamina:150,lungCapacity:50,fat:500,muscle:500});
 await play();await endStoryMission(page);
 const restored=await read();rows.push({mode:'restored',...restored});expect(restored).toEqual({stamina:150,lung:50,fat:500,muscle:500,bodyModifier,capacity:1300,breath:1300});
 await page.waitForFunction(()=>((window as any).__game.render().nativeCharacter?.snapshot().bodySwaps??0)>0,undefined,{timeout:30000});
 // Observe a real post-reload launch; changing the save/provider alone is insufficient.
 await page.evaluate(()=>{const g=(window as any).__game,c=g.render().nativeCharacter,t=(window as any).__savedBodyJump={character:c,original:c.step,rows:[] as any[]};c.step=function(this:any,...args:any[]){const result=t.original.apply(this,args),s=this.snapshot();if(/^launch/.test(s.action))t.rows.push({speed:s.playbackSpeed,seconds:s.seconds});return result;};});
 try{await page.keyboard.press('Space');await page.waitForFunction(()=>(window as any).__savedBodyJump.rows.length>1,undefined,{timeout:15000});
  const launch=await page.evaluate(()=>(window as any).__savedBodyJump.rows);rows.push({mode:'post-reload launch',launch});expect(launch.every((r:any)=>r.speed===bodyModifier)).toBe(true);
 }finally{await page.keyboard.up('Space');await page.evaluate(()=>{const t=(window as any).__savedBodyJump;t.character.step=t.original;});}
 const bar=page.locator('.breath-bar');await expect(bar).toHaveAttribute('aria-valuemax','1300');await expect(bar).toBeHidden();
 await page.screenshot({path:'artifacts/training-stats-save.png'});writeFileSync('artifacts/training-stats-save.json',JSON.stringify({rows,errors},null,2));expect(errors).toEqual([]);
});
