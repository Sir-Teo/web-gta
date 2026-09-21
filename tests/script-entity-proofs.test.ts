import {expect,test} from 'vitest';
import {carRefusesDamage} from '../src/simulation/WorldCar';
import {pedProofedAgainst} from '../src/simulation/WorldPedestrians';

const allProofs={bullet:true,fire:true,explosion:true,collision:true,melee:true};
const noProofs={bullet:false,fire:false,explosion:false,collision:false,melee:false};

test('SET_CHAR_PROOFS refuses damage of its own kind and lets the rest through',()=>{
 const proofed={proofs:allProofs},bare={proofs:noProofs},plain={};
 for(const kind of ['bullet','fire','explosion','melee'] as const)expect(pedProofedAgainst(proofed,kind)).toBe(true);
 for(const kind of ['bullet','fire','explosion','melee','spray'] as const){
  expect(pedProofedAgainst(bare,kind)).toBe(false);expect(pedProofedAgainst(plain,kind)).toBe(false);
 }
 // CPhysical returns true for WEAPON_SPRAYCAN whatever the flags say, so no proof stops it.
 expect(pedProofedAgainst(proofed,'spray')).toBe(false);
 // Collision proof belongs to weapons this browser counts as melee, so on its own it stops nothing.
 expect(pedProofedAgainst({proofs:{...noProofs,collision:true}},'melee')).toBe(false);
});

test('a car that cannot be damaged takes nothing, and its proofs answer by the kind of blow',()=>{
 expect(carRefusesDamage({canBeDamaged:false},false)).toBe(true);
 expect(carRefusesDamage({canBeDamaged:false},true)).toBe(true);
 expect(carRefusesDamage({canBeDamaged:true},false)).toBe(false);
 expect(carRefusesDamage({canBeDamaged:true,proofs:{bullet:true,explosion:false}},false)).toBe(true);
 expect(carRefusesDamage({canBeDamaged:true,proofs:{bullet:true,explosion:false}},true)).toBe(false);
 expect(carRefusesDamage({canBeDamaged:true,proofs:{bullet:false,explosion:true}},true)).toBe(true);
});
