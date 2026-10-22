import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('STUNT projects its one-frame ped shadow and removes it when the script stops',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 await page.evaluate(async()=>{
  const path='/src/assets/scm.ts',{readScmHeader,decodeScmInstructions}=await import(/* @vite-ignore */ path),g=(window as any).__game,m=g.missionForProfiling(),script=new Uint8Array(await(await fetch('/play/world/files/scripts/main.scm')).arrayBuffer()),block=readScmHeader(script).missions[133],site=decodeScmInstructions(script,block.start,block.end).find((i:any)=>i.opcode===0x16f),p=g.state().player.position;
  const length=site.end-site.offset,code=new Uint8Array(length+11);code.set(script.subarray(site.offset,site.end));code.set([1,0,4,0,2,0,1,0,0,0,0],length);
  const slot=m.runtime.start(0,[],{space:code,mission:true});slot.thread.usesMissionCleanup=false;slot.thread.thisMustBeTheOnlyMissionRunning=false;slot.thread.name='SHDTEST';slot.thread.locals.setInt32(56*4,0,true);
  for(const [base,value] of [[127,p.x],[147,-p.z+6],[167,p.y+2]])slot.thread.locals.setFloat32(base*4,value,true);slot.thread.run(g.gameTimeMs(),100,1);g.turnPlayer(Math.PI);g.setTime(12*60);
 });
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().scriptShadows),{timeout:15000}).toEqual({drawn:1,types:[2]});
 // Rendering can run faster than the fixed world clock: keep this native frame's shadow between world updates.
 const frames=await page.evaluate(()=>new Promise<number[]>(resolve=>{const values:number[]=[];const next=()=>{values.push((window as any).__game.state().scriptShadows.drawn);if(values.length===20)resolve(values);else requestAnimationFrame(next);};requestAnimationFrame(next);}));expect(frames.every(n=>n===1)).toBe(true);
 const pixels=await page.evaluate(()=>{
  const r=(window as any).__game.render(),gl=r.renderer.getContext(),width=gl.drawingBufferWidth,height=gl.drawingBufferHeight,meshes:any[]=[];r.scene.traverse((o:any)=>{if(o.name==='Script shadow shad_ped')meshes.push(o);});
  const read=()=>{r.renderer.render(r.scene,r.camera);const bytes=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,bytes);return bytes;};const visible=meshes.map(m=>m.visible);
  try{const withShadow=read();meshes.forEach(m=>m.visible=false);const without=read();let darkened=0;for(let i=0;i<withShadow.length;i+=4)if(withShadow[i]+withShadow[i+1]+withShadow[i+2]<without[i]+without[i+1]+without[i+2])darkened++;return {darkened};}finally{meshes.forEach((m,i)=>m.visible=visible[i]);}
 });expect(pixels.darkened).toBeGreaterThan(20);
 await page.screenshot({path:'artifacts/script-shadow.png'});
 const result=await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling();m.runtime.terminateAllWithName('SHDTEST');return {skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().scriptShadows.drawn),{timeout:10000}).toBe(0);expect(result.skipped).toEqual([]);expect(result.gaveUp).toEqual([]);expect(errors).toEqual([]);
});
