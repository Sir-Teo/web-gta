import {test,expect,type Page} from '@playwright/test';
import {endStoryMission} from './freeRoam';

async function executeDeconSwap(page:Page,offset:number){
 return page.evaluate(async offset=>{
  const path='/src/assets/scm.ts',{readScmHeader,decodeScmInstructions}=await import(/* @vite-ignore */ path),g=(window as any).__game,m=g.missionForProfiling(),bytes=new Uint8Array(await(await fetch('/play/world/files/scripts/main.scm')).arrayBuffer()),block=readScmHeader(bytes).missions[50],site=decodeScmInstructions(bytes,block.start,block.end).find((i:any)=>i.offset===offset),code=new Uint8Array(site.end-site.offset+2);
  code.set(bytes.subarray(site.offset,site.end));code.set([0x4e,0],site.end-site.offset);const slot=m.runtime.start(0,[],{space:code});slot.thread.run(g.gameTimeMs(),100,1);return site.name;
 },offset);
}
async function snapshot(page:Page,ref?:{sourceName:string;format:string;index:number}){
 return page.evaluate(async ref=>{
  await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
  const g=(window as any).__game,s=g.terrainForProfiling(),index=s.parts.findIndex((p:any)=>ref?p.sourceRefs?.some((r:any)=>r.sourceName===ref.sourceName&&r.format===ref.format&&r.index===ref.index):p.name.toLowerCase()==='hubhole1_sfse'),p=s.parts[index];if(!p)return null;const placement=ref?p.sourceRefs.findIndex((r:any)=>r.sourceName===ref.sourceName&&r.format===ref.format&&r.index===ref.index):0;
  const handles=[...s.sources].filter(([,r]:any)=>r.placement===p.placements[placement]).map(([h]:any)=>h),neighbor=[...s.sources].filter(([,r]:any)=>r.modelName!==p.name).slice(0,40).map(([h]:any)=>h),heights=[];
  for(let x=-8;x<=8;x+=2)for(let y=-8;y<=8;y+=2)heights.push(g.surfaceAt(-2049.171875+x,-250.3203125-y,37));
  let meshes=0,visible=0;s.root.children[index].traverse((o:any)=>{if(o.isMesh){meshes++;if(o.visible)visible++;}});
  const positions=p.model.geometries.flatMap((q:any)=>Array.from(q.positions)),signature=JSON.stringify(positions);
  return {name:p.name,placement:p.placements[placement],ref:p.sourceRefs[placement],handles,neighbor,heights,meshes,visible,signature,ledger:g.buildingSwaps(),reused:s.reusedPlacementCount};
 },ref);
}

async function waitForModel(page:Page,ref:{sourceName:string;format:string;index:number},name:string){
 await page.waitForFunction(({ref,name})=>(window as any).__game.terrainForProfiling()?.parts.some((p:any)=>p.name.toLowerCase()===name&&p.sourceRefs?.some((r:any)=>r.sourceName===ref.sourceName&&r.format===ref.format&&r.index===ref.index)),{ref,name},{timeout:60000});
}

test('DECON’s original building swaps replace the excavation’s visible model and COL, restore it and survive streaming',async({page})=>{
 test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 await page.evaluate(()=>{const g=(window as any).__game;g.missionForProfiling().runtime.world.setPedCoordinates(1,-2073,250,38);g.sim.player.health=10000;});
 await page.waitForFunction(()=>(window as any).__game.terrainForProfiling()?.parts.some((p:any)=>p.name.toLowerCase()==='hubhole1_sfse'),undefined,{timeout:90000});
 await page.waitForFunction(()=>{const g=(window as any).__game;return g.sim.player.grounded&&g.surfaceAt(-2049.171875,-250.3203125,80)!==null;},undefined,{timeout:30000});
 const before=(await snapshot(page))!;expect(before.meshes).toBeGreaterThan(0);
 expect(await executeDeconSwap(page,1384334)).toBe('SWAP_NEAREST_BUILDING_MODEL');
 await waitForModel(page,before.ref,'hubhole2_sfse');
 const open=(await snapshot(page,before.ref))!;expect(open.signature).not.toBe(before.signature);expect(open.handles.some(h=>before.handles.includes(h))).toBe(false);expect(open.placement.position).toEqual(before.placement.position);expect(open.ref).toEqual(before.ref);expect(open.meshes).toBeGreaterThan(0);expect(open.reused).toBeGreaterThan(0);expect(open.ledger.tracked).toHaveLength(1);
 expect(open.neighbor.some(h=>before.neighbor.includes(h))).toBe(true);
 expect(open.heights.some((h:any,i:number)=>h&&before.heights[i]&&Math.abs(h.y-before.heights[i]!.y)>.1)).toBe(true);
 // Restore via the original failure path, then re-open and fill via the original success path.
 await executeDeconSwap(page,1402873);await waitForModel(page,before.ref,'hubhole1_sfse');
 const restored=(await snapshot(page,before.ref))!;expect(restored.signature).toBe(before.signature);expect(restored.ledger.tracked).toEqual([]);
 await executeDeconSwap(page,1384334);await waitForModel(page,before.ref,'hubhole2_sfse');
 await executeDeconSwap(page,1402940);await waitForModel(page,before.ref,'hubhole4_sfse');
 const filled=(await snapshot(page,before.ref))!;expect(filled.signature).not.toBe(open.signature);expect(filled.ledger.tracked[0]).toMatchObject({original:'hubhole1_sfse',current:'hubhole4_sfse'});
 expect(filled.heights.some((h:any,i:number)=>h&&open.heights[i]&&Math.abs(h.y-open.heights[i]!.y)>.1)).toBe(true);
 await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.setPedCoordinates(1,2490,-1668,14));
 await page.waitForFunction(()=>!(window as any).__game.terrainForProfiling().parts.some((p:any)=>/^hubhole[124]_sfse$/i.test(p.name)),undefined,{timeout:90000});
 await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.setPedCoordinates(1,-2073,250,38));
 await waitForModel(page,before.ref,'hubhole4_sfse');
 const returned=(await snapshot(page,before.ref))!;expect(returned.ref).toEqual(before.ref);expect(returned.signature).toBe(filled.signature);expect(returned.meshes).toBeGreaterThan(0);
 const state=await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling();return {skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};});expect(state).toEqual({skipped:[],gaveUp:[]});expect(errors).toEqual([]);
});
