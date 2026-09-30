import {test} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';
import {gameInvariantsCheck} from './gameInvariants';
/* Gameplay fuzzing: random but plausible play, at places across Los Santos, with the game's invariants checked every
 * second (gameInvariants.ts). What it finds are edge cases, each with where it happened, the actions leading to it and
 * a screenshot: a thing to turn into a spec and fix. Skipped unless FUZZ is set:
 *
 *   FUZZ=1 FUZZ_SEED=7 FUZZ_EPISODES=40 npx playwright test tests/browser/gameplay-fuzz.spec.ts --project=parallel
 *
 * The same seed replays the same actions (the world's own randomness, traffic and peds, still differs). Report:
 * artifacts/fuzz/report.json. */
test.skip(!process.env.FUZZ,'set FUZZ to run the gameplay fuzzer');
/** Native (x, y) points to play at: Grove Street, Ganton's main road, Idlewood, Verona Beach, downtown, a hillside,
 * the Santa Maria shore, the LS River channel. */
const PLACES:[number,number][]=[[2495,-1680],[2380,-1660],[2080,-1730],[850,-1790],[1480,-1700],[1150,-1110],[380,-1880],[2600,-1400]];
type Action='walk'|'sprintJump'|'crouchWalk'|'aimFire'|'punch'|'spawnDrive'|'jackNearest'|'fallFromHeight'|'grenade'|'wanted'|'swimEdge';
const ACTIONS:Action[]=['walk','sprintJump','crouchWalk','aimFire','punch','spawnDrive','jackNearest','fallFromHeight','grenade','wanted'];
test('gameplay fuzz',async({page})=>{
 const episodes=Number(process.env.FUZZ_EPISODES??30);let seed=Number(process.env.FUZZ_SEED??1)>>>0||1;
 test.setTimeout(240000+episodes*40000);
 const rand=()=>{seed=seed*1664525+1013904223>>>0;return seed/4294967296;};
 const pick=<T,>(list:readonly T[])=>list[Math.floor(rand()*list.length)];
 const errors:string[]=[],faults:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/Subsystem fault/.test(m.text()))faults.push(m.text().slice(0,300));});
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 await page.evaluate(`window.__invariants=${gameInvariantsCheck.toString()}`);
 mkdirSync('artifacts/fuzz',{recursive:true});
 const findings:{kind:string;detail:string;episode:number;place:number;actions:string[];shot?:string}[]=[],seen=new Set<string>();
 let pushing=false;
 const check=async(episode:number,place:number,actions:string[])=>{
  const found:{kind:string;detail:string}[]=await page.evaluate(p=>(window as any).__invariants(p),pushing).catch(e=>[{kind:'check-failed',detail:String(e).slice(0,200)}]);
  for(const f of found){
   const key=`${f.kind}:${f.detail.replace(/[-\d.]+/g,'#')}`;
   const record={...f,episode,place,actions:[...actions]};
   if(!seen.has(key)){seen.add(key);const shot=`artifacts/fuzz/${findings.length}-${f.kind}.png`;await page.screenshot({path:shot}).catch(()=>{});findings.push({...record,shot});console.log('FINDING',JSON.stringify(record));}
  }
 };
 const hold=async(keys:string[],ms:number,episode:number,place:number,actions:string[])=>{
  for(const k of keys)await page.keyboard.down(k);pushing=keys.some(k=>/Key[WASD]/.test(k));
  for(let t=0;t<ms;t+=1000){await page.waitForTimeout(Math.min(1000,ms-t));await check(episode,place,actions);}
  for(const k of keys)await page.keyboard.up(k);pushing=false;
 };
 const log:unknown[]=[];
 for(let episode=0;episode<episodes;episode++){
  const place=Math.floor(rand()*PLACES.length),[x,y]=PLACES[place];
  // A new place every few episodes; the terrain streams in under CJ first.
  if(episode%3===0){
   await page.evaluate(([x,y])=>{const g=(window as any).__game,m=g.missionForProfiling();m.runtime.world.setPedCoordinates(1,x,y,-100);},[x,y]);
   await page.waitForFunction(()=>{const s=(window as any).__game.state();return s.player.grounded&&!s.terrainHold;},undefined,{timeout:90000}).catch(()=>{});
   await page.evaluate(()=>(window as any).__game.setWantedLevel(0));
  }
  const actions:string[]=[];
  for(let step=0;step<3;step++){
   const action=pick(ACTIONS);actions.push(action);
   await page.mouse.move(600+rand()*300,350+rand()*200);
   const dir=pick(['KeyW','KeyA','KeyD','KeyS']);
   switch(action){
    case 'walk':await hold([dir],2000+rand()*2000,episode,place,actions);break;
    case 'sprintJump':await page.keyboard.down('ShiftLeft');await hold(['KeyW'],600,episode,place,actions);await page.keyboard.press('Space');await hold(['KeyW'],1500,episode,place,actions);await page.keyboard.up('ShiftLeft');break;
    case 'crouchWalk':await page.keyboard.press('KeyC');await hold([dir],2000,episode,place,actions);await page.keyboard.press('KeyC');break;
    case 'aimFire':{
     const weapon=pick([22,24,25,28,30,31,35]);await page.evaluate(w=>{const g=(window as any).__game,m=g.missionForProfiling();m.runtime.world.givePedWeapon(1,w,500);m.runtime.world.setPedCurrentWeapon(1,w);},weapon);
     await page.mouse.down({button:'right'});await page.waitForTimeout(400);await page.mouse.down();await hold([dir],1500,episode,place,actions);await page.mouse.up();await page.mouse.up({button:'right'});break;}
    case 'punch':await page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling();m.runtime.world.setPedCurrentWeapon(1,0);});for(let i=0;i<4;i++){await page.keyboard.press('KeyR');await page.waitForTimeout(300);}await check(episode,place,actions);break;
    case 'spawnDrive':{
     await page.evaluate(m=>(window as any).__game.spawnVehicle(m),pick([596,481,522,510,471,400,411,560]));await page.waitForTimeout(2500);
     await page.keyboard.press('KeyF');await page.waitForTimeout(3000);
     await hold(['KeyW',pick(['KeyA','KeyD'])],3000+rand()*3000,episode,place,actions);await page.keyboard.press('KeyF');await page.waitForTimeout(2500);await check(episode,place,actions);break;}
    case 'jackNearest':await page.keyboard.press('KeyF');await page.waitForTimeout(5000);await check(episode,place,actions);await page.keyboard.press('KeyF');await page.waitForTimeout(2500);break;
    case 'fallFromHeight':await page.evaluate(()=>{const g=(window as any).__game,p=g.sim.player.position;g.placePlayer(p.x,p.y+25,p.z);});await hold([],4000,episode,place,actions);break;
    case 'grenade':await page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling();m.runtime.world.givePedWeapon(1,16,5);m.runtime.world.setPedCurrentWeapon(1,16);});await page.mouse.down();await page.waitForTimeout(600);await page.mouse.up();await hold([],3000,episode,place,actions);break;
    case 'wanted':await page.evaluate(()=>(window as any).__game.setWantedLevel(2));await hold([dir],4000,episode,place,actions);await page.evaluate(()=>(window as any).__game.setWantedLevel(0));break;
   }
  }
  // CJ is brought back to health between episodes so a death does not end the run.
  await page.evaluate(()=>{const g=(window as any).__game;try{g.missionForProfiling().runtime.world.setPedHealth(1,100);}catch{}});
  log.push({episode,place,actions});
  console.log(`episode ${episode} at ${PLACES[place]}: ${actions.join(', ')}; findings ${findings.length}`);
  writeFileSync('artifacts/fuzz/report.json',JSON.stringify({seed:process.env.FUZZ_SEED??1,episodes:log,findings,pageErrors:errors,subsystemFaults:[...new Set(faults)]},null,1));
 }
});
