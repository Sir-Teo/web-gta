import {test,expect} from '@playwright/test';
import {enterPoolOpponent} from './poolSession';
test('a full pool match pays its result and declining a rematch refunds the new stake',async({page})=>{
 test.skip(process.env.POOL_MATCH!=='1','Set POOL_MATCH=1 to play a complete real-time match.');test.setTimeout(900000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const session=await enterPoolOpponent(page);
 const state=()=>page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling(),t=m.runtime.active.find((s:any)=>s.thread.name==='POOL2')?.thread,tableHandle=t?.locals.getInt32(163*4,true),table=tableHandle!==undefined&&m.runtime.game.objects.exists(tableHandle)?m.runtime.game.objects.at(tableHandle).position:undefined;return{frozen:g.sim.playerFrozen,tableDistance:table?Math.hypot(g.sim.player.position.x-table.x,g.sim.player.position.z+table.y,g.sim.player.position.y-table.z):Infinity,stage:t?.locals.getInt32(34*4,true),substage:t?.locals.getInt32(35*4,true),shooter:t?.locals.getInt32(215*4,true),ready:t?.locals.getInt32(252*4,true),mousePosition:t?.locals.getFloat32(200*4,true),balls:m.runtime.game.objects.all.filter((o:any)=>o.poolBall).length,potted:t&&Array.from({length:16},(_,i)=>t.locals.getInt32((66+i)*4,true)).filter(v=>v===1).length,area:g.state().lighting.area,money:g.sim.money,player:{...g.sim.player.position},skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};});
 const press=async(code:string,condition:()=>Promise<boolean>)=>{await page.keyboard.down(code);try{await expect.poll(condition,{timeout:30000}).toBe(true);}finally{await page.keyboard.up(code);}};
 await press('KeyF',async()=>(await state()).stage===1);await expect.poll(async()=>(await state()).substage,{timeout:30000}).toBe(3);
 // Moving the pointer during aiming also turns the cue. Position it while still in the wager screen.
 await page.mouse.move(720,450);await page.waitForTimeout(150);await press('ShiftLeft',async()=>(await state()).stage!==1);await expect.poll(async()=>{const s=await state();return s.stage===5&&s.substage===1;},{timeout:30000}).toBe(true);
 const alignment=await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling(),t=m.runtime.active.find((s:any)=>s.thread.name==='POOL2').thread,objects=m.runtime.game.objects,cue=objects.at(t.locals.getInt32(82*4,true)),target=objects.at(t.locals.getInt32((82+t.locals.getInt32(239*4,true))*4,true)),x=target.position.x-cue.position.x,y=target.position.y-cue.position.y;return(-Math.sin(cue.heading)*x+Math.cos(cue.heading)*y)/Math.hypot(x,y);});expect(alignment).toBeGreaterThan(.999);
 await press('ShiftLeft',async()=>(await state()).stage===7);await expect.poll(async()=>{const s=await state();return s.substage===2&&s.ready===1;},{timeout:30000}).toBe(true);
 await page.evaluate(session=>{
  const g=(window as any).__game,m=g.missionForProfiling(),t=m.runtime.active.find((s:any)=>s.thread.name==='POOL2').thread,handles=Array.from({length:16},(_,i)=>t.locals.getInt32((82+i)*4,true)),starts=handles.map(h=>({...m.runtime.game.objects.at(h).position}));
  const probe={active:true,frames:0,maxCueTravel:0,maxOtherTravel:0,maxMoving:0,maxRigidMoving:0,ballMaxSpeed:handles.map(()=>0),ballMaxTravel:handles.map(()=>0),maxCueSpeed:0,tableRetained:true,opponentRetained:true,sawPlayerMotion:false,sawOpponentMotion:false};(window as any).__poolStroke=probe;
  const frame=()=>{if(!probe.active)return;const current=m.runtime.active.find((s:any)=>s.thread.name==='POOL2')?.thread;probe.frames++;probe.tableRetained&&=m.runtime.game.objects.exists(session.table);probe.opponentRetained&&=m.peds.exists(session.opponent);let moving=0,rigidMoving=0;for(let i=0;i<handles.length;i++){if(!m.runtime.game.objects.exists(handles[i]))continue;const o=m.runtime.game.objects.at(handles[i]),start=starts[i],travel=Math.hypot(o.position.x-start.x,o.position.y-start.y,o.position.z-start.z),speed=Math.hypot(o.velocity.x,o.velocity.y,o.velocity.z);if(speed>.001)moving++;probe.ballMaxSpeed[i]=Math.max(probe.ballMaxSpeed[i],speed);probe.ballMaxTravel[i]=Math.max(probe.ballMaxTravel[i],travel);const velocity=g.scriptObjectViews()?.bodyOf(handles[i])?.linvel();if(velocity&&Math.hypot(velocity.x,velocity.y,velocity.z)>.05)rigidMoving++;if(i===0){probe.maxCueTravel=Math.max(probe.maxCueTravel,travel);probe.maxCueSpeed=Math.max(probe.maxCueSpeed,speed);}else probe.maxOtherTravel=Math.max(probe.maxOtherTravel,travel);}probe.maxMoving=Math.max(probe.maxMoving,moving);probe.maxRigidMoving=Math.max(probe.maxRigidMoving,rigidMoving);if(current?.locals.getInt32(34*4,true)===8){const shooter=current.locals.getInt32(215*4,true);if(shooter===1)probe.sawPlayerMotion=true;if(shooter===session.opponent)probe.sawOpponentMotion=true;}requestAnimationFrame(frame);};requestAnimationFrame(frame);
 },session);
 await page.mouse.move(720,650,{steps:4});await expect.poll(async()=>(await state()).mousePosition,{timeout:10000}).toBeGreaterThan(100);await page.mouse.move(720,150,{steps:8});
 await expect.poll(()=>page.evaluate(()=>(window as any).__poolStroke.sawPlayerMotion),{timeout:15000}).toBe(true);await expect.poll(async()=>(await state()).shooter,{timeout:30000}).toBe(session.opponent);await expect.poll(()=>page.evaluate(()=>(window as any).__poolStroke.sawOpponentMotion),{timeout:60000}).toBe(true);
 // Use the original automatic target, real buttons and mouse strokes throughout the match.
 let shots=1,finished=false,lastState='',winner:number|undefined,winningBalance:number|undefined;const until=Date.now()+12*60*1000;
 while(Date.now()<until){
  const s=await state(),key=JSON.stringify([s.stage,s.substage,s.shooter,s.money,s.potted]);if(key!==lastState){console.log('POOL_MATCH',JSON.stringify({...s,shots}));lastState=key;}
  if(s.stage===11&&winner===undefined){winner=s.shooter;winningBalance=s.money;console.log('POOL_WIN_RESULT',JSON.stringify({winner,winningBalance,shots}));await page.screenshot({path:'artifacts/pool-match-result.png'});}
  if(winner!==undefined&&s.stage===1&&s.substage===3){expect(s.money).toBe(winningBalance!-50);await press('KeyF',async()=>(await state()).stage===undefined);finished=true;break;}
  if(s.stage===undefined){finished=true;break;}
  if(s.shooter===1){
   if(s.stage===10&&s.substage===99)await press('ShiftLeft',async()=>(await state()).stage!==10);
   else if(s.stage===4&&s.substage===1)await press('ShiftLeft',async()=>(await state()).stage!==4);
   else if(s.stage===5&&s.substage===1){
    await page.mouse.move(720,450);await page.waitForTimeout(150);
    await press('ShiftLeft',async()=>(await state()).stage===7);
    await expect.poll(async()=>{const p=await state();return p.substage===2&&p.ready===1;},{timeout:30000}).toBe(true);
    await page.mouse.move(720,650,{steps:4});await expect.poll(async()=>(await state()).mousePosition,{timeout:10000}).toBeGreaterThan(100);await page.mouse.move(720,150,{steps:8});shots++;
   }
  }
  await page.waitForTimeout(1000);
 }
 const final=await state();console.log('POOL_MATCH_FINAL',JSON.stringify({finished,shots,winner,winningBalance,...final}));await page.screenshot({path:'artifacts/pool-match-final.png'});expect(finished).toBe(true);expect(winner).toBeDefined();expect(winningBalance).toBe(winner===1?550:450);expect(final.money).toBe(winningBalance);expect(final.frozen).toBe(false);expect(final.gaveUp).toEqual([]);expect(errors).toEqual([]);
 const retained=await page.evaluate(session=>{const m=(window as any).__game.missionForProfiling();return{table:m.runtime.game.objects.exists(session.table),opponent:m.peds.exists(session.opponent)};},session);expect(retained).toEqual({table:true,opponent:true});
});
