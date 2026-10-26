import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('script armour absorbs live on-foot hits, reports its remainder and follows the ped through vehicle rebuilds',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});await endStoryMission(page);
 const h=await page.evaluate(()=>{const g=(window as any).__game,p=g.sim.player.position;return g.missionForProfiling().peds.create(4,'MALE01',{x:p.x+9,y:-p.z,z:p.y});});
 await page.waitForFunction(h=>{const p=(window as any).__game.missionForProfiling().peds.entity(h);return p?.view.hasHitSpheres&&!p.collisionWait;},h,{timeout:45000});
 const result=await page.evaluate(async h=>{
  const dep='/tests/fixtures/native-render-dependencies.ts',{RAPIER}=await import(/* @vite-ignore */ dep),probe='/tests/fixtures/fireNpcMountedAt.ts',{fireMountedAt}=await import(/* @vite-ignore */ probe),g=(window as any).__game,m=g.missionForProfiling(),a=m.adapterRef,p=m.peds.entity(h),crowd=g.pedestrians(),w=g.weapons();
  m.runtime.world.freezePedPosition(h,true);const states:any[]=[];
  const reset=(armour=100)=>{p.health=500;p.armour=0;p.defendMult=1;p.follow=false;p.proofs=undefined;p.down=0;p.stealth=undefined;p.noCriticalHits=false;a.addArmourToPed(h,armour);};
  const state=(name:string)=>states.push({name,health:p.health,armour:a.pedArmour(h),pool:m.peds.armourOf(h),weapon:p.lastWeaponDamage});
  const hit=(damage:number,weapon:number,piece=3,kind='bullet')=>crowd.damageCollider(p.collider.handle,damage,{x:0,z:1},kind,{weapon,piece,byPlayer:true});
  reset();hit(25,22);state('absorbed');hit(100,22);state('overflow');
  reset();p.defendMult=2;hit(30,22);state('weakness');
  reset();p.follow=true;hit(200,22);state('friendly');
  reset();hit(25,54,3,'collision');state('fall');
  reset();hit(25,53,3,'collision');state('drowning');
  reset();p.proofs={bullet:true};hit(25,22);state('proof');
  reset();hit(25,22,9);state('forcedHead');
  // Use the real scripted mounted-gun path, physical line query, accepted blood, and the script's armour getter.
  reset();p.noCriticalHits=true;const sphere=p.view.hitSpheres().find((s:any)=>s.piece===3),center=sphere.center;
  const ray=[{x:1,y:0,z:0},{x:-1,y:0,z:0},{x:0,y:0,z:1},{x:0,y:0,z:-1}].map(direction=>({direction,source:{x:center.x-direction.x*6,y:center.y,z:center.z-direction.z*6}})).find(r=>w.npcBulletLine(r.source,r.direction,20,g.sim.playerBody)?.collider.handle===p.collider.handle);
  if(!ray)throw Error('No live armour body line');const fx=w.fx.effects,old=fx.blood,blood:any[]=[];fx.blood=function(...args:any[]){blood.push({health:p.health,armour:a.pedArmour(h),count:args[2]});return old.apply(this,args);};
  let fired=false;try{fired=fireMountedAt(g,ray.source,ray.direction,RAPIER,false);}finally{fx.blood=old;}state('mounted');
  reset(75);hit(25,22);state('beforeRide');return {states,fired,blood,damage:w.inventory.info(38).damage};
 },h);
 const car=await page.evaluate(()=>{const g=(window as any).__game,p=g.sim.player.position;return g.missionForProfiling().vehicles.create(492,{x:p.x+15,y:-p.z,z:p.y+1},0);});
 await page.waitForFunction(c=>!!(window as any).__game.missionForProfiling().vehicles.entity(c),car,{timeout:45000});
 await page.evaluate(({h,car})=>(window as any).__game.missionForProfiling().runtime.world.warpPedIntoCar(h,car),{h,car});
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().peds.entity(h)?.rider,h,{timeout:45000});
 const seated=await page.evaluate(h=>(window as any).__game.missionForProfiling().adapterRef.pedArmour(h),h);
 await page.evaluate(h=>{const g=(window as any).__game,p=g.sim.player.position;g.missionForProfiling().runtime.world.warpPedFromCarToCoord(h,p.x+9,-p.z,p.y);},h);
 await page.waitForFunction(h=>{const p=(window as any).__game.missionForProfiling().peds.entity(h);return p&&!p.rider;},h,{timeout:45000});
 const returned=await page.evaluate(h=>{const m=(window as any).__game.missionForProfiling();return {armour:m.adapterRef.pedArmour(h),health:m.peds.healthOf(h)};},h);
 await page.evaluate(({h,car})=>{const host=(window as any).__game.missionForProfiling().runtime.world;host.deletePed(h);host.deleteVehicle(car);},{h,car});
 writeFileSync('artifacts/script-ped-armour.json',JSON.stringify({result,seated,returned,errors},null,2));
 const expected=[['absorbed',500,75],['overflow',475,0],['weakness',500,40],['friendly',500,87.5],['fall',475,100],['drowning',475,100],['proof',500,100],['forcedHead',0,75],['mounted',500-(result.damage-100),0],['beforeRide',500,50]];
 expect(result.states.map((s:any)=>[s.name,s.health,s.armour])).toEqual(expected);expect(result.states.every((s:any)=>s.armour===s.pool)).toBe(true);
 expect(result.fired).toBe(true);expect(result.blood).toEqual([{health:500-(result.damage-100),armour:0,count:8}]);expect(seated).toBe(50);expect(returned).toEqual({armour:50,health:500});expect(errors).toEqual([]);
});
