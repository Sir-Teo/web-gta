import {test,expect} from '@playwright/test';
/** TASK_KILL_CHAR_ON_FOOT: the ped fights its target with the browser's own combat until the target is dead, then the
 * task is over and the ped goes back to standing, not on to the player. */
test('a script ped told to kill another does so, and the task ends with the target',async({page})=>{
 test.setTimeout(180000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 const made=await page.evaluate(()=>{
  const game=(window as any).__game,mission=game.missionForProfiling(),p=game.state().player.position;
  return {killer:mission.peds.create(4,'MALE01',{x:p.x+6,y:-p.z,z:p.y}),victim:mission.peds.create(4,'MALE01',{x:p.x+9,y:-p.z-2,z:p.y})};
 });
 await page.waitForFunction(({killer,victim}:{killer:number;victim:number})=>{const m=(window as any).__game.missionForProfiling();return !!(m.peds.entity(killer)&&m.peds.entity(victim));},made,{timeout:45000});
 const KILL=0x05e2;
 await page.evaluate(({killer,victim,opcode})=>{
  const game=(window as any).__game,m=game.missionForProfiling();
  game.pedestrians().giveWeapon(m.peds.entity(killer),22,200);m.peds.setHealth(victim,10);
  m.runtime.world.givePedScriptedTask(killer,{kind:'killPedOnFoot',target:victim,time:-1,flags:0,actionDelay:0,actionChance:0,mustBeOnFoot:true},opcode);
 },{...made,opcode:KILL});
 const status=()=>page.evaluate(({killer,opcode})=>(window as any).__game.missionForProfiling().runtime.world.scriptTaskStatus(killer,opcode),{killer:made.killer,opcode:KILL});
 await expect.poll(status,{timeout:60000}).toBe(7);
 const after=await page.evaluate(({killer,victim})=>{
  const m=(window as any).__game.missionForProfiling(),k=m.peds.entity(killer);
  return {victimDead:m.peds.isDead?m.peds.isDead(victim):m.peds.healthOf(victim)<=0,retaliate:k.retaliate,idle:!!k.order?.isDefault,player:(window as any).__game.state().player.health};
 },made);
 expect(after.victimDead).toBe(true);expect(after.retaliate).toBe(0);expect(after.idle).toBe(true);expect(after.player).toBeGreaterThan(0);
 // EXPLODE_CHAR_HEAD: a sniper round's 1000 to the head, whatever the ped's health.
 const exploded=await page.evaluate(({killer})=>{const m=(window as any).__game.missionForProfiling();m.peds.setHealth(killer,500);m.runtime.world.explodePedHead(killer);return m.peds.healthOf(killer);},made);
 expect(exploded).toBeLessThanOrEqual(0);
 expect(errors).toEqual([]);
});
