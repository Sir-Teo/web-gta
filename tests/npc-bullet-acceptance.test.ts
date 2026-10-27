import {beforeAll,expect,test,vi} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {WorldPedestrians,npcDamageReaches} from '../src/simulation/WorldPedestrians';
import {Simulation} from '../src/simulation/Simulation';

beforeAll(async()=>RAPIER.init());
function fixture(){
 const ped={id:7,health:100,defendMult:2,pedType:'CIVMALE',collider:{handle:12},actor:{player:{position:{x:0,y:0,z:0}}},view:{reactionPlayedOut:false,reactionName:'ko_shot_front',hasReaction:()=>false}} as any;
 const host=Object.assign(Object.create(WorldPedestrians.prototype),{people:[ped],onKill:vi.fn(),noteEvent:vi.fn(),hitPiece:()=>3,applyReaction:vi.fn(),damageReaction:vi.fn(()=>({}))}) as any;
 const hit=(shooter?:any)=>host.applyNpcBullet(ped,10,22,{x:0,z:1},{x:0,y:1,z:0},3,shooter);
 return {ped,host,hit};
}
test.each([false,true])('NPC bullets account for one death across subsequent corpse hits (known shooter=%s)',known=>{
 const f=fixture(),shooter=known?{pedType:'COP'}:undefined;f.ped.health=1;
 expect(f.hit(shooter)).toBe(true);expect(f.hit(shooter)).toBe(true);expect(f.hit(shooter)).toBe(true);
 expect(f.ped.health).toBe(0);expect(f.host.onKill).toHaveBeenCalledOnce();expect(f.host.damageReaction).toHaveBeenCalledOnce();
 expect(f.host.onKill.mock.calls[0][0]).toMatchObject({id:7,byPlayer:false,pedType:'CIVMALE'});
});
test('NPC collider recognition and accepted damage remain distinct for proofed victims',()=>{
 const f=fixture();f.ped.proofs={bullet:true};
 expect(f.host.bulletHit(12,10,22,{x:0,z:1},{x:0,y:1,z:0},3)).toBe(true);
 expect(f.host.npcBulletHit(12,10,22,{x:0,z:1},{x:0,y:1,z:0},3)).toBe(false);
 expect(f.ped.health).toBe(100);expect(f.host.onKill).not.toHaveBeenCalled();expect(f.host.damageReaction).not.toHaveBeenCalled();
});
test('NPC weakness is scaled before armour and the reaction receives health and armour losses',()=>{
 const f=fixture();f.ped.armour=25;
 expect(f.hit()).toBe(true);expect(f.ped.health).toBe(100);expect(f.ped.armour).toBe(5);expect(f.ped.lastWeaponDamage).toBe(22);
 expect(f.host.damageReaction.mock.calls[0][2]).toBe(0);expect(f.host.damageReaction.mock.calls[0][9]).toBe(20);
 f.hit();expect(f.ped.health).toBe(85);expect(f.ped.armour).toBe(0);
 expect(f.host.damageReaction.mock.calls[1][2]).toBe(15);expect(f.host.damageReaction.mock.calls[1][9]).toBe(5);
});
test('proof and group rejection spend no armour',()=>{
 const f=fixture();f.ped.armour=50;f.ped.proofs={bullet:true};expect(f.hit()).toBe(false);expect(f.ped.armour).toBe(50);
 f.ped.proofs=undefined;f.host.sameScriptGroup=()=>true;expect(f.hit({pedType:'CIVFEMALE'})).toBe(false);expect(f.ped.armour).toBe(50);
});
test('the mounted-gun damage adapter rejects a living victim only the player may damage',()=>{
 const f=fixture();f.ped.onlyDamagedByPlayer=true;
 expect(f.host.damageCollider(12,10,{x:0,z:1},'bullet',{weapon:38,piece:3,point:{x:0,y:1,z:0},byPlayer:false})).toBe(false);
 expect(f.ped.health).toBe(100);expect(f.host.onKill).not.toHaveBeenCalled();
});
test('a dead victim bypasses live damage proofing without another kill',()=>{
 const f=fixture();f.ped.health=0;f.ped.proofs={bullet:true};f.ped.bulletProofVest=true;f.ped.onlyDamagedByPlayer=true;
 expect(f.hit()).toBe(true);expect(f.host.onKill).not.toHaveBeenCalled();expect(f.host.damageReaction).not.toHaveBeenCalled();
});
test('all NPC sources apply victim weakness, while a known groupmate bullet is rejected before calculation',()=>{
 const f=fixture();f.hit({pedType:'COP'});expect(f.ped.health).toBe(80);f.ped.health=100;f.hit();expect(f.ped.health).toBe(80);
 f.ped.health=100;f.ped.mission=true;f.ped.follow=true;const source={pedType:'COP',follow:true};expect(f.hit(source)).toBe(false);expect(f.ped.health).toBe(100);
 // This independently retained calculator behavior is reached by other damage entries, not this bullet event.
 expect(f.host.pedOnPedDamage(f.ped,source,10,22)).toBeCloseTo(2,5);
});
test('resolved script-group identity rejects live nonplayer rounds but does not reject a corpse contact',()=>{
 const f=fixture();f.host.sameScriptGroup=vi.fn(()=>true);const source={pedType:'CIVFEMALE'};
 expect(f.hit(source)).toBe(false);expect(f.ped.health).toBe(100);expect(f.host.onKill).not.toHaveBeenCalled();
 f.ped.health=0;expect(f.hit(source)).toBe(true);expect(f.host.onKill).not.toHaveBeenCalled();
});
test('NPC bullet type exclusions follow CREATE_CHAR rather than the model type',()=>{
 const f=fixture();f.ped.pedType='COP';f.ped.scriptPedType=4;expect(f.hit({pedType:'COP'})).toBe(true);
 f.ped.health=100;f.ped.pedType='CIVMALE';f.ped.scriptPedType=6;expect(f.hit({pedType:'CIVMALE',scriptPedType:6})).toBe(false);expect(f.ped.health).toBe(100);
 expect(npcDamageReaches({health:100,pedType:'COP',scriptPedType:4},{pedType:'COP'},22,true,3)).toBe(true);
});
test('the same noncivilian type blocks a corpse before GenerateDamageEvent',()=>{
 const f=fixture();f.ped.health=0;f.ped.scriptPedType=8;expect(f.hit({pedType:'GANG2'})).toBe(false);expect(f.host.onKill).not.toHaveBeenCalled();
});
test.each(['dead','safe','physical proof','weapon proof','fire proof'])('player damage reports rejection for %s',kind=>{
 const sim=new Simulation();try{
  if(kind==='dead')sim.player.health=0;if(kind==='safe')sim.playerCanBeDamaged=false;if(kind==='physical proof')sim.playerProofs={bullet:true,fire:false,explosion:false,collision:false,melee:false};if(kind==='weapon proof')sim.playerWeaponProof=()=>true;if(kind==='fire proof')sim.playerFireProof=()=>true;
  const health=sim.player.health;expect(sim.damagePlayer(25,false,{weapon:kind==='fire proof'?37:22})).toBe(false);expect(sim.player.health).toBe(health);expect(sim.damageEvents).toEqual([]);
 }finally{sim.dispose();}
});
test('player damage acceptance includes armour absorption and zero-health-loss events',()=>{
 const sim=new Simulation();try{sim.player.armour=100;expect(sim.damagePlayer(25,false,{weapon:22})).toBe(true);expect(sim.player.armour).toBeLessThan(100);expect(sim.damagePlayer(0,false,{weapon:22})).toBe(true);expect(sim.damageEvents).toHaveLength(2);}finally{sim.dispose();}
});
