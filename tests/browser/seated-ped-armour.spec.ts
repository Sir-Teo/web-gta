import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('car/bike mission riders and car recruits spend original hit factors before forced head death',async({page})=>{
 test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});await endStoryMission(page);await page.waitForFunction(()=>!!(window as any).__game.weapons().fx?.effects,undefined,{timeout:45000});
 const results:any[]=[];
 // Recruits use their car renderer and member slot 6, whose native exit delay leaves time for both pistol shots.
 // Mission riders additionally exercise native bike spheres.
 for(const model of [492,461])for(const recruit of [false,true]){
  if(recruit&&model===461)continue;
  const car=await page.evaluate(model=>{const g=(window as any).__game,p=g.sim.player.position;return g.missionForProfiling().vehicles.create(model,{x:p.x+9,y:-p.z,z:p.y+1},0);},model);
  await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),car,{timeout:45000});
  const ped=await page.evaluate(({car,recruit})=>{const g=(window as any).__game,m=g.missionForProfiling();m.runtime.world.freezeVehiclePosition(car,true);if(!recruit)return m.peds.createInCar(4,'MALE01',car,'driver');m.runtime.world.warpPedIntoCar(1,car);g.carEntry().passengers.push({modelRef:'FAM1',seat:1,follow:true,gang:1,keep:{id:9400,health:5000,armour:100,defendMult:1,noCriticalHits:true,pedType:'GANG2',gang:1,gangClips:true,slot:6}});return null;},{car,recruit});
  await page.waitForFunction(({car,ped,recruit})=>{const g=(window as any).__game,m=g.missionForProfiling(),v=m.vehicles.entity(car);return g.weapons().seatedPeds().some((t:any)=>t.car===v&&!!t.head&&(recruit?t.kind==='passenger':t.rider===m.peds.entity(ped)));},{car,ped,recruit},{timeout:45000});
  for(const trial of [{source:'npc',defend:.5,critical:false},{source:'vehicle',defend:1,critical:false},{source:'remote',defend:2,critical:false},{source:'ped',defend:2,critical:false},{source:'ped',defend:2,critical:true}]){
   if(recruit&&trial.source==='ped'&&!trial.critical){await page.evaluate(()=>(window as any).__game.carEntry().abandon());await page.waitForFunction(car=>{const g=(window as any).__game,v=g.missionForProfiling().vehicles.entity(car);return !v.occupied&&g.carEntry().passengerTargets().some((t:any)=>t.car===v);},car,{timeout:10000});}
   if(trial.source==='ped')await page.waitForFunction(()=>(window as any).__game.weapons().inventory.cooldown<=0,undefined,{timeout:30000});
   results.push(await page.evaluate(async({car,ped,recruit,model,trial})=>{
    const dep='/tests/fixtures/native-render-dependencies.ts',{RAPIER}=await import(/* @vite-ignore */ dep),probe='/tests/fixtures/fireNpcMountedAt.ts',{fireMountedAt}=await import(/* @vite-ignore */ probe),g=(window as any).__game,m=g.missionForProfiling(),w=g.weapons(),v=m.vehicles.entity(car),target=w.seatedPeds().find((t:any)=>t.car===v&&(recruit?t.kind==='passenger':t.rider===m.peds.entity(ped))),r=target?.rider,state=recruit?r?.keep:r;if(!state)throw Error(`Missing ${recruit?'recruit':'mission'} target for ${trial.source}, critical=${trial.critical}`);
    state.health=5000;state.armour=100;state.defendMult=trial.defend;state.noCriticalHits=!trial.critical;
    const center=model===461?target.hitSpheres().find((s:any)=>s.piece===9).center:{...target.head,y:target.head.y+.1};
    const ray=[{x:1,y:0,z:0},{x:-1,y:0,z:0},{x:0,y:0,z:1},{x:0,y:0,z:-1}].map(direction=>({direction,source:{x:center.x-direction.x*6,y:center.y,z:center.z-direction.z*6}})).find(line=>{const hit=w.npcBulletLine(line.source,line.direction,20,g.sim.playerBody);return g.pedestrians().seatedShot(line.source,line.direction,20,{handle:-9999},hit?.collider.parent(),{distance:hit?.timeOfImpact??20,tyre:false})?.victim===r;});
    if(!ray)throw Error('No seated armour head line');const fx=w.fx.effects,oldBlood=fx.blood,oldMuzzle=w.muzzle,oldSpread=w.aimSpread,start={...g.sim.player.position},blood:any[]=[];fx.blood=function(...args:any[]){const current=recruit?r.keep:r;blood.push({count:args[2],health:current.health,armour:current.armour});return oldBlood.apply(this,args);};
    if(recruit&&trial.critical){m.runtime.world.freezeVehiclePosition(car,false);v.car.body.setLinvel({x:5,y:0,z:0},true);if(v.canStepOut())throw Error('Fatal recruit ride is still stopped');}
    const carBefore=v.health;let fired=false;
    try{
     if(trial.source==='ped'){
      g.placePlayer(ray.source.x,ray.source.y-1.3,ray.source.z);w.inventory.give(22,100);w.muzzle=()=>ray.source;w.aimSpread=(direction:any)=>direction;w.firstPerson=undefined;w.inventory.select(22);w.aiming=true;fired=w.fire({origin:ray.source,direction:ray.direction});
     }else fired=fireMountedAt(g,ray.source,ray.direction,RAPIER,trial.source!=='npc',trial.source==='vehicle');
     if(recruit&&trial.critical){v.car.body.setLinvel({x:0,y:0,z:0},true);m.runtime.world.freezeVehiclePosition(car,true);}
     const current=recruit?r.keep:r;return {model,recruit,...trial,fired,health:current.health,armour:current.armour,queried:recruit?undefined:m.adapterRef.pedArmour(ped),dead:!!r.diedInSeat,blood,carDamage:carBefore-v.health,base:w.inventory.info(trial.source==='ped'?22:38).damage};
    }finally{fx.blood=oldBlood;w.muzzle=oldMuzzle;w.aimSpread=oldSpread;if(trial.source==='ped')g.placePlayer(start.x,start.y,start.z);}
   },{car,ped,recruit,model,trial}));
  }
  await page.evaluate(({car,ped,recruit})=>{const g=(window as any).__game,host=g.missionForProfiling().runtime.world;if(recruit){g.carEntry().passengers.length=0;host.warpPedFromCarToCoord(1,2495,-1687,13.3);}else host.deletePed(ped);host.deleteVehicle(car);},{car,ped,recruit});
 }
 writeFileSync('artifacts/seated-ped-armour.json',JSON.stringify({results,errors},null,2));
 for(const r of results){const scaled=r.base*r.defend,damage=r.source==='ped'&&r.recruit?Math.min(scaled*Math.fround(.1),12.5):scaled,armour=Math.max(0,100-damage),health=r.critical?0:5000-Math.max(0,damage-100);expect(r.fired).toBe(true);expect(r.health).toBeCloseTo(health,5);expect(r.armour).toBeCloseTo(armour,5);if(!r.recruit)expect(r.queried).toBe(r.armour);expect(r.dead).toBe(r.critical);expect(r.blood).toHaveLength(1);expect(r.blood[0].count).toBe(r.critical?32:16);expect(r.blood[0].health).toBe(r.health);expect(r.blood[0].armour).toBe(r.armour);expect(r.carDamage).toBe(0);}
 expect(errors).toEqual([]);
});
