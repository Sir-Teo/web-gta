import {beforeAll,expect,test,vi} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation} from '../src/simulation/Simulation';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';
import {WeaponSystem} from '../src/weapons/WeaponSystem';
import {WorldFx} from '../src/simulation/fx/WorldFx';

beforeAll(async()=>RAPIER.init());
function fixture(){
 const sim=new Simulation(),body=sim.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,1,-5)),collider=sim.world.createCollider(RAPIER.ColliderDesc.capsule(.6,.3),body),order:string[]=[],blood=vi.fn(),surface=vi.fn();sim.world.step();
 const ped={id:3,health:100,defendMult:1,pedType:'CIVMALE',body,collider,actor:{player:{position:{x:0,y:0,z:-5},heading:0}},view:{reactionPlayedOut:false,reactionName:'ko_shot_front',hasReaction:()=>false}} as any;
 const crowd=Object.assign(Object.create(WorldPedestrians.prototype),{people:[ped],hitPiece:()=>3,applyReaction:vi.fn(),damageReaction:vi.fn(()=>({})),onKill:vi.fn()}),weapons=new WeaponSystem(sim,()=>crowd,()=>undefined);
 weapons.fx={ready:true,gunshot(){},areaEffect(){},explosion(){},bulletHit(hit,amount){order.push(hit.ped?'blood':'surface');WorldFx.prototype.bulletHit.call({effects:{blood,bulletImpact:surface},collisionSources:()=>undefined} as any,hit,amount);}};
 weapons.onBulletHit=()=>order.push('audio');const object=vi.fn(()=>order.push('object'));weapons.onObjectShot=object;
 const playerImpact=vi.fn(),crime=vi.fn(),practice=vi.fn();weapons.onPlayerBulletImpact=playerImpact;weapons.onCrime=crime;weapons.onHit=practice;
 const point={x:0,y:1,z:-4.8},direction={x:0,y:0,z:-1},hit=(piece=3,target=collider)=>({collider:target,pedPiece:piece,timeOfImpact:4.8,normal:{x:0,y:0,z:1},featureType:RAPIER.FeatureType.Face,featureId:0});
 return {sim,body,collider,ped,crowd,weapons,point,direction,hit,order,blood,surface,object,playerImpact,crime,practice,dispose:()=>{weapons.dispose();sim.dispose();}};
}
test.each([{piece:3,health:100,weapon:22,count:8},{piece:9,health:100,weapon:22,count:16},{piece:9,health:1,weapon:22,count:32},{piece:3,health:100,weapon:25,count:4},{piece:9,health:0,weapon:22,count:32}])('NPC impacts use native piece and post-damage health (%j)',c=>{
 const f=fixture();try{
  f.ped.health=c.health;const finish=f.weapons.prepareNpcBulletImpact(f.hit(c.piece),f.point,c.weapon,f.direction);expect(f.order).toEqual(['audio']);
  f.order.push('damage');const accepted=f.crowd.npcBulletHit(f.collider.handle,10,c.weapon,{x:0,z:-1},f.point as any,c.piece);finish?.(accepted);
  expect(f.blood).toHaveBeenCalledOnce();expect(f.blood.mock.calls[0][2]).toBe(c.count);expect(f.order).toEqual(['audio','damage','blood']);expect(f.object).not.toHaveBeenCalled();expect(f.playerImpact).not.toHaveBeenCalled();expect(f.crime).not.toHaveBeenCalled();expect(f.practice).not.toHaveBeenCalled();
  expect(f.crowd.onKill).toHaveBeenCalledTimes(c.health===1?1:0);
 }finally{f.dispose();}
});
test('a same-type NPC corpse exclusion stays rejected rather than using the legacy corpse FX exception',()=>{
 const f=fixture();try{f.ped.health=0;f.ped.scriptPedType=6;
  const finish=f.weapons.prepareNpcBulletImpact(f.hit(9),f.point,22,f.direction);
  const accepted=(f.crowd as any).applyNpcBullet(f.ped,10,22,{x:0,z:-1},f.point,9,{pedType:'COP'});
  expect(accepted).toBe(false);finish?.(accepted);expect(f.blood).not.toHaveBeenCalled();expect(f.crowd.onKill).not.toHaveBeenCalled();
 }finally{f.dispose();}
});
test.each(['bullet proof','vest','only player'])('rejected NPC damage emits no blood (%s)',kind=>{
 const f=fixture();try{if(kind==='bullet proof')f.ped.proofs={bullet:true};if(kind==='vest')f.ped.bulletProofVest=true;if(kind==='only player')f.ped.onlyDamagedByPlayer=true;
  const finish=f.weapons.prepareNpcBulletImpact(f.hit(),f.point,22,f.direction);const accepted=f.crowd.npcBulletHit(f.collider.handle,10,22,{x:0,z:-1},f.point as any,3);expect(accepted).toBe(false);finish?.(accepted);expect(f.ped.health).toBe(100);expect(f.blood).not.toHaveBeenCalled();expect(f.surface).not.toHaveBeenCalled();expect(f.object).not.toHaveBeenCalled();
 }finally{f.dispose();}
});
test.each([{health:100,proof:false,count:16},{health:1,proof:false,count:32},{health:100,proof:true,count:0}])('incoming NPC effects recognize CJ and his accepted damage (%j)',c=>{
 const f=fixture();try{f.sim.player.health=c.health;f.sim.player.armour=0;f.sim.playerProofs=c.proof?{bullet:true,fire:false,explosion:false,collision:false,melee:false}:undefined;
  const finish=f.weapons.prepareNpcBulletImpact(f.hit(9,f.sim.playerCollider),f.point,22,f.direction),accepted=f.sim.damagePlayer(25,false,{weapon:22,piece:9});finish?.(accepted);
  if(c.count)expect(f.blood.mock.calls[0][2]).toBe(c.count);else expect(f.blood).not.toHaveBeenCalled();expect(f.playerImpact).not.toHaveBeenCalled();expect(f.crime).not.toHaveBeenCalled();
 }finally{f.dispose();}
});
test.each([false,true])('NPC object damage waits until physical hit routing finishes, including without FX (ready=%s)',ready=>{
 const f=fixture();try{const fx=f.weapons.fx!;Object.defineProperty(fx,'ready',{value:ready});f.crowd.people=[];
  f.weapons.onObjectShot=(...args)=>{f.order.push('object');expect(args[5]).toBe(false);f.sim.world.removeRigidBody(f.body);};
  const finish=f.weapons.prepareNpcBulletImpact(f.hit(),f.point,22,f.direction);expect(f.body.isValid()).toBe(true);expect(f.collider.parent()!.handle).toBe(f.body.handle);f.order.push('route');finish?.(false);
  expect(f.body.isValid()).toBe(false);expect(f.order).toEqual(ready?['audio','surface','route','object']:['audio','route','object']);expect(f.blood).not.toHaveBeenCalled();
 }finally{f.dispose();}
});
