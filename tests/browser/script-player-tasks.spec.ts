import {test,expect} from '@playwright/test';
/** A script's tasks on CJ's own ped: TASK_GO_STRAIGHT_TO_COORD walks him to the mark and TASK_ACHIEVE_HEADING turns
 * him, with GET_SCRIPT_TASK_STATUS following each. */
test('the script walks the player to a point and turns him',async({page})=>{
 test.setTimeout(180000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 const GO=0x05d3,HEADING=0x05d4;
 const status=(opcode:number)=>page.evaluate((opcode:number)=>(window as any).__game.missionForProfiling().runtime.world.scriptTaskStatus(1,opcode),opcode);
 const start=await page.evaluate(()=>{const p=(window as any).__game.state().player.position;return {x:p.x,z:p.z};});
 const target={x:start.x+4,z:start.z};
 // Read in the same evaluate: the next Process makes it TASK_ASSOCIATED, and a frame may run between two evaluates.
 expect(await page.evaluate(({target,opcode})=>{const w=(window as any).__game.missionForProfiling().runtime.world;
  w.givePedScriptedTask(1,{kind:'goStraightToCoord',x:target.x,y:-target.z,z:-100,speed:4,time:-1},opcode);return w.scriptTaskStatus(1,opcode);},{target,opcode:GO})).toBe(0);
 await expect.poll(()=>status(GO),{timeout:30000}).toBe(7);
 const arrived=await page.evaluate(()=>{const p=(window as any).__game.state().player.position;return {x:p.x,z:p.z};});
 expect(Math.hypot(arrived.x-target.x,arrived.z-target.z)).toBeLessThan(.7);
 // Script heading 90 is west: the renderer's yaw of 90 degrees plus half a turn.
 await page.evaluate((opcode:number)=>(window as any).__game.missionForProfiling().runtime.world.givePedScriptedTask(1,{kind:'achieveHeading',heading:90},opcode),HEADING);
 await expect.poll(()=>status(HEADING),{timeout:20000}).toBe(7);
 const heading=await page.evaluate(()=>(window as any).__game.state().player.heading);
 const want=Math.PI/2+Math.PI,off=Math.abs(Math.atan2(Math.sin(heading-want),Math.cos(heading-want)));
 expect(off).toBeLessThan(.25);
 // TASK_USE_MOBILE_PHONE: PHONE_IN, then PHONE_TALK looped with the phone in his hand; FALSE puts it away.
 const PHONE=0x0729;
 await page.evaluate((opcode:number)=>(window as any).__game.missionForProfiling().runtime.world.givePedScriptedTask(1,{kind:'useMobilePhone',start:true},opcode),PHONE);
 const reaction=()=>page.evaluate(()=>(window as any).__game.state().nativeCharacter?.reaction??null);
 await expect.poll(reaction,{timeout:30000}).toBe('phone:phone_talk');
 await page.evaluate((opcode:number)=>(window as any).__game.missionForProfiling().runtime.world.givePedScriptedTask(1,{kind:'useMobilePhone',start:false},opcode),PHONE);
 await expect.poll(reaction,{timeout:30000}).toBe(null);
 expect(errors).toEqual([]);
});
