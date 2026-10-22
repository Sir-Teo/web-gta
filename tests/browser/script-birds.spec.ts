import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('0876 shares the ambient bird renderer at night and preserves SYND4’s native float-bit conversion',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 const ordinary=await page.evaluate(()=>{
  const g=(window as any).__game,m=g.missionForProfiling();g.setTime(0);g.birdFrame(0);g.turnPlayer(Math.PI);
  for(const [x,y,z] of g.state().birds.positions)g.weapons().onBulletLine({x,y:z,z:-y},{x,y:z,z:-y});
  const p=m.runtime.world.pedPosition(1),start=[Math.round(p.x),Math.round(p.y+14),Math.round(p.z+5)],target=[start[0],start[1]+30,start[2]],code=new Uint8Array(44),view=new DataView(code.buffer);view.setUint16(0,0x876,true);
  let at=2;for(const n of [...start,...target,3,0]){code[at++]=1;view.setInt32(at,n,true);at+=4;}view.setUint16(at,0x4e,true);
  m.runtime.start(0,[],{space:code}).thread.run(g.gameTimeMs(),100,1);return {birds:g.state().birds,start};
 });
 expect(ordinary.birds.count).toBe(3);expect(ordinary.birds.positions).toEqual([ordinary.start,[ordinary.start[0]-1,ordinary.start[1]-1,ordinary.start[2]+.5],[ordinary.start[0]+2,ordinary.start[1]-2,ordinary.start[2]+1]]);
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().birds.drawn),{timeout:10000}).toBeGreaterThan(0);
 const actual=await page.evaluate(async()=>{
  const path='/src/assets/scm.ts',{readScmHeader,decodeScmInstructions}=await import(/* @vite-ignore */ path),g=(window as any).__game,m=g.missionForProfiling();
  for(const [x,y,z] of g.state().birds.positions)g.weapons().onBulletLine({x,y:z,z:-y},{x,y:z,z:-y});
  const script=new Uint8Array(await(await fetch('/play/world/files/scripts/main.scm')).arrayBuffer()),block=readScmHeader(script).missions[61],sites=decodeScmInstructions(script,block.start,block.end).filter((i:any)=>i.opcode===0x876);
  const snapshots=[];for(const i of sites){const code=new Uint8Array(i.end-i.offset+2);code.set(script.subarray(i.offset,i.end));code.set([0x4e,0],i.end-i.offset);m.runtime.start(0,[],{space:code}).thread.run(g.gameTimeMs(),100,1);snapshots.push(g.state().birds);}
  return {snapshots,skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};
 });
 expect(actual.snapshots.map(s=>s.count)).toEqual([3,6]);expect(actual.snapshots[0].positions[0][0]).toBeGreaterThan(1e9);expect(actual.snapshots[1].positions[3][0]).toBeLessThan(-9e8);
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().birds.count),{timeout:10000}).toBe(0);
 expect(actual.skipped).toEqual([]);expect(actual.gaveUp).toEqual([]);expect(errors).toEqual([]);
});
