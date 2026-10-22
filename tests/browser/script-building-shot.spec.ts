import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('player bullets record the hit IPL building model and 0A3A/0A3B query and clear it',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 await page.keyboard.press('Backquote');await page.locator('[data-weapon="22"]').click();await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().weapons.ready)).toBe(true);
 const result=await page.evaluate(()=>{
  const g=(window as any).__game,m=g.missionForProfiling(),w=g.weapons(),p=g.state().player.position,from={x:p.x,y:p.y+1.3,z:p.z};
  let target:any,probe:any;for(const [dx,dz] of [[3,0],[-3,0],[0,3],[0,-3]]){const at={x:p.x+dx,y:p.y-3,z:p.z+dz},hit=g.rayBetween(from,at);if(hit?.entityKind==='building'){target=at;probe=hit;break;}}
  if(!probe)throw new Error('No nearby building collision for the ground-shot fixture');
  const info=m.runtime.game.playerInfo;info.lastBuildingModelsShot[0]=-1;w.aiming=true;w.inventory.cooldown=0;
  const fired=g.fireAt(target.x,target.y,target.z),recorded=info.lastBuildingModelsShot[0];
  const code=new Uint8Array(14),view=new DataView(code.buffer);view.setUint16(0,0xa3a,true);code[2]=4;code[3]=0;code[4]=1;view.setInt32(5,recorded,true);view.setUint16(9,0x4e,true);
  const slot=m.runtime.start(0,[],{space:code.subarray(0,11)});slot.thread.run(g.gameTimeMs(),100,1);const matches=slot.thread.condition;
  const wrong=m.runtime.world.isLastBuildingModelShotByPlayer(0,recorded+1),byName=m.runtime.world.isLastBuildingModelShotByPlayer(0,probe.model);
  // Clear via actual bytecode; neither a query nor a miss consumes the stored model.
  const retained=info.lastBuildingModelsShot[0];m.runtime.start(0,[],{space:new Uint8Array([0x3b,0xa,4,0,0x4e,0])}).thread.run(g.gameTimeMs(),100,1);
  return {fired,probe,recorded,matches,wrong,byName,retained,cleared:info.lastBuildingModelsShot[0],skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};
 });
 expect(result.fired).toBe(true);expect(result.recorded).toBe(result.probe.modelId);expect(result.recorded).toBeGreaterThanOrEqual(0);expect(result.matches).toBe(true);expect(result.byName).toBe(true);expect(result.wrong).toBe(false);expect(result.retained).toBe(result.recorded);expect(result.cleared).toBe(-1);expect(result.skipped).toEqual([]);expect(result.gaveUp).toEqual([]);expect(errors).toEqual([]);
});
