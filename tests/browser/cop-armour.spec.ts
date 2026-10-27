import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('original cop models keep health separate from native armour through body hits, falls, drowning and forced heads',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});await endStoryMission(page);await page.waitForFunction(()=>(window as any).__game.state().pedestrians?.ready,undefined,{timeout:45000});
 const results=await page.evaluate(async()=>{
  const g=(window as any).__game,crowd=g.pedestrians(),at=g.sim.player.position,rows:any[]=[];
  for(const [model,accuracy] of [['lapd1',60],['swat',68],['fbi',76],['army',84]] as const){
   const id=await crowd.spawnOfficer(model,22,{x:at.x+7,y:at.y,z:at.z},0,undefined,accuracy),p=crowd.people.find((p:any)=>p.id===id);if(!p)throw Error(`No ${model} cop`);p.mission=true;
   const states:any[]=[];const state=(name:string)=>states.push({name,health:p.health,armour:p.armour});state('start');
   crowd.damageCollider(p.collider.handle,25,{x:0,z:1},'bullet',{weapon:22,piece:3});state('body');
   crowd.damageCollider(p.collider.handle,25,{x:0,z:1},'collision',{weapon:54,noSource:true});state('fall');
   crowd.damageCollider(p.collider.handle,25,{x:0,z:1},'collision',{weapon:53,noSource:true});state('drowning');
   crowd.damageCollider(p.collider.handle,25,{x:0,z:1},'bullet',{weapon:22,piece:9});state('head');rows.push({model,states});crowd.removeScripted(p);
  }
  return rows;
 });
 writeFileSync('artifacts/cop-armour.json',JSON.stringify({results,errors},null,2));
 for(const r of results){const armour=r.model==='swat'?50:r.model==='lapd1'?0:100,bodyHealth=armour?100:75;expect(r.states).toEqual([{name:'start',health:100,armour},{name:'body',health:bodyHealth,armour:Math.max(0,armour-25)},{name:'fall',health:bodyHealth-25,armour:Math.max(0,armour-25)},{name:'drowning',health:bodyHealth-50,armour:Math.max(0,armour-25)},{name:'head',health:0,armour:Math.max(0,armour-50)}]);}
 expect(errors).toEqual([]);
});

test('a native FBI crew retains a wound through its animated exit and return',async({page})=>{
 test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});await endStoryMission(page);await page.waitForFunction(()=>!!(window as any).__game.police(),undefined,{timeout:45000});
 await page.evaluate(()=>{const g=(window as any).__game;g.sim.playerCanBeDamaged=false;g.missionForProfiling().runtime.game.setMaximumWantedLevel(6);g.police().law.setLevel(5);if(g.police().law.level!==5)throw Error(`FBI trial wanted level ${g.police().law.level}, maximum ${g.police().law.native.maximumWantedLevel}`);});
 await page.waitForFunction(()=>(window as any).__game.police().units.some((u:any)=>u.member.model==='fbi'&&u.seats[0]&&!u.leaving.length),undefined,{timeout:45000}).catch(async error=>{writeFileSync('artifacts/cop-armour-spawn-failure.json',JSON.stringify(await page.evaluate(()=>{const g=(window as any).__game;return {wanted:g.police().law.snapshot(),police:g.police().snapshot(),fleet:g.fleet().cars.size,terrainHold:g.state().terrainHold};}),null,2));throw error;});
 const before=await page.evaluate(()=>{
  const g=(window as any).__game,police=g.police(),u=police.units.find((u:any)=>u.member.model==='fbi'&&u.seats[0]&&!u.leaving.length),p=g.sim.player.position;g.placeFleetCar(`handle:${u.car.car.body.handle}`,p.x+12,p.y+.5,p.z,0);
  const initial={health:u.seatHealth[0],armour:u.seatArmour[0]};police.crewShot(u.car,0,25,22);const wounded={health:u.seatHealth[0],armour:u.seatArmour[0]};g.__armourUnit=u;police.law.setLevel(1);police.beginExit(u,0);return {initial,wounded};
 });
 await page.waitForFunction(()=>{const g=(window as any).__game;return g.pedestrians().people.some((p:any)=>p.crew?.unit===g.__armourUnit&&p.crew.seat===0);},undefined,{timeout:45000});
 const outside=await page.evaluate(()=>{
  const g=(window as any).__game,p=g.pedestrians().people.find((p:any)=>p.crew?.unit===g.__armourUnit&&p.crew.seat===0);p.mission=true;const initial={health:p.health,armour:p.armour};g.pedestrians().damageCollider(p.collider.handle,25,{x:0,z:1},'bullet',{weapon:22,piece:3});const wounded={health:p.health,armour:p.armour};g.__armourPed=p.id;g.police().law.setLevel(0);return {initial,wounded};
 });
 await page.waitForFunction(()=>{const g=(window as any).__game,u=g.__armourUnit;return !g.pedestrians().people.some((p:any)=>p.id===g.__armourPed)&&u.seats.some((inSeat:boolean,i:number)=>inSeat&&u.seatHealth[i]===100&&u.seatArmour[i]===50);},undefined,{timeout:60000});
 const returned=await page.evaluate(()=>{const g=(window as any).__game,u=g.__armourUnit;return u.seats.flatMap((present:boolean,i:number)=>present&&u.seatArmour[i]===50?[{health:u.seatHealth[i],armour:u.seatArmour[i]}]:[]);});
 await page.waitForFunction(()=>{const g=(window as any).__game,u=g.__armourUnit;return g.weapons().seatedPeds().some((t:any)=>t.car===u.car&&u.seatArmour[t.seat]===50&&!!t.head);},undefined,{timeout:15000});
 const shot=await page.evaluate(()=>{
  const g=(window as any).__game,u=g.__armourUnit,w=g.weapons(),target=w.seatedPeds().find((t:any)=>t.car===u.car&&u.seatArmour[t.seat]===50),head={...target.head,y:target.head.y+.1},axes=[{x:1,z:0},{x:-1,z:0},{x:0,z:1},{x:0,z:-1}];
  const rays=axes.flatMap(axis=>[0,.5,-.5].map(lift=>{const source={x:head.x-axis.x*6,y:head.y+lift,z:head.z-axis.z*6},length=Math.hypot(6,lift);return {source,direction:{x:axis.x*6/length,y:-lift/length,z:axis.z*6/length}};}));
  const ray=rays.find(line=>{const hit=w.ray(line.source,line.direction,20,g.sim.playerBody);return w.seatedHit(line.source,line.direction,20,hit?.collider.parent(),g.sim.playerBody)?.target.seat===target.seat;});if(!ray)throw Error('No native FBI head transfer');
  const fx=w.fx.effects,old=fx.blood,oldMuzzle=w.muzzle,oldSpread=w.aimSpread,start={...g.sim.player.position},blood:any[]=[];fx.blood=function(...args:any[]){blood.push({count:args[2],health:u.seatHealth[target.seat],armour:u.seatArmour[target.seat]});return old.apply(this,args);};
  try{g.placePlayer(ray.source.x,ray.source.y-1.3,ray.source.z);w.inventory.give(22,100);w.inventory.select(22);w.firstPerson=undefined;w.aiming=true;w.muzzle=()=>ray.source;w.aimSpread=(direction:any)=>direction;const carBefore=u.car.health,fired=w.fire({origin:ray.source,direction:ray.direction});return {fired,health:u.seatHealth[target.seat],armour:u.seatArmour[target.seat],blood,carDamage:carBefore-u.car.health};}
  finally{fx.blood=old;w.muzzle=oldMuzzle;w.aimSpread=oldSpread;g.placePlayer(start.x,start.y,start.z);}
 });
 writeFileSync('artifacts/cop-armour-crew.json',JSON.stringify({before,outside,returned,shot,errors},null,2));expect(shot).toEqual({fired:true,health:0,armour:25,blood:[{count:32,health:0,armour:25}],carDamage:0});expect(before).toEqual({initial:{health:100,armour:100},wounded:{health:100,armour:75}});expect(outside).toEqual({initial:{health:100,armour:75},wounded:{health:100,armour:50}});expect(returned).toContainEqual({health:100,armour:50});expect(errors).toEqual([]);
});
