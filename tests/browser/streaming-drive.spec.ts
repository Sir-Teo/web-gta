import {test,expect} from '@playwright/test';
/** Drives CJ west along the Los Santos flood channel at car speed (15 m/s, teleporting each 200 ms onto the ground)
 * through several 180-unit windows, as a car ride through Ganton and East Los Santos does, and checks that terrain
 * following never stops: every window installs, the safety pause stays short, and the frame loop keeps running.
 * Frame gaps and long tasks are reported for performance work; only the streaming outcome is asserted. */
test('driving through several windows keeps streaming without stopping or stranding the player',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.evaluate(()=>{
  const perf={long:[] as number[][],gaps:[] as number[][],installs:[] as number[][],warns:[] as string[],work:[] as number[],period:[] as number[]};(window as any).__perf=perf;
  new PerformanceObserver(list=>{for(const e of list.getEntries())perf.long.push([Math.round(e.startTime),Math.round(e.duration)]);}).observe({entryTypes:['longtask']});
  const raf=window.requestAnimationFrame.bind(window);let lastEnd=0;
  let lastStart=0;
  window.requestAnimationFrame=cb=>raf(now=>{const s=performance.now();cb(now);const e=performance.now(),gap=lastEnd?s-lastEnd:0;if(lastStart)perf.period.push(s-lastStart);lastStart=s;lastEnd=e;perf.work.push(e-s);if(gap>150||e-s>50)perf.gaps.push([Math.round(s),Math.round(gap),Math.round(e-s)]);});
  const warn=console.warn.bind(console);console.warn=(...a:unknown[])=>{perf.warns.push(String(a[0]).slice(0,200));warn(...a);};
 });
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 const before=await state();
 await page.evaluate(()=>{
  const game=(window as any).__game,perf=(window as any).__perf;let x=2600,prevInst=-1;const z=1550,speed=15,dtMs=200;
  (window as any).__drive={steps:0,pausedTicks:0};
  (window as any).__driveTimer=setInterval(()=>{
   const s=game.state();if(s.importedInstances!==prevInst){perf.installs.push([Math.round(performance.now()),s.importedInstances,s.following?.requests??0,s.following?.lastSwap?.ms??0,s.following?.lastSwap?.payloadMB??0,s.following?.lastSwap?.parts??0,s.following?.lastSwap?.reusedPlacements??0,s.following?.lastSwap?.resident??0,s.following?.lastSwap?.prebuiltMs??0]);prevInst=s.importedInstances;}
   if(s.paused||s.terrainHold){(window as any).__drive.pausedTicks++;return;}
   x-=speed*dtMs/1000;const g=game.groundAt(x,z,300);if(g!==null)game.placePlayer(x,g+.05,z);(window as any).__drive.steps++;
  },dtMs);
 });
 // 60 s at 15 m/s: about 900 m, a dozen window requests.
 await page.waitForTimeout(60000);
 const result=await page.evaluate(()=>{clearInterval((window as any).__driveTimer);const s=(window as any).__game.state();return {drive:(window as any).__drive,following:s.following,paused:s.paused,position:s.player.position,perf:(window as any).__perf,modelBuild:s.modelBuild,pooledModels:s.pooledModels,frameProfile:s.frameProfile};});
 const percentiles=(values:number[])=>{const sorted=[...values].sort((a,b)=>a-b),at=(q:number)=>+(sorted[Math.min(sorted.length-1,Math.floor(q*sorted.length))]??0).toFixed(1);return {n:sorted.length,p50:at(.5),p90:at(.9),p99:at(.99),max:+(sorted.at(-1)??0).toFixed(1)};};
 // Frame work is the animate callback (simulation, population, render submission); period is the frame spacing.
 const fp=result.frameProfile,avg=(o:any)=>Object.fromEntries(Object.entries(o).filter(([k,v])=>k!=='frames'&&typeof v==='number').map(([k,v])=>[k,+((v as number)/Math.max(1,o.frames)).toFixed(2)])),profile={...avg(fp),renderSections:avg(fp.renderSections)};
 console.log(JSON.stringify({drive:result.drive,following:result.following,frameProfileMs:profile,modelBuild:result.modelBuild,pooledModels:result.pooledModels,frameWorkMs:percentiles(result.perf.work.slice(60)),framePeriodMs:percentiles(result.perf.period.slice(60)),installs:result.perf.installs,gaps:result.perf.gaps,long:result.perf.long,warns:result.perf.warns}));
 expect(errors).toEqual([]);
 expect(result.following.enabled).toBe(true);
 expect(result.following.requests).toBeGreaterThanOrEqual(8);
 expect(result.following.pending===null||result.perf.installs.length>=8).toBe(true);
 expect(result.perf.installs.length).toBeGreaterThanOrEqual(8);
 expect(result.position.x).toBeLessThan(before.player.position.x-600);
 // The safety boundary may hold the player briefly, never for most of the ride.
 expect(result.drive.pausedTicks).toBeLessThan(60);
 await page.screenshot({path:'artifacts/streaming-drive.png'});
});
