import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('OTB renders its native betting artwork, accepts horse selection and backs out with cleared textures',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 await page.evaluate(()=>{const g=(window as any).__game;g.missionForProfiling().runtime.loadAndLaunchMission(7);});
 await page.waitForFunction(()=>{const g=(window as any).__game,s=g.state().nativeScriptSprites,t=g.missionForProfiling().runtime.active.find((a:any)=>a.thread.name==='OTB')?.thread;return s.ready&&s.loaded?.includes('ld_otb2')&&s.decoded>0&&t&&t.locals.getInt32(76*4,true)===0&&t.locals.getInt32(74*4,true)===0;},undefined,{timeout:60000});
 await page.screenshot({path:'artifacts/otb-native-sprites.png'});
 const state=()=>page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling(),t=m.runtime.active.find((a:any)=>a.thread.name==='OTB')?.thread;return {stage:t?.locals.getInt32(76*4,true),sprites:g.state().nativeScriptSprites,money:g.sim.money,skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};});const start=await state();expect(start.sprites.errors).toEqual([]);
 await page.keyboard.down('ShiftLeft');try{await expect.poll(async()=>(await state()).stage,{timeout:10000}).toBe(1);}finally{await page.keyboard.up('ShiftLeft');}
 await page.screenshot({path:'artifacts/otb-native-bet-amount.png'});
 await page.keyboard.down('KeyF');try{await expect.poll(async()=>(await state()).stage,{timeout:10000}).toBe(0);}finally{await page.keyboard.up('KeyF');}
 await page.waitForFunction(()=>{const t=(window as any).__game.missionForProfiling().runtime.active.find((a:any)=>a.thread.name==='OTB')?.thread;return t&&t.locals.getInt32(75*4,true)===0;});
 await page.keyboard.down('KeyF');try{await expect.poll(async()=>(await state()).stage,{timeout:10000}).toBeUndefined();}finally{await page.keyboard.up('KeyF');}
 await expect.poll(async()=>(await state()).sprites.loaded,{timeout:10000}).toEqual([]);const end=await state();expect(end.money).toBe(start.money);expect(end.sprites.errors).toEqual([]);expect(end.skipped).toEqual([]);expect(end.gaveUp).toEqual([]);expect(errors).toEqual([]);
});

test('OTB accepts a five-dollar bet, completes its race and applies the script’s result and statistics',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 const before=await page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling();g.sim.money=500;const stats={wagered:m.runtime.game.stats.get(35),won:m.runtime.game.stats.get(37)};m.runtime.loadAndLaunchMission(7);return stats;});
 const state=()=>page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling(),t=m.runtime.active.find((a:any)=>a.thread.name==='OTB')?.thread;return {locals:t&&Object.fromEntries([74,76,79,81,83,85,86,87,453,563,579].map(n=>[n,t.locals.getInt32(n*4,true)])),money:g.sim.money,sprites:g.state().nativeScriptSprites,wagered:m.runtime.game.stats.get(35),won:m.runtime.game.stats.get(37),skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};});
 const press=async(code:string,index:number,value:number)=>{await page.keyboard.down(code);try{await expect.poll(async()=>(await state()).locals?.[index],{timeout:10000}).toBe(value);}finally{await page.keyboard.up(code);}await page.waitForFunction(()=>{const p=(window as any).__game.missionForProfiling().runtime.game.pads.pads[0];return p.cross===0&&p.leftStickX===0&&p.leftStickY===0;});};
 await page.waitForFunction(()=>{const g=(window as any).__game,t=g.missionForProfiling().runtime.active.find((a:any)=>a.thread.name==='OTB')?.thread;return t&&g.state().nativeScriptSprites.decoded>0&&t.locals.getInt32(74*4,true)===0;},undefined,{timeout:60000});
 await press('ShiftLeft',76,1);await press('KeyD',79,1);await press('ShiftLeft',87,5);expect((await state()).money).toBe(495);for(const index of [81,83,85])await press('KeyS',index,1);await press('KeyS',86,2);await press('ShiftLeft',453,1);
 await page.waitForFunction(()=>{const s=(window as any).__game.state().nativeScriptSprites;return s.loaded.includes('ld_otb')&&s.decoded>0;},undefined,{timeout:30000});await page.screenshot({path:'artifacts/otb-native-race.png'});
 await expect.poll(async()=>(await state()).locals?.[579],{timeout:150000}).toBe(1);const finished=await state(),profit=finished.locals![563];expect(finished.locals![87]).toBe(5);expect(finished.money).toBe(495);expect(finished.sprites.errors).toEqual([]);await page.screenshot({path:'artifacts/otb-native-race-result.png'});
 await page.keyboard.down('ShiftLeft');try{await expect.poll(async()=>(await state()).locals,{timeout:10000}).toBeUndefined();}finally{await page.keyboard.up('ShiftLeft');}
 await expect.poll(async()=>(await state()).sprites.loaded,{timeout:10000}).toEqual([]);const end=await state();expect(end.money).toBe(495+(profit>0?profit+5:0));expect(end.wagered-before.wagered).toBe(5);expect(end.won-before.won).toBe(profit>0?profit:0);expect(end.sprites.errors).toEqual([]);expect(end.skipped).toEqual([]);expect(end.gaveUp).toEqual([]);expect(errors).toEqual([]);
});
