import {test,expect} from '@playwright/test';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';
/* Stage 2 of the porting pipeline (scripts/port/pipeline.mjs): launch missions headless, one after another, and
 * record how far each gets and why it stops. Skipped unless SWEEP is set:
 *
 *   SWEEP=11,12,13 SWEEP_SECONDS=120 npx playwright test tests/browser/mission-sweep.spec.ts --project=parallel
 *   SWEEP=story ...   every mission in the census's launch order (docs/port/census.json)
 *
 * Each mission is started as MAIN would start it (LOAD_AND_LAUNCH_MISSION_INTERNAL) from free roam at Grove Street.
 * An autopilot stands in for the player where it can: while the mission thread waits in a loop on a locate or
 * area test with literal coordinates, CJ is put at the point, and while it waits for him in a car it names he is
 * put in it; he is kept alive and unwanted; cutscenes end at once
 * already. It cannot drive a chase, win a fight or pick a menu item, so a mission it cannot finish is reported with
 * the instruction it was waiting on. What the report proves is where the port stops a mission (a command it gave up
 * on, a thread error, a page error), not that a mission plays as the original does. */
const list=process.env.SWEEP??'';
test.skip(!list,'set SWEEP to a mission list to run the mission sweep');
test('mission sweep',async({page})=>{
 const seconds=Number(process.env.SWEEP_SECONDS??90);
 let ids:number[];
 if(list==='story'){
  const census=JSON.parse(readFileSync('docs/port/census.json','utf8'));
  ids=census.missions.map((m:any)=>m.id).filter((id:unknown):id is number=>typeof id==='number'&&id>2);
 }else ids=list.split(',').map(Number).filter(Number.isInteger);
 test.setTimeout(180000+ids.length*(seconds+30)*1000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 // The script, decoded in the page with the game's own decoder, for the autopilot's look at what a thread waits on.
 await page.evaluate(async()=>{
  const decoder='/src/assets/scm.ts',{readScmHeader,decodeScmInstructions}=await import(/* @vite-ignore */ decoder);
  const bytes=new Uint8Array(await (await fetch('/play/world/files/scripts/main.scm')).arrayBuffer());
  const header=readScmHeader(bytes);
  (window as any).__sweep={missions:header.missions.map((m:any)=>({...m,instructions:decodeScmInstructions(bytes,m.start,m.end)}))};
 });
 const results:unknown[]=[];
 for(const id of ids){
  const before=errors.length;
  // Each mission starts from the same place: CJ on foot at Grove Street, whatever the last one left him in.
  for(let tries=0;tries<10;tries++){
   const seated=await page.evaluate(()=>{const r=(window as any).__game.missionForProfiling().runtime;
    for(const slot of [...r.active])if(slot.thread.base>0)r.terminateAllWithName(slot.thread.name);
    if(!((r.world.pedVehicle(1)??0)>0))return false;
    try{r.world.warpPedFromCarToCoord(1,2495,-1687,13.4);}catch{}
    return (r.world.pedVehicle(1)??0)>0;});
   if(!seated)break;
   await page.keyboard.press('KeyF');await page.waitForTimeout(1500);
  }
  await page.evaluate(()=>{const r=(window as any).__game.missionForProfiling().runtime;try{r.world.setPedCoordinates(1,2495,-1687,13.4);}catch{}});
  await page.waitForTimeout(2000);
  const start=await page.evaluate(id=>{
   const g=(window as any).__game,m=g.missionForProfiling(),r=m.runtime;
   for(const slot of [...r.active])if(slot.thread.base>0)r.terminateAllWithName(slot.thread.name);
   r.game.alreadyRunningAMissionScript=false;g.setWantedLevel(0);
   (window as any).__sweepGaveUp=m.snapshot().gaveUp.length;(window as any).__sweep.pilot=undefined;
   r.loadAndLaunchMission(id);return {threads:r.active.length};
  },id);
  let last:any,previous:any,teleports=0,samples=0,maxOffset=0,ended=false;const waits=new Map<string,number>();
  const deadline=Date.now()+seconds*1000;
  while(Date.now()<deadline){
   await page.waitForTimeout(500);
   const s=await page.evaluate(id=>{
    const g=(window as any).__game,m=g.missionForProfiling(),r=m.runtime,sweep=(window as any).__sweep;
    const slot=r.active.find((a:any)=>a.thread.base>0&&a.thread.thisMustBeTheOnlyMissionRunning);
    const gaveUp=m.snapshot().gaveUp.slice((window as any).__sweepGaveUp);
    const said=()=>{const msg=r.game.messages;return [msg.briefs?.[0]?.key,...msg.big.map((style:any[])=>style[0]?.key)].filter(Boolean);};
    if(!slot)return {ended:true,gaveUp,said:said(),passed:r.game.missionPassedKey??null};
    const t=slot.thread,block=sweep.missions[id],offset=t.ip-t.base,fileOffset=block.start+offset;
    // Keep CJ alive and out of trouble.
    try{r.world.setPedHealth(1,100);}catch{}g.setWantedLevel(0);
    // The autopilot. Its candidates are the locate and area tests with literal coordinates round where the thread
    // waits, nearest ahead first; while the thread stays put it moves on to the next every fifteen seconds, since
    // the loop's own exit test and the triggers inside it look alike from here.
    const near=block.instructions.filter((x:any)=>Math.abs(x.offset-fileOffset)<900&&/^(LOCATE_(CHAR|PLAYER)_|IS_CHAR_IN_AREA|IS_PLAYER_IN_AREA)/.test(x.name)&&x.parameters.filter((p:any)=>p.type===6).length>=2);
    near.sort((a:any,b:any)=>(a.offset<fileOffset?1:0)-(b.offset<fileOffset?1:0)||Math.abs(a.offset-fileOffset)-Math.abs(b.offset-fileOffset));
    const state=sweep.pilot??={offset:-1,since:performance.now(),turn:0,lastKey:'',lastAt:0},now=performance.now();
    if(Math.abs(state.offset-offset)>40){state.offset=offset;state.since=now;state.turn=0;}
    else if(now-state.since>15000){state.since=now;state.turn++;}
    const ahead=near.length?near[state.turn%near.length]:undefined;
    let moved=false;
    // A loop that waits for CJ in a car or on a bike the script named (the BMX, Sweet's Greenwood) puts him in it.
    const ride=block.instructions.find((x:any)=>x.offset>=fileOffset-40&&x.offset<fileOffset+200&&/^IS_CHAR_(SITTING_)?IN_CAR$/.test(x.name));
    if(ride&&!((r.world.pedVehicle(1)??0)>0)){
     try{if(t.readInt(ride.parameters[0])===1){const car=t.readInt(ride.parameters[1]);if(m.vehicles.exists(car)&&now-state.lastAt>8000){r.world.warpPedIntoCar(1,car);state.lastAt=now;moved=true;}}}catch{}
    }
    if(ahead){
     const floats=ahead.parameters.filter((p:any)=>p.type===6).map((p:any)=>p.value);
     const area=/IN_AREA/.test(ahead.name),[x,y]=area?[(floats[0]+floats[2])/2,(floats[1]+floats[3])/2]:[floats[0],floats[1]];
     const z=/3D/.test(ahead.name)&&floats.length>=3?(area?(floats[2]+floats[5])/2:floats[2]):undefined;
     // Every char the same condition group tests goes there: those sent to this point, and those a char-to-char
     // locate wants beside CJ. A char test names its ped through a variable the thread reads.
     const group=block.instructions.filter((x:any)=>x.offset>=ahead.offset-80&&x.offset<ahead.offset+160&&/^LOCATE_CHAR_/.test(x.name));
     const handles=new Set<number>([1]);
     for(const x of group){
      try{
       if(x.name===ahead.name)handles.add(t.readInt(x.parameters[0]));
       else if(/_CHAR_[23]D$/.test(x.name)&&t.readInt(x.parameters[0])===1)handles.add(t.readInt(x.parameters[1]));
      }catch{}
     }
     // A ped on a bike or in a car goes with it; a point just visited is left a few seconds for the teleport's
     // terrain hold before it is tried again.
     const key=`${x.toFixed(1)},${y.toFixed(1)}`;
     if(state.lastKey!==key||now-state.lastAt>8000){
      let k=0;
      for(const handle of handles){
       try{
        const p=r.world.pedPosition(handle),hx=x+k*3,hz=z??r.world.groundZFor3DCoord?.(hx,y,1000)??p.z;k++;
        if(Math.hypot(p.x-hx,p.y-y)<=2)continue;
        const vehicle=r.world.pedVehicle(handle);
        if(vehicle!==undefined&&vehicle>0)r.world.setVehicleCoordinates(vehicle,hx,y,hz);else r.world.setPedCoordinates(handle,hx,y,hz);
        moved=true;
       }catch{}
      }
      if(moved){state.lastKey=key;state.lastAt=now;}
     }
    }
    // What the loop it sits in asks: the instructions just after where it waits.
    const loop=block.instructions.filter((x:any)=>x.offset>=fileOffset&&x.offset<fileOffset+160).map((x:any)=>x.name).filter((n:string)=>!/^(IF|GOTO|GOTO_IF_FALSE|WAIT|GOSUB)$/.test(n)).slice(0,8);
    return {ended:false,offset,name:t.currentInstruction?.name??null,moved,gaveUp,loop,said:said()};
   },id);
   samples++;previous=last;last=s;
   if(s.ended){ended=true;break;}
   if(s.moved)teleports++;
   maxOffset=Math.max(maxOffset,s.offset??0);if(s.name)waits.set(s.name,(waits.get(s.name)??0)+1);
   if(s.gaveUp.length)break;
  }
  const size=await page.evaluate(id=>{const b=(window as any).__sweep.missions[id];return b.end-b.start;},id);
  const name=await page.evaluate(id=>{const b=(window as any).__sweep.missions[id];const i=b.instructions.find((x:any)=>x.name==='SCRIPT_NAME');return i?.parameters[0]?.value??String(id);},id);
  const result={id,name,started:start.threads>0,ended,gaveUp:last?.gaveUp??[],pageErrors:errors.slice(before),
   said:last?.said??[],saidBefore:previous?.said??[],
   reached:+(maxOffset/size*100).toFixed(1),waitingOn:last?.ended?null:last?.name??null,waitingAt:last?.ended?null:last?.offset??null,loop:last?.loop??[],teleports,samples,
   topWaits:[...waits].sort((a,b)=>b[1]-a[1]).slice(0,5)};
  results.push(result);console.log(JSON.stringify(result));
  mkdirSync('artifacts/port',{recursive:true});writeFileSync('artifacts/port/sweep.json',JSON.stringify({generated:new Date().toISOString(),seconds,results},null,1)+'\n');
 }
});
