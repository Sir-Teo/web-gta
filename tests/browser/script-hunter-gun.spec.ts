import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('0541 fires the Hunter offset through the live vehicle host, shares its timer, and keeps enemy attribution',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 const h=await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling(),p=m.runtime.world.pedPosition(1);return m.vehicles.create(425,{x:p.x+20,y:p.y,z:p.z+100});});
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),h,{timeout:60000});
 const result=await page.evaluate(async h=>{
  const path='/tests/fixtures/native-render-dependencies.ts',{RAPIER}=await import(/* @vite-ignore */ path);
  const g=(window as any).__game,m=g.missionForProfiling(),v=m.vehicles.entity(h),body=v.body,weapons=g.weapons();
  body.setEnabled(true);body.setRotation({x:0,y:0,z:0,w:1},true);body.setLinvel({x:0,y:0,z:0},true);body.setAngvel({x:0,y:0,z:0},true);
  const p={...body.translation()},target=g.sim.world.createCollider(RAPIER.ColliderDesc.ball(2).setTranslation(p.x,p.y-1.3,p.z-30));
  g.sim.world.step();body.setTranslation(p,true);body.setLinvel({x:0,y:0,z:0},true);body.setAngvel({x:0,y:0,z:0},true);body.setRotation({x:0,y:0,z:0,w:1},true);
  const hits:any[]=[],flashes:any[]=[],oldHit=weapons.onObjectShot,oldFlash=weapons.fx.gunshot.bind(weapons.fx),ammo=JSON.stringify([...weapons.inventory.ammo]);
  weapons.onObjectShot=(hit:any,point:any,incremental:boolean,sniper:boolean,weapon:number,byPlayer:boolean)=>{if(hit.collider.handle===target.handle)hits.push({weapon,byPlayer,point});else oldHit?.(hit,point,incremental,sniper,weapon,byPlayer);};
  weapons.fx.gunshot=(origin:any,direction:any,weapon:number,flash:boolean,options:any)=>{flashes.push({origin:{...origin},direction:{...direction},weapon,options});oldFlash(origin,direction,weapon,flash,options);};
  const shots=weapons.aircraftShots,code=new Uint8Array([0x41,5,1,0,0,0,0,0x4e,0]);new DataView(code.buffer).setInt32(3,h,true);
  for(let i=0;i<2;i++)m.runtime.start(0,[],{space:code}).thread.run(g.gameTimeMs(),1000,1);
  weapons.onObjectShot=oldHit;weapons.fx.gunshot=oldFlash;g.sim.world.removeCollider(target,true);
  return {shots:weapons.aircraftShots-shots,hits,flashes,p,ammoUnchanged:JSON.stringify([...weapons.inventory.ammo])===ammo,skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};
 },h);
 expect(result.shots).toBe(1);expect(result.hits).toHaveLength(1);expect(result.hits[0]).toMatchObject({weapon:38,byPlayer:false});expect(result.flashes).toHaveLength(1);
 const flash=result.flashes[0];expect(flash.origin.x).toBeCloseTo(result.p.x,3);expect(flash.origin.y).toBeCloseTo(result.p.y-1.3,3);expect(flash.origin.z).toBeCloseTo(result.p.z-4.8,3);expect(flash.direction).toEqual({x:0,y:0,z:-1});
 expect(flash.options.shell).toMatchObject({direction:[0,Math.fround(.1)],size:Math.fround(.025)});expect(result.ammoUnchanged).toBe(true);expect(result.skipped).toEqual([]);expect(result.gaveUp).toEqual([]);expect(errors).toEqual([]);
});
