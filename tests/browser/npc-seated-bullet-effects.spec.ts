import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

for(const player of [false,true])test(`incoming seated impacts use accepted native blood for ${player?'CJ':'script riders'}`,async({page})=>{
 test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});await endStoryMission(page);
 await page.waitForFunction(()=>!!(window as any).__game.weapons().fx?.effects,undefined,{timeout:45000});
 const cases:{model:number;piece:number;health:number;count:number;block?:string;byPlayer?:boolean}[]=[{model:492,piece:9,health:10000,count:16},{model:492,piece:9,health:1,count:32},{model:492,piece:9,health:10000,count:0,block:'only player'},
  {model:461,piece:3,health:10000,count:8},{model:461,piece:9,health:10000,count:16},{model:461,piece:9,health:1,count:32},{model:461,piece:3,health:10000,count:0,block:'only player'}],results:any[]=[];
 if(player)cases.push({model:492,piece:9,health:10000,count:0,block:'safe'});
 else for(const model of [492,461])for(const byPlayer of [false,true])cases.push({model,piece:model===492?9:3,health:10000,count:0,block:'bullet proof',byPlayer});
 for(const c of cases){
  const vehicle=await page.evaluate(model=>{const g=(window as any).__game,p=g.sim.player.position;return g.missionForProfiling().vehicles.create(model,{x:p.x+8,y:-p.z,z:p.y+2},0);},c.model);
  await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),vehicle,{timeout:45000});
  const ped=await page.evaluate(({vehicle,player})=>{
   const g=(window as any).__game,m=g.missionForProfiling(),host=m.runtime.world;host.freezeVehiclePosition(vehicle,true);
   const ped=player?1:m.peds.createInCar(4,'MALE01',vehicle,'driver');if(player)host.warpPedIntoCar(1,vehicle);
   g.sim.playerCanBeDamaged=true;g.sim.playerProofs=undefined;return ped;
  },{vehicle,player});
  await page.waitForFunction(({vehicle,ped,player})=>{const g=(window as any).__game,m=g.missionForProfiling(),v=m.vehicles.entity(vehicle);return player?g.render().vehiclePose?.frame.vehicle===v.car.root:g.weapons().seatedPeds().some((t:any)=>t.rider===m.peds.entity(ped)&&!!t.head);},{vehicle,ped,player},{timeout:45000});
  results.push(await page.evaluate(async({vehicle,ped,player,c})=>{
   const dep='/tests/fixtures/native-render-dependencies.ts',{RAPIER}=await import(/* @vite-ignore */ dep),probe='/tests/fixtures/fireNpcMountedAt.ts',{fireMountedAt}=await import(/* @vite-ignore */ probe),geometry='/src/combat/nativePedHitSpheres.ts',{pedSphereHit}=await import(/* @vite-ignore */ geometry),g=(window as any).__game,m=g.missionForProfiling(),w=g.weapons(),sim=g.sim,v=m.vehicles.entity(vehicle),rider=player?sim.player:m.peds.entity(ped),target=player?undefined:w.seatedPeds().find((t:any)=>t.rider===rider);
   m.runtime.world.setPedCanBeShotInVehicle(ped,true);
   if(player)sim.player.health=c.health;else{m.runtime.world.setPedSuffersCriticalHits(ped,false);m.runtime.world.setPedHealth(ped,c.health);}
   const spheres=c.model===461?(player?g.render().nativeCharacter.hitSpheres():target.hitSpheres()):undefined,center=spheres?spheres.find((s:any)=>s.piece===c.piece)?.center:player?g.render().nativeCharacter.headPosition():target.head;
   if(!center)throw Error(`No drawn ${player?'CJ':'rider'}:${c.model}:${c.piece}`);
   const axes=[{x:1,y:0,z:0},{x:-1,y:0,z:0},{x:0,y:0,z:1},{x:0,y:0,z:-1}],rays=axes.map(direction=>({direction,source:{x:center.x-direction.x*6,y:center.y+(c.model===461?0:.1),z:center.z-direction.z*6}}));
   const ray=rays.find(r=>{if(spheres&&pedSphereHit(r.source,r.direction,20,spheres)?.piece!==c.piece)return false;const hit=w.npcBulletLine(r.source,r.direction,20,sim.playerBody),seat=g.pedestrians().seatedShot(r.source,r.direction,20,{handle:-9999},hit?.collider.parent(),{distance:hit?.timeOfImpact??20,tyre:false});return seat?.victim===rider&&!!seat.direct===(c.model===461);});
   if(!ray)throw Error(`No exposed incoming seat line ${player}:${c.model}:${c.piece}`);
   // Set rejection after measuring the geometric contact; it must not turn a protected rider into a blood hit.
   if(player){sim.player.armour=0;sim.playerCanBeDamaged=c.block!=='safe';sim.playerProofs={bullet:c.block==='only player',fire:false,explosion:false,collision:false,melee:false};}
   else{m.runtime.world.setPedInvulnerable(ped,c.block==='only player');m.runtime.world.setPedProofs(ped,{bullet:c.block==='bullet proof',fire:false,explosion:false,collision:false,melee:false});}
   const fx=w.fx.effects,oldBlood=fx.blood,oldAudio=w.onPedBulletHit,blood:any[]=[],audio:any[]=[];fx.blood=function(...args:any[]){blood.push({count:args[2],health:rider.health});return oldBlood.apply(this,args);};w.onPedBulletHit=(...args:any[])=>{audio.push(args);oldAudio?.(...args);};
   try{
    const before=v.health,fired=fireMountedAt(g,ray.source,ray.direction,RAPIER,!!c.byPlayer),row:any={...c,fired,blood:[...blood],audio:audio.length,after:rider.health,carDamage:before-v.health};
    if(c.block==='bullet proof'){
     m.runtime.world.setPedProofs(ped,{bullet:false,fire:false,explosion:false,collision:false,melee:false});blood.length=0;
     row.cleared={fired:fireMountedAt(g,ray.source,ray.direction,RAPIER,!!c.byPlayer),blood:[...blood],after:rider.health,carDamage:before-v.health};
    }
    return row;
   }
   finally{fx.blood=oldBlood;w.onPedBulletHit=oldAudio;sim.playerCanBeDamaged=true;sim.player.health=100;sim.deathRemaining=0;sim.playerProofs=undefined;}
  },{vehicle,ped,player,c}));
  await page.evaluate(({vehicle,ped,player})=>{const m=(window as any).__game.missionForProfiling(),host=m.runtime.world;if(player)host.warpPedFromCarToCoord(1,2495,-1687,13.3);else host.deletePed(ped);host.deleteVehicle(vehicle);},{vehicle,ped,player});
 }
 writeFileSync(`artifacts/npc-seated-${player?'cj':'riders'}-effects.json`,JSON.stringify({results,errors},null,2));
 for(const r of results){expect(r.fired).toBe(true);expect(r.audio).toBe(1);expect(r.carDamage).toBe(0);expect(r.blood.map((b:any)=>b.count)).toEqual(r.count?[r.count]:[]);if(r.count){expect(r.after).toBeLessThan(r.health);expect(r.blood[0].health).toBe(r.after);}else expect(r.after).toBe(r.health);if(r.cleared){expect(r.cleared.fired).toBe(true);expect(r.cleared.after).toBeLessThan(r.health);expect(r.cleared.carDamage).toBe(0);expect(r.cleared.blood.map((b:any)=>b.count)).toEqual([r.piece===9?16:8]);}}
 expect(errors).toEqual([]);
});
