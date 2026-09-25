import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {physicalCanBeDamaged,physicalProofFor} from '../src/combat/nativePhysicalProofs';
import {Simulation} from '../src/simulation/Simulation';

beforeAll(async()=>{await RAPIER.init();});

test('CPhysical::CanPhysicalBeDamaged sorts the weapons into the five proofs',()=>{
 expect(physicalProofFor(0)).toBe('melee');expect(physicalProofFor(15)).toBe('melee');
 for(const w of [16,19,20,21,35,36,39,40,51])expect(physicalProofFor(w)).toBe('explosion');
 expect(physicalProofFor(18)).toBe('fire');expect(physicalProofFor(37)).toBe('fire');
 for(const w of [22,25,28,31,34,38,52])expect(physicalProofFor(w)).toBe('bullet');
 for(const w of [49,50,54])expect(physicalProofFor(w)).toBe('collision');
 // Tear gas, the spray can and drowning always get through.
 for(const w of [17,41,53])expect(physicalProofFor(w)).toBeUndefined();
 const proofs={bullet:true,fire:false,explosion:false,collision:false,melee:false};
 expect(physicalCanBeDamaged(proofs,22)).toBe(false);expect(physicalCanBeDamaged(proofs,4)).toBe(true);expect(physicalCanBeDamaged(undefined,22)).toBe(true);
});

test('SET_CHAR_PROOFS on the player turns away the weapons it names',()=>{
 const sim=new Simulation();
 sim.playerProofs={bullet:true,fire:false,explosion:false,collision:true,melee:false};
 sim.damagePlayer(30,false,{weapon:22});expect(sim.player.health).toBe(100);
 sim.damagePlayer(30,false,{weapon:22,fall:true});expect(sim.player.health).toBe(100);
 sim.damagePlayer(10,true,{weapon:4});expect(sim.player.health).toBeLessThan(100);
});
