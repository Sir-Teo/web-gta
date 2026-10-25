import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('foot script victims retain actual types through handheld and real mounted gun damage and kill events',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});await endStoryMission(page);
 const results:any[]=[];
 for(const c of [{type:6,model:'MALE01',name:'COP'},{type:4,model:'LAPD1',name:'CIVMALE'},{type:7,model:'MALE01',name:'GANG1'},{type:17,model:'MALE01',name:'DEALER'},{type:20,model:'MALE01',name:'CRIMINAL'}]){
  const handles=await page.evaluate(c=>{const g=(window as any).__game,m=g.missionForProfiling(),p=g.sim.player.position;return {ped:m.peds.create(c.type,c.model,{x:p.x+10,y:-p.z,z:p.y}),plane:m.vehicles.create(425,{x:p.x+30,y:-p.z,z:p.y+8},0)};},c);
  await page.waitForFunction(h=>{const m=(window as any).__game.missionForProfiling();return !!m.peds.entity(h.ped)&&!!m.vehicles.entity(h.plane);},handles,{timeout:45000});
  await page.evaluate(h=>{const w=(window as any).__game.missionForProfiling().runtime.world;w.freezeVehiclePosition(h.plane,true);w.warpPedIntoCar(1,h.plane);w.freezePedPosition(h.ped,true);w.setPedSuffersCriticalHits(h.ped,false);},handles);
  results.push(await page.evaluate(async({handles,c})=>{
   const dep='/tests/fixtures/native-render-dependencies.ts',{THREE}=await import(/* @vite-ignore */ dep),g=(window as any).__game,m=g.missionForProfiling(),w=g.weapons(),crowd=g.pedestrians(),p=m.peds.entity(handles.ped),plane=m.vehicles.entity(handles.plane),aim=p.body.translation(),point={...aim};
   const q=[{x:-1,y:0,z:0},{x:1,y:0,z:0},{x:0,y:0,z:-1},{x:0,y:0,z:1}].map(direction=>({direction,source:{x:aim.x-direction.x*8,y:aim.y,z:aim.z-direction.z*8}})).find(q=>w.ray(q.source,q.direction,20,plane.body)?.collider.handle===p.collider.handle);if(!q)throw Error('No foot victim ray');
   const rotation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,-1),new THREE.Vector3(q.direction.x,0,q.direction.z)),[gx,gy,gz]=plane.gunPosition(),offset=new THREE.Vector3(gx,gz,-gy).applyQuaternion(rotation);plane.body.setRotation(rotation,true);plane.body.setTranslation({x:q.source.x-offset.x,y:q.source.y-offset.y,z:q.source.z-offset.z},true);plane.body.setLinvel({x:0,y:0,z:0},true);
   const oldCrime=w.onCrime,oldKill=crowd.onKill,crimes:any[]=[],kills:any[]=[];w.onCrime=(...args:any[])=>{crimes.push(args);oldCrime?.(...args);};crowd.onKill=(event:any)=>{kills.push(event);oldKill?.(event);};
   try{
    m.runtime.world.setPedHealth(handles.ped,1000);const weakness=p.defendMult;w.damage(p.collider.handle,10,q.direction,false,'bullet',{weapon:22,point});const handheld={health:p.health,calls:[...crimes]};crimes.length=0;
    m.runtime.world.setPedHealth(handles.ped,1000);const fired=w.fireAircraft(plane),mounted={fired,health:p.health,calls:[...crimes]};crimes.length=0;
    m.runtime.world.setPedHealth(handles.ped,1);w.damage(p.collider.handle,10,q.direction,false,'bullet',{weapon:22,point});
    return {...c,id:p.id,weakness,handheld,mounted,kills,dead:p.health===0};
   }finally{w.onCrime=oldCrime;crowd.onKill=oldKill;}
  },{handles,c}));
  await page.evaluate(h=>{const w=(window as any).__game.missionForProfiling().runtime.world;w.warpPedFromCarToCoord(1,2495,-1687,13.3);w.deletePed(h.ped);w.deleteVehicle(h.plane);},handles);
 }
 writeFileSync('artifacts/foot-ped-crime.json',JSON.stringify({results,errors},null,2));
 for(const r of results){const cop=r.name==='COP',care=['GANG1','DEALER','CRIMINAL'].includes(r.name),id=`ped:${r.id}`;expect(r.handheld.health).toBeCloseTo(1000-10*r.weakness,5);expect(r.handheld.calls).toEqual([[2,id,false,care],[cop?5:4,id,true,care],[4,id,false,care]]);expect(r.mounted.fired).toBe(true);expect(r.mounted.health).toBeCloseTo(1000-140*r.weakness,4);expect(r.mounted.calls.filter((a:any[])=>a[1]===id)).toEqual([[cop?5:4,id,true,care]]);expect(r.dead).toBe(true);expect(r.kills).toHaveLength(1);expect(r.kills[0]).toMatchObject({id:r.id,officer:cop,pedType:r.name,byPlayer:true});}
 expect(errors).toEqual([]);
});
