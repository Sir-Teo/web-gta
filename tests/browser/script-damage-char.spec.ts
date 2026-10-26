import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('DAMAGE_CHAR directly changes armour/health for walking peds, riders and protected CJ without weapon accounting',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});await endStoryMission(page);
 const car=await page.evaluate(()=>{const g=(window as any).__game,p=g.sim.player.position;return g.missionForProfiling().vehicles.create(492,{x:p.x+10,y:-p.z,z:p.y+1},0);});
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),car,{timeout:45000});
 const handles=await page.evaluate(car=>{const g=(window as any).__game,m=g.missionForProfiling(),p=g.sim.player.position;m.runtime.world.freezeVehiclePosition(car,true);return [m.peds.create(4,'MALE01',{x:p.x+6,y:-p.z,z:p.y}),m.peds.createInCar(4,'MALE01',car,'driver')];},car);
 await page.waitForFunction(handles=>handles.every(h=>!!(window as any).__game.missionForProfiling().peds.entity(h)),handles,{timeout:45000});
 const result=await page.evaluate(async({handles,car})=>{
  const g=(window as any).__game,m=g.missionForProfiling(),a=m.adapterRef,stats=m.runtime.game.stats,rows:any[]=[],events:any[]=[];
  const threadPath='/src/engine/ScmThread.ts',{ScmThread}=await import(/* @vite-ignore */ threadPath);
  const damage=(handle:number,amount:number,armour:boolean)=>{
   const bytes=new Uint8Array(32),view=new DataView(bytes.buffer);view.setUint16(0,0x0851,true);let offset=2;
   for(const value of [handle,amount,armour?1:0]){bytes[offset++]=1;view.setInt32(offset,value,true);offset+=4;}
   view.setUint16(offset,0x004e,true);const thread=new ScmThread(bytes,0,0,undefined,{startScript(){},game:m.runtime.game,world:a});thread.run(0,8);
  };
  const before={other:stats.get(120),player:stats.get(121)},proofs={bullet:true,fire:true,explosion:true,collision:true,melee:true};
  const record=(kind:string,name:string,h:number,p:any)=>{rows.push({kind,name,health:p.health,armour:a.pedArmour(h),dead:h===1?p.health<=0:m.peds.isDead(h)});};
  for(const h of [...handles,1]){
   const player=h===1,p=player?g.sim.player:m.peds.entity(h),kind=player?'player':p.rider?'rider':'walking';
   if(player){g.sim.playerCanBeDamaged=false;g.sim.playerProofs=proofs;g.sim.damageEvents.length=0;g.sim.lastWeaponDamage=34;}
   else{p.defendMult=1.8;if(p.rider)p.invulnerable=true;else{p.onlyDamagedByPlayer=true;p.bulletProofVest=true;}p.proofs=proofs;}
   p.health=500;p.armour=100;
   damage(h,50,false);record(kind,'bypass',h,p);
   damage(h,50,true);record(kind,'absorbed',h,p);
   damage(h,75,true);record(kind,'overflow',h,p);
   p.health=25.5;p.armour=100;damage(h,25,false);record(kind,'fractional',h,p);
   if(player)events.push({beforeDeath:[...g.sim.damageEvents],lastWeapon:g.sim.lastWeaponDamage});
   damage(h,1,false);record(kind,'dead',h,p);
   if(player)events.push({deathEvents:g.sim.damageEvents.length,lastWeapon:g.sim.lastWeaponDamage,deathRemaining:g.sim.deathRemaining});
   else if(p.rider)events.push({riderDeath:p.diedInSeat});else events.push({walkingDeath:p.deathState});
  }
  return {rows,events,before,after:{other:stats.get(120),player:stats.get(121)},carHealth:m.vehicles.entity(car).health};
 },{handles,car});
 writeFileSync('artifacts/script-damage-char.json',JSON.stringify({result,errors},null,2));
 for(const kind of ['walking','rider','player'])expect(result.rows.filter((r:any)=>r.kind===kind).map((r:any)=>[r.name,r.health,r.armour,r.dead])).toEqual([['bypass',450,100,false],['absorbed',450,50,false],['overflow',425,0,false],['fractional',.5,100,false],['dead',0,100,true]]);
 expect(result.events).toEqual([{walkingDeath:'dying'},{riderDeath:true},{beforeDeath:[],lastWeapon:34},{deathEvents:1,lastWeapon:34,deathRemaining:expect.any(Number)}]);expect(result.events[3].deathRemaining).toBeGreaterThan(0);expect(result.after).toEqual(result.before);expect(errors).toEqual([]);
});
