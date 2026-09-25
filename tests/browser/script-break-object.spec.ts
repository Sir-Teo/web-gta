import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** BREAK_OBJECT (SWEET2's bottles, DECON's portakabins, WUZI5's padlock): the object goes to g_breakMan in pieces from its model's
 * breakable plugin and is hidden without collision, so HAS_OBJECT_BEEN_DAMAGED holds. The pieces come from any
 * break of a script object, which used to only hide it. */
test('BREAK_OBJECT shatters a script bottle into pieces and hides it',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const made=await page.evaluate(()=>{
  const g=(window as any).__game,p=g.state().player.position,x=p.x+6,z=p.z,ground=g.groundAt(x,z,p.y+20)??p.y;
  const objects=g.missionForProfiling().runtime.game.objects;
  const bottle=objects.create('dyn_wine_big',{x,y:-z,z:ground+.5},{external:false,missionCleanup:false});
  const cabin=objects.create('portakabin',{x:x+12,y:-z,z:ground+1.5},{external:false,missionCleanup:false});
  const lock=objects.create('cj_padlock',{x:x-6,y:-z,z:ground+1},{external:false,missionCleanup:false});
  return {bottle:bottle.handle,cabin:cabin.handle,lock:lock.handle,effects:[bottle.colDamageEffect,cabin.colDamageEffect,lock.colDamageEffect],x,z,top:ground+20};
 });
 // The padlock's row has no damage effect, and the command breaks it all the same.
 expect(made.effects).toEqual([200,200,0]);
 await expect.poll(()=>page.evaluate(m=>(window as any).__game.rayDown(m.x,m.z,m.top)?.scriptObject??null,made),{timeout:60000}).toBe(made.bottle);
 await expect.poll(()=>page.evaluate(m=>(window as any).__game.rayDown(m.x+12,m.z,m.top)?.scriptObject??null,made),{timeout:60000}).toBe(made.cabin);
 expect(await page.evaluate(()=>(window as any).__game.state().breakObjects.active)).toBe(0);
 await page.evaluate(m=>{const w=(window as any).__game.missionForProfiling().runtime.world;w.breakObject(m.bottle,1);w.breakObject(m.cabin,0);w.breakObject(m.lock,1);},made);
 const damaged=()=>page.evaluate(m=>{const o=(window as any).__game.missionForProfiling().runtime.game.objects;return [o.hasBeenDamaged(m.bottle),o.hasBeenDamaged(m.cabin),o.hasBeenDamaged(m.lock)];},made);
 expect(await damaged()).toEqual([true,true,true]);
 // The bottle's faces and the cabin's parts fly apart; both lose their collision.
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().breakObjects.groups.flat().length),{timeout:10000}).toBeGreaterThan(4);
 await expect.poll(()=>page.evaluate(m=>[(window as any).__game.rayDown(m.x,m.z,m.top)?.scriptObject??null,(window as any).__game.rayDown(m.x+12,m.z,m.top)?.scriptObject??null],made),{timeout:10000}).toEqual([null,null]);
 expect(errors).toEqual([]);
});
