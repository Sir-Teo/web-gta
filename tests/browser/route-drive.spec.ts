import {test,expect} from '@playwright/test';
/** A sustained teleport drive for stuck reports, skipped unless ROUTE names one:
 * ROUTE='{"start":[x,y,z],"legs":[[x0,z0,x1,z1],...],"speed":15,"seconds":n}' (renderer coordinates, z = -native y).
 * Prints heap, Rapier body count, window swaps, holds, pedestrians and subsystem faults every 10 s; a fault or page
 * error fails it. This is the probe that found the pedestrian cull leak and the spawn-relative fall reset. */
test('route drive',async({page})=>{
 test.skip(!process.env.ROUTE,'set ROUTE to drive a route');const route=JSON.parse(process.env.ROUTE!);test.setTimeout(route.seconds*1000+200000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message.slice(0,200)));
 await page.goto('/');
 await page.evaluate(()=>{const perf={gaps:[] as number[][],work:[] as number[]};(window as any).__perf=perf;const raf=window.requestAnimationFrame.bind(window);let lastEnd=0;
  window.requestAnimationFrame=cb=>raf(now=>{const s=performance.now();cb(now);const e=performance.now(),gap=lastEnd?s-lastEnd:0;lastEnd=e;perf.work.push(e-s);if(gap>150||e-s>50)perf.gaps.push([Math.round(s),Math.round(gap),Math.round(e-s)]);});});
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await page.waitForFunction(()=>(window as any).__game?.state().player.grounded);
 // Jump to the route start high in the air; the follower fetches that window and the player drops onto it.
 await page.evaluate(([x,y,z])=>{(window as any).__game.placePlayer(x,y,z);},route.start);
 await page.waitForFunction(()=>{const s=(window as any).__game.state();return s.player.grounded&&!s.terrainHold&&s.following.pending===null;},null,{timeout:120000}).catch(()=>{});
 const arrived=await page.evaluate(()=>{const s=(window as any).__game.state();return {pos:[Math.round(s.player.position.x),Math.round(s.player.position.y),Math.round(s.player.position.z)],grounded:s.player.grounded,requests:s.following.requests,failures:s.following.failures,retry:s.following.retryAt};});
 console.log('ARRIVED '+JSON.stringify(arrived));
 await page.evaluate((speed)=>{(window as any).__routeSpeed=speed;},route.speed??15);
 await page.evaluate((legs)=>{const g=(window as any).__game;let leg=0,t=0;const speed=(window as any).__routeSpeed??15,dt=.2;(window as any).__samples=[];(window as any).__t0=performance.now();let lastSample=0,swaps=0,prevInst=-1,missing=0,held=0;
  (window as any).__driveTimer=setInterval(()=>{const s=g.state();if(s.importedInstances!==prevInst){prevInst=s.importedInstances;swaps++;}
   const now=performance.now()-(window as any).__t0;if(now-lastSample>10000){lastSample=now;const m=(performance as any).memory;(window as any).__samples.push({t:Math.round(now/1000),heapMB:m?+(m.usedJSHeapSize/1e6).toFixed(0):null,bodies:s.physics.bodies,instances:s.importedInstances,swaps,missing,held,peds:s.pedestrians?.people?.length,cars:s.traffic?.cars?.length??s.traffic?.count,requests:s.following.requests,failures:s.following.failures,faults:s.subsystemFaults,x:Math.round(s.player.position.x),y:Math.round(s.player.position.y),z:Math.round(s.player.position.z),leg});}
   if(s.paused||s.terrainHold){held++;return;}const L=legs[leg];if(!L)return;const len=Math.hypot(L[2]-L[0],L[3]-L[1]);t+=speed*dt;if(t>=len){t=0;leg++;return;}const f=t/len,x=L[0]+(L[2]-L[0])*f,z=L[1]+(L[3]-L[1])*f;const h=g.groundAt(x,z,900);if(h!==null)g.placePlayer(x,h+.05,z);else missing++;},200);},route.legs);
 await page.waitForTimeout(route.seconds*1000);
 const out=await page.evaluate(()=>{clearInterval((window as any).__driveTimer);const perf=(window as any).__perf;const w=[...perf.work].sort((a:number,b:number)=>a-b);return {samples:(window as any).__samples,gaps:perf.gaps.length,worst:perf.gaps.sort((a:number[],b:number[])=>b[2]-a[2]).slice(0,5),work:{p50:+w[Math.floor(w.length*.5)].toFixed(1),p99:+w[Math.floor(w.length*.99)].toFixed(1),max:+w[w.length-1].toFixed(1)}};});
 console.log('ROUTE '+JSON.stringify({...out,errors:errors.slice(0,3)}));
 expect(errors).toEqual([]);
 expect(out.samples.every((s:any)=>s.faults.length===0)).toBe(true);
});
