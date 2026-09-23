import {expect,test} from 'vitest';
import {carRefusesDamage} from '../src/simulation/WorldCar';
import {pedProofedAgainst,npcDamageReaches} from '../src/simulation/WorldPedestrians';
import {WEAPON} from '../src/combat/nativeDamageAnim';

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

test('a ped only the player may hurt shrugs off other peds but not drowning or blasts, and bullets spare the shooter\'s own kind',()=>{
 const guarded={onlyDamagedByPlayer:true,health:100,pedType:'CIVMALE'},gang={pedType:'GANG2'};
 // CEventDamage::AffectsPed.
 expect(npcDamageReaches(guarded,gang,WEAPON.unarmed,false)).toBe(false);
 expect(npcDamageReaches(guarded,gang,WEAPON.pistol,true)).toBe(false);
 expect(npcDamageReaches(guarded,gang,WEAPON.explosion,false)).toBe(true);
 expect(npcDamageReaches(guarded,gang,WEAPON.drowning,false)).toBe(true);
 // CWeapon::DoBulletImpact: a Grove member's round passes another Grove member and a cop's another cop, not a civilian.
 expect(npcDamageReaches({health:100,pedType:'GANG2'},gang,WEAPON.ak47,true)).toBe(false);
 expect(npcDamageReaches({health:100,pedType:'COP'},{pedType:'COP'},WEAPON.pistol,true)).toBe(false);
 expect(npcDamageReaches({health:100,pedType:'CIVFEMALE'},{pedType:'CIVFEMALE'},WEAPON.pistol,true)).toBe(true);
 expect(npcDamageReaches({health:100,pedType:'GANG1'},gang,WEAPON.pistol,true)).toBe(true);
 // Fists are not DoBulletImpact: a gang member can still punch his own.
 expect(npcDamageReaches({health:100,pedType:'GANG2'},gang,WEAPON.unarmed,false)).toBe(true);
});
