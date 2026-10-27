import {beforeAll,expect,test,vi} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation} from '../src/simulation/Simulation';
import {WeaponSystem} from '../src/weapons/WeaponSystem';
import {WorldFx} from '../src/simulation/fx/WorldFx';

beforeAll(async()=>RAPIER.init());
function fixture(){
 const sim=new Simulation(),weapons=new WeaponSystem(sim,()=>undefined,()=>undefined),blood=vi.fn(),order:string[]=[],audio=vi.fn(()=>order.push('audio')),crime=vi.fn(),practice=vi.fn(),playerImpact=vi.fn();
 weapons.onPedBulletHit=audio;weapons.onCrime=crime;weapons.onHit=practice;weapons.onPlayerBulletImpact=playerImpact;
 weapons.fx={ready:true,gunshot(){},areaEffect(){},explosion(){},bulletHit(hit,amount){order.push('blood');WorldFx.prototype.bulletHit.call({effects:{blood}} as any,hit,amount);}};
 const contact={point:{x:0,y:2,z:-8},normal:{x:0,y:0,z:1},direction:{x:0,y:0,z:-1},piece:9};
 const target:any={car:{car:{body:{handle:5}}},seat:1,local:{x:0,y:0,z:0},kind:'script'};
 return {sim,weapons,blood,order,audio,crime,practice,playerImpact,contact,target,dispose(){weapons.dispose();sim.dispose();}};
}
test.each([{piece:9,weapon:22,result:'hit',count:16},{piece:9,weapon:22,result:'killed',count:32},{piece:3,weapon:22,result:'hit',count:8},{piece:5,weapon:25,result:'hit',count:4},{piece:9,weapon:25,result:'hit',count:16},{piece:9,weapon:22,result:undefined,count:0}] as const)('NPC seated contacts preserve piece and acceptance (%j)',c=>{
 const f=fixture();try{
  const apply=vi.fn(()=>{f.order.push('damage');return c.result;});
  expect(f.weapons.hitNpcSeatedBullet(f.target,{...f.contact,piece:c.piece},c.weapon,apply)).toBe(c.result);
  expect(apply).toHaveBeenCalledOnce();expect(f.audio).toHaveBeenCalledExactlyOnceWith(f.contact.point,90);
  expect(f.order).toEqual(c.count?['audio','damage','blood']:['audio','damage']);
  if(c.count)expect(f.blood.mock.calls[0][2]).toBe(c.count);else expect(f.blood).not.toHaveBeenCalled();
  expect(f.crime).not.toHaveBeenCalled();expect(f.practice).not.toHaveBeenCalled();expect(f.playerImpact).not.toHaveBeenCalled();
 }finally{f.dispose();}
});
test.each(['armour','fatal','proof','safe'])('seated CJ blood follows actual player damage acceptance (%s)',kind=>{
 const f=fixture();try{
  f.sim.playerCollider.setEnabled(false);f.sim.player.health=kind==='fatal'?1:100;f.sim.player.armour=kind==='armour'?100:0;f.sim.playerCanBeDamaged=kind!=='safe';
  if(kind==='proof')f.sim.playerProofs={bullet:true,fire:false,explosion:false,collision:false,melee:false};
  f.weapons.hitNpcSeatedBullet('player',f.contact,22,()=>f.sim.damagePlayer(25,false,{weapon:22,piece:9})?f.sim.player.health<=0?'killed':'hit':undefined);
  if(kind==='armour'){expect(f.sim.player.health).toBe(100);expect(f.sim.player.armour).toBeLessThan(100);expect(f.blood.mock.calls[0][2]).toBe(16);}
  else if(kind==='fatal'){expect(f.sim.player.health).toBe(0);expect(f.blood.mock.calls[0][2]).toBe(32);}
  else{expect(f.sim.player.health).toBe(100);expect(f.blood).not.toHaveBeenCalled();}
 }finally{f.dispose();}
});
test.each([{x:1,y:0,z:0},{x:0,y:0,z:-1}])('tangent/back-facing contacts keep damage and blood without contact sound (%j)',normal=>{
 const f=fixture();try{
  f.weapons.hitNpcSeatedBullet(f.target,{...f.contact,normal},22,()=>{f.order.push('damage');return 'hit';});
  expect(f.audio).not.toHaveBeenCalled();expect(f.order).toEqual(['damage','blood']);expect(f.blood.mock.calls[0][2]).toBe(16);
 }finally{f.dispose();}
});
