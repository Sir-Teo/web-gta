import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';
/** The native command creates PartnerChat: reciprocal approach/turn, then alternating fallback gestures. */
test('script partners finish their conversation; CJ can participate with pad controls off',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 const [a,b]=await page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling(),p=g.sim.player.position;return[m.peds.create(4,'MALE01',{x:p.x+4,y:-p.z,z:p.y}),m.peds.create(4,'MALE01',{x:p.x+5,y:-p.z,z:p.y})];});
 await page.waitForFunction(([a,b])=>{const m=(window as any).__game.missionForProfiling();return!!m.peds.entity(a)&&!!m.peds.entity(b);},[a,b],{timeout:60000});
 const CHAT=0x677,status=(h:number)=>page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.scriptTaskStatus(h,0x677),h);
 await page.evaluate(([a,b])=>{const w=(window as any).__game.missionForProfiling().runtime.world;w.givePedScriptedTask(a,{kind:'chatWithPed',other:b,leadSpeaker:true,unknown:1},0x677);w.givePedScriptedTask(b,{kind:'chatWithPed',other:a,leadSpeaker:false,unknown:1},0x677);},[a,b]);
 const timeline:any[]=[];
 await expect.poll(async()=>{const r=await page.evaluate(([a,b])=>{const m=(window as any).__game.missionForProfiling();return[a,b].map(h=>{const p=m.peds.entity(h);return{status:m.runtime.world.scriptTaskStatus(h,0x677),phase:p.order?.task?.phase,rounds:p.order?.task?.directions,clip:p.view.reactionName};});},[a,b]);timeline.push(r);if(timeline.length%20===0)writeFileSync('artifacts/script-chat-progress.json',JSON.stringify({a,b,timeline,errors},null,2));return r.every(s=>s.status===7);},{timeout:90000,intervals:[200]}).toBe(true);
 expect(timeline.some(r=>r[0].clip==='idle_chat')).toBe(true);expect(timeline.some(r=>r[1].clip==='idle_chat')).toBe(true);
 // Without a reciprocal task, both speaker and listener finish after the initial stand.
 await page.evaluate(([a,b])=>{const w=(window as any).__game.missionForProfiling().runtime.world;for(const[h,lead]of[[a,true],[b,false]])w.givePedScriptedTask(h,{kind:'chatWithPed',other:1,leadSpeaker:lead,unknown:1},0x677);},[a,b]);
 await expect.poll(()=>status(a),{timeout:5000}).toBe(7);await expect.poll(()=>status(b),{timeout:5000}).toBe(7);
 const cj=await page.evaluate(a=>{const g=(window as any).__game,w=g.missionForProfiling().runtime.world,p=w.pedPosition(1);w.setPlayerControl(0,false);w.givePedScriptedTask(1,{kind:'chatWithPed',other:a,leadSpeaker:true,unknown:1},0x677);w.givePedScriptedTask(a,{kind:'chatWithPed',other:1,leadSpeaker:false,unknown:1},0x677);return p;},a);
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.render().nativeCharacter?.reactionName),{timeout:15000}).toBe('idle_chat');
 const paired=await page.evaluate(a=>{const g=(window as any).__game,m=g.missionForProfiling();return{cj:m.runtime.world.pedPosition(1),control:m.playerControl,playerStatus:m.runtime.world.scriptTaskStatus(1,0x677),npc:m.peds.entity(a).order?.task};},a);expect(paired.playerStatus).toBe(1);expect(paired.control).toBe(false);expect(Math.hypot(paired.cj.x-cj.x,paired.cj.y-cj.y)).toBeGreaterThan(.2);
 await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.clearPedTasks(1));await expect.poll(()=>status(1)).toBe(7);await expect.poll(()=>status(a)).toBe(7);await expect.poll(()=>page.evaluate(()=>(window as any).__game.render().nativeCharacter?.reactionName)).not.toBe('idle_chat');
 const final=await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling();return{skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};});writeFileSync('artifacts/script-chat.json',JSON.stringify({a,b,timeline,cj,paired,final,errors},null,2));expect(final.skipped).toEqual([]);expect(final.gaveUp).toEqual([]);expect(errors).toEqual([]);
});
