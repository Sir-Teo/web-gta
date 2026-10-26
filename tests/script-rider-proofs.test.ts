import {expect,test,vi} from 'vitest';
import {scriptRiderShot,type ScriptRiderDamageState} from '../src/vehicle/scriptRiderShot';

const bulletProof={bullet:true,fire:false,explosion:false,collision:false,melee:false};
test('a mission rider spends stat-scaled armour before health and a forced death spends only the original factor',()=>{
 const ped:ScriptRiderDamageState={health:5000,armour:100,defendMult:2,invulnerable:false};
 expect(scriptRiderShot(ped,25,22,false)).toBe('hit');expect(ped).toMatchObject({health:5000,armour:50});
 expect(scriptRiderShot(ped,30,22,false)).toBe('hit');expect(ped).toMatchObject({health:4990,armour:0});
 ped.armour=100;const kill=vi.fn();expect(scriptRiderShot(ped,10,22,false,kill,{forceDeath:true})).toBe('killed');
 expect(ped).toMatchObject({health:0,armour:80,diedInSeat:true});expect(kill).toHaveBeenCalledOnce();
 expect(scriptRiderShot(ped,1000,22,false,kill,{forceDeath:true})).toBe('killed');expect(ped.armour).toBe(80);expect(kill).toHaveBeenCalledOnce();
});
test.each([false,true])('scripted friendly-fire scaling before armour is source-sensitive (%s)',friendlyFire=>{
 const ped:ScriptRiderDamageState={health:100,armour:100,invulnerable:false};
 scriptRiderShot(ped,200,22,true,undefined,{friendlyFire});
 expect(ped.health).toBe(friendlyFire?100:0);expect(ped.armour).toBe(friendlyFire?87.5:0);
});
test('a rejected mission rider impact spends no armour',()=>{
 const ped:ScriptRiderDamageState={health:100,armour:100,invulnerable:false,proofs:bulletProof};
 expect(scriptRiderShot(ped,25,22,true)).toBeUndefined();expect(ped.armour).toBe(100);
});
test.each([22,34,38])('a seated mission ped rejects weapon %s from player and NPC sources while bullet proof',weapon=>{
 for(const byPlayer of [false,true]){
  const ped:ScriptRiderDamageState={health:100,invulnerable:false,proofs:{...bulletProof}};
  // A precomputed head-death amount cannot bypass AffectsPed's physical-proof rejection.
  expect(scriptRiderShot(ped,1000,weapon,byPlayer)).toBeUndefined();expect(ped.health).toBe(100);expect(ped.diedInSeat).toBeUndefined();
  ped.proofs!.bullet=false;expect(scriptRiderShot(ped,25,weapon,byPlayer)).toBe('hit');expect(ped.health).toBe(75);
 }
});
test('only-damaged-by-player and physical bullet proof remain separate gates in a seat',()=>{
 const ped:ScriptRiderDamageState={health:100,invulnerable:true,proofs:{...bulletProof,bullet:false}};
 expect(scriptRiderShot(ped,1000,22,false)).toBeUndefined();expect(ped.health).toBe(100);
 ped.proofs!.bullet=true;expect(scriptRiderShot(ped,1000,22,true)).toBeUndefined();expect(ped.health).toBe(100);
 ped.proofs!.bullet=false;expect(scriptRiderShot(ped,1000,22,true)).toBe('killed');expect(ped.health).toBe(0);expect(ped.diedInSeat).toBe(true);
});
test('other physical proofs do not accidentally make an occupant bullet proof',()=>{
 const ped:ScriptRiderDamageState={health:100,invulnerable:false,proofs:{bullet:false,fire:true,explosion:true,collision:true,melee:true}};
 expect(scriptRiderShot(ped,25,38,false)).toBe('hit');expect(ped.health).toBe(75);
});
test('a corpse contact is accepted before live proof gates without changing its seat death state',()=>{
 const ped:ScriptRiderDamageState={health:0,invulnerable:true,proofs:{...bulletProof},diedInSeat:true};
 expect(scriptRiderShot(ped,1000,22,false)).toBe('killed');expect(ped).toEqual({health:0,invulnerable:true,proofs:bulletProof,diedInSeat:true});
});
test('the kill callback observes the accepted death transition once, after proof and surviving hits',()=>{
 const ped:ScriptRiderDamageState={health:100,invulnerable:false,proofs:{...bulletProof}},kill=vi.fn(()=>{expect(ped.health).toBe(0);expect(ped.diedInSeat).toBe(true);});
 expect(scriptRiderShot(ped,1000,22,false,kill)).toBeUndefined();expect(kill).not.toHaveBeenCalled();ped.proofs!.bullet=false;
 expect(scriptRiderShot(ped,25,22,false,kill)).toBe('hit');expect(kill).not.toHaveBeenCalled();expect(scriptRiderShot(ped,1000,22,false,kill)).toBe('killed');
 expect(scriptRiderShot(ped,1000,22,false,kill)).toBe('killed');expect(scriptRiderShot(ped,1000,22,false,kill)).toBe('killed');expect(kill).toHaveBeenCalledOnce();
});
