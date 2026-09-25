import {test,expect} from '@playwright/test';
/** A script object is a CPhysical the world collides with: its model's COL stands where the record puts it, moves
 * with the record, goes when the script turns its collision off, and a blast ObjectDamages it (a cardboard box,
 * OBJECT.DAT effect 20, smashes: hidden, collision off, HAS_OBJECT_BEEN_DAMAGED). */
test('a script object collides, follows its record and smashes in a blast',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 const made=await page.evaluate(()=>{
  const g=(window as any).__game,p=g.state().player.position,x=p.x+8,z=p.z,ground=g.groundAt(x,z,p.y+20)??p.y;
  const objects=g.missionForProfiling().runtime.game.objects,object=objects.create('cardboardbox',{x,y:-z,z:ground+.3},{external:false,missionCleanup:false});
  return {handle:object.handle,x,z,top:ground+20,effect:object.colDamageEffect,multiplier:object.colDamageMultiplier};
 });
 expect([made.effect,made.multiplier]).toEqual([20,2.5]);
 await expect.poll(()=>page.evaluate(m=>(window as any).__game.rayDown(m.x,m.z,m.top)?.scriptObject??null,made),{timeout:60000}).toBe(made.handle);
 // The record moves; the body follows it.
 await page.evaluate(m=>{const o=(window as any).__game.missionForProfiling().runtime.game.objects.at(m.handle);o.position={...o.position,x:o.position.x+3};},made);
 await expect.poll(()=>page.evaluate(m=>(window as any).__game.rayDown(m.x+3,m.z,m.top)?.scriptObject??null,made),{timeout:10000}).toBe(made.handle);
 expect(await page.evaluate(m=>(window as any).__game.rayDown(m.x,m.z,m.top)?.scriptObject??null,made)).toBeNull();
 // SET_OBJECT_COLLISION off takes it out of the world's way, and back on puts it back.
 await page.evaluate(m=>{(window as any).__game.missionForProfiling().runtime.game.objects.setUsesCollision(m.handle,false);},made);
 await expect.poll(()=>page.evaluate(m=>(window as any).__game.rayDown(m.x+3,m.z,m.top)?.scriptObject??null,made),{timeout:10000}).toBeNull();
 await page.evaluate(m=>{(window as any).__game.missionForProfiling().runtime.game.objects.setUsesCollision(m.handle,true);},made);
 await expect.poll(()=>page.evaluate(m=>(window as any).__game.rayDown(m.x+3,m.z,m.top)?.scriptObject??null,made),{timeout:10000}).toBe(made.handle);
 // ADD_EXPLOSION beside it.
 await page.evaluate(m=>{const w=(window as any).__game.missionForProfiling().runtime.world,o=(window as any).__game.missionForProfiling().runtime.game.objects.at(m.handle);w.addExplosion(o.position.x+1,o.position.y,o.position.z,0);},made);
 await expect.poll(()=>page.evaluate(m=>(window as any).__game.missionForProfiling().runtime.game.objects.hasBeenDamaged(m.handle),made),{timeout:10000}).toBe(true);
 const after=await page.evaluate(m=>{const o=(window as any).__game.missionForProfiling().runtime.game.objects.at(m.handle);return {visible:o.visible,collision:o.usesCollision,weapon:o.lastWeaponDamage};},made);
 expect(after).toEqual({visible:false,collision:false,weapon:51});
 await expect.poll(()=>page.evaluate(m=>(window as any).__game.rayDown(m.x+3,m.z,m.top)?.scriptObject??null,made),{timeout:10000}).toBeNull();
 expect(errors).toEqual([]);
});
