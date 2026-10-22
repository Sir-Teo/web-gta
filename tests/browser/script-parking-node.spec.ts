import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('SCRASH3’s original parking box cycles through the ten real San Fierro parking nodes',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 const result=await page.evaluate(async()=>{
  // Keep CJ's physical world in Grove Street. Load the real SF path neighborhood separately and lend it to the
  // adapter for the synchronous instruction batch, avoiding its ordinary player-centered loader evicting it.
  const [{readScmHeader,decodeScmInstructions},{openStaticWorld},{worldPaths}]=await Promise.all(['/src/assets/scm.ts','/src/assets/staticWorldArchive.ts','/src/assets/worldPaths.ts'].map(path=>import(/* @vite-ignore */ path))),g=(window as any).__game,m=g.missionForProfiling(),paths=worldPaths(await openStaticWorld(new URL('/play/world/',location.href).href));await paths.loadAround(-1720,-1018);
  const script=new Uint8Array(await(await fetch('/play/world/files/scripts/main.scm')).arrayBuffer()),block=readScmHeader(script).missions[51],site=decodeScmInstructions(script,block.start,block.end).find((i:any)=>i.opcode===0x810),v=new DataView(m.runtime.scriptSpace.buffer);
  const code=new Uint8Array(site.end-site.offset+2);code.set(script.subarray(site.offset,site.end));code.set([0x4e,0],site.end-site.offset);
  const original=m.world.carPathAreas;m.world.carPathAreas=()=>paths.areas;
  try{const points=Array.from({length:12},()=>{const slot=m.runtime.start(0,[],{space:code});slot.thread.run(g.gameTimeMs(),100,1);return [292,296,300].map(n=>v.getFloat32(n,true));});return {points,skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};}finally{m.world.carPathAreas=original;}
 });
 const expected=[[-1703.25,1012.25,16.5],[-1703.875,1024,16.5],[-1686.875,1020,16.5],[-1703.25,1003.625,16.5],[-1736.75,1016,16.5],[-1736.25,1025.375,16.5],[-1719.75,1012,16.5],[-1720,1032.625,16.5],[-1703.875,1032,16.5],[-1688.875,1052.75,16.5]];
 expect(result.points).toEqual([...expected,...expected.slice(0,2)]);expect(result.skipped).toEqual([]);expect(result.gaveUp).toEqual([]);expect(errors).toEqual([]);
});
