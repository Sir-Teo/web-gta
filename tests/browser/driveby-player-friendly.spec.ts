import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

for(const model of [0,492,461])test(`scripted drive-by respects CJ friendship in ${model||'on-foot'} contacts`,async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 await page.waitForFunction(()=>{const g=(window as any).__game;return g?.state().player.grounded&&g.driveby()?.snapshot().ready&&g.weapons().fx?.effects;},undefined,{timeout:60000});
 const handles=await page.evaluate(model=>{const g=(window as any).__game,m=g.missionForProfiling(),p=g.sim.player.position;return {source:m.vehicles.create(492,{x:p.x+20,y:-p.z,z:p.y+.7},0),target:model?m.vehicles.create(model,{x:p.x+8,y:-p.z,z:p.y+.7},0):null};},model);
 await page.waitForFunction(h=>{const m=(window as any).__game.missionForProfiling();return !!m.vehicles.entity(h.source)&&(h.target===null||!!m.vehicles.entity(h.target));},handles,{timeout:45000});
 const shooter=await page.evaluate(h=>{const g=(window as any).__game,m=g.missionForProfiling(),host=m.runtime.world;if(h.target!==null){host.freezeVehiclePosition(h.target,true);host.warpPedIntoCar(1,h.target);}g.sim.playerCanBeDamaged=true;g.sim.playerProofs=undefined;return m.peds.createInCar(7,'MALE01',h.source,0);},handles);
 await page.waitForFunction(({handles,shooter})=>{const g=(window as any).__game,m=g.missionForProfiling();return !!m.peds.entity(shooter)&&(handles.target===null||g.render().vehiclePose?.frame.vehicle===m.vehicles.entity(handles.target).car.root);},{handles,shooter},{timeout:45000});
 await page.evaluate(async({handles,shooter})=>{
  const dep='/src/simulation/Simulation.ts',{NATIVE_PLAYER_DAMAGE_MULT}=await import(/* @vite-ignore */ dep),g=(window as any).__game,m=g.missionForProfiling(),w=g.weapons(),fx=w.fx.effects;
  const s={car:m.vehicles.entity(handles.source),rider:m.peds.entity(shooter),shots:0,events:[] as any[],traces:[] as any[],oldLine:w.npcBulletLine,oldBlood:fx.blood,oldDamage:g.sim.damagePlayer,damage:[] as any[],random:Math.random,mult:NATIVE_PLAYER_DAMAGE_MULT};g.__drivebyFriend=s;
  w.npcBulletLine=function(...args:any[]){const hit=s.oldLine.apply(this,args);if(args[3]?.handle===s.car.car.body.handle){Math.random=s.random;queueMicrotask(()=>{s.shots=s.rider.driveBy?.shots??0;s.rider.driveBy=undefined;});const seat=g.pedestrians().seatedShot(args[0],args[1],args[2],s.car,hit?.collider.parent(),{distance:hit?.timeOfImpact??args[2],tyre:false,shooter:s.rider});s.traces.push({physical:hit?.collider.handle===g.sim.playerCollider.handle,piece:hit?.pedPiece,seated:seat?.victim===g.sim.player,direct:!!seat?.direct});}return hit;};
  g.sim.damagePlayer=function(...args:any[]){const n=this.damageEvents.length,accepted=s.oldDamage.apply(this,args);if(args[2]?.weapon===28){const e=this.damageEvents.at(-1);s.damage.push({accepted,newEvents:this.damageEvents.length-n,event:e&&{health:e.health,armour:e.armour,died:e.died}});}return accepted;};
  fx.blood=function(...args:any[]){s.events.push({count:args[2],health:g.sim.player.health});return s.oldBlood.apply(this,args);};
 },{handles,shooter});
 const results:any[]=[];
 for(const mode of ['hostile','respect','cleared']){
  await page.evaluate(({mode,model,handles,shooter})=>{
   const g=(window as any).__game,m=g.missionForProfiling(),w=g.weapons(),s=g.__drivebyFriend,host=m.runtime.world;
   if(mode==='cleared')host.clearPedRelationship(shooter,0,0);else host.setPedRelationship(shooter,mode==='respect'?0:4,0);
   const view=g.render().nativeCharacter,center=model===492?{...view.headPosition(),y:view.headPosition().y+.1}:view.hitSpheres().find((h:any)=>h.piece===3).center;
   const ray=Array.from({length:8},(_,i)=>({x:Math.cos(i*Math.PI/4),y:0,z:Math.sin(i*Math.PI/4)})).map(d=>({d,from:{x:center.x-d.x*6,y:center.y,z:center.z-d.z*6}})).find(r=>{const hit=s.oldLine.call(w,r.from,r.d,20,s.car.car.body);if(!model)return hit?.collider.handle===g.sim.playerCollider.handle&&hit.pedPiece===3;return g.pedestrians().seatedShot(r.from,r.d,20,s.car,hit?.collider.parent(),{distance:hit?.timeOfImpact??20,tyre:false,shooter:s.rider})?.victim===g.sim.player;});
   if(!ray)throw Error('No native CJ contact');g.placeFleetCar(`handle:${s.car.car.body.handle}`,ray.from.x-1,ray.from.y-.75,ray.from.z,0);host.freezeVehiclePosition(handles.source,true);
   g.sim.player.health=5000;g.sim.player.armour=0;s.shots=0;s.damage.length=0;s.events.length=0;s.traces.length=0;s.random=Math.random;
   Math.random=()=>.5;host.givePedScriptedTask(shooter,{kind:'driveBy',targetPed:-1,targetVehicle:-1,x:center.x,y:-center.z,z:center.y,radius:100,type:0,rightHandCarSeat:true,fireRate:100},0x0713);
  },{mode,model,handles,shooter});
  await page.waitForFunction(()=>{const s=(window as any).__game.__drivebyFriend;return s.shots>0;},undefined,{timeout:15000,polling:50});
  results.push(await page.evaluate(mode=>{const g=(window as any).__game,s=g.__drivebyFriend;return {mode,health:g.sim.player.health,friendly:g.pedestrians().friendlyWithPlayer(s.rider),grouped:g.pedestrians().inPlayerGroup(s.rider),factor:Math.fround(Math.fround(g.weapons().inventory.info(28).damage)*s.mult),shots:s.shots,traces:[...s.traces],blood:[...s.events],damage:[...s.damage]};},mode));
 }
 await page.evaluate(({handles,shooter})=>{const g=(window as any).__game,m=g.missionForProfiling(),s=g.__drivebyFriend,w=g.weapons();Math.random=s.random;w.npcBulletLine=s.oldLine;w.fx.effects.blood=s.oldBlood;g.sim.damagePlayer=s.oldDamage;m.runtime.world.deletePed(shooter);m.runtime.world.deleteVehicle(handles.source);if(handles.target!==null){m.runtime.world.warpPedFromCarToCoord(1,2495,-1687,13.3);m.runtime.world.deleteVehicle(handles.target);}g.sim.player.health=100;},{handles,shooter});
 writeFileSync(`artifacts/driveby-player-friendly-${model}.json`,JSON.stringify({results,errors},null,2));
 for(const r of results){const friendly=r.mode==='respect',damage=friendly?Math.min(Math.fround(r.factor*Math.fround(.1)),12.5):r.factor;expect(r.friendly).toBe(friendly);expect(r.grouped).toBe(false);expect(r.shots).toBe(1);expect(r.traces).toHaveLength(1);if(!model)expect(r.traces[0]).toMatchObject({physical:true,piece:3});else expect(r.traces[0]).toMatchObject({seated:true,direct:model===461});expect(r.health).toBe(Math.fround(5000-damage));expect(r.damage).toEqual([{accepted:true,newEvents:1,event:{health:damage,armour:0,died:false}}]);expect(r.blood).toEqual([{count:model===492?16:8,health:r.health}]);}
 expect(errors).toEqual([]);
});
