import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('DES10 draws its requested moon corona and headlight flares, then fades after its script stops',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 await page.evaluate(async()=>{
  const path='/src/assets/scm.ts',{readScmHeader,decodeScmInstructions}=await import(/* @vite-ignore */ path),g=(window as any).__game,m=g.missionForProfiling(),script=new Uint8Array(await(await fetch('/play/world/files/scripts/main.scm')).arrayBuffer()),block=readScmHeader(script).missions[82],site=decodeScmInstructions(script,block.start,block.end).find((i:any)=>i.opcode===0x4d5),p=g.state().player.position;
  g.turnPlayer(Math.PI);const globals=new DataView(m.runtime.scriptSpace.buffer);globals.setFloat32(292,p.x,true);globals.setFloat32(296,-p.z+15,true);globals.setFloat32(300,p.y+2,true);
  const length=site.end-site.offset,code=new Uint8Array(length+11);code.set(script.subarray(site.offset,site.end));code.set([1,0,4,0,2,0,1,0,0,0,0],length);
  const slot=m.runtime.start(0,[],{space:code,mission:true});slot.thread.usesMissionCleanup=false;slot.thread.thisMustBeTheOnlyMissionRunning=false;slot.thread.name='CRNTEST';slot.thread.locals.setFloat32(110*4,1,true);slot.thread.run(g.gameTimeMs(),100,1);
 });
 const slot=()=>page.evaluate(()=>(window as any).__game.coronaSlots().find((c:any)=>c.id>=0x70000000&&c.color[0]===0&&c.color[1]===255&&c.color[2]===0));
 await expect.poll(slot,{timeout:10000}).toMatchObject({type:2,flare:2,size:1,farClip:150,nearClip:Math.fround(.2),reflection:true});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().coronas.types),{timeout:10000}).toContain(2);
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().coronaFlares.world),{timeout:10000}).toBeGreaterThanOrEqual(26);
 await page.screenshot({path:'artifacts/script-weaponshop-corona.png'});const id=(await slot()).id;
 const result=await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling();m.runtime.terminateAllWithName('CRNTEST');return {skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};});
 await expect.poll(()=>page.evaluate(id=>(window as any).__game.coronaSlots().some((c:any)=>c.id===id),id),{timeout:10000}).toBe(false);
 expect(result.skipped).toEqual([]);expect(result.gaveUp).toEqual([]);expect(errors).toEqual([]);
});
