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

test('a round is placed on the piece of the body it meets, for CJ as for street peds',async()=>{
 const {pedPieceAt}=await import('../src/simulation/WorldPedestrians');
 const {PED_PIECE}=await import('../src/combat/nativeDamageAnim');
 const feet={x:0,y:0,z:0};
 expect(pedPieceAt(feet,0)).toBe(PED_PIECE.torso);
 expect(pedPieceAt(feet,0,{x:0,y:1.6,z:0})).toBe(PED_PIECE.head);
 // Facing +z, +x is the ped's left.
 expect(pedPieceAt(feet,0,{x:.4,y:1.2,z:0})).toBe(PED_PIECE.leftArm);
 expect(pedPieceAt(feet,0,{x:-.1,y:.4,z:0})).toBe(PED_PIECE.rightLeg);
});

import {carRefusesDamage as refuses} from '../src/simulation/WorldCar';
import {NativeFireManager} from '../src/combat/nativeFire';
test('each proof guards its own class: melee blows, the flamethrower and bullets apart, and a fire-proof car does not catch',()=>{
 const car=(proofs:object)=>({canBeDamaged:true,proofs:{bullet:false,explosion:false,melee:false,fire:false,collision:false,...proofs}});
 expect(refuses(car({melee:true}),'melee')).toBe(true);expect(refuses(car({melee:true}),'bullet')).toBe(false);
 expect(refuses(car({bullet:true}),'melee')).toBe(false);expect(refuses(car({fire:true}),'fire')).toBe(true);
 expect(refuses(car({explosion:true}),true)).toBe(true);expect(refuses(car({bullet:true}),false)).toBe(true);
 const fires=new NativeFireManager(),clock={nowMs:0,random:()=>0};
 expect(fires.startFireOn({kind:'vehicle',key:{}},{x:0,y:0,z:0},7000,100,clock,'player',{fireproof:true})).toBeUndefined();
 expect(fires.startFireOn({kind:'vehicle',key:{}},{x:0,y:0,z:0},7000,100,clock,'player',{engineDamaged:true})).toBeUndefined();
 expect(fires.startFireOn({kind:'vehicle',key:{}},{x:0,y:0,z:0},7000,100,clock,'player')).toBeDefined();
});

test('a bulletproof vest turns away instant-hit rounds on the torso and the ass only (CEventDamage::AffectsPed)',async()=>{
 const {bulletProofVestStops,npcDamageReaches}=await import('../src/simulation/WorldPedestrians');
 const {PED_PIECE,WEAPON}=await import('../src/combat/nativeDamageAnim');
 const smoke={bulletProofVest:true,health:2000,pedType:'SPECIAL'};
 expect(bulletProofVestStops(smoke,WEAPON.pistol,PED_PIECE.torso)).toBe(true);
 expect(bulletProofVestStops(smoke,30,PED_PIECE.ass)).toBe(true);
 expect(bulletProofVestStops(smoke,30,PED_PIECE.head)).toBe(false);
 expect(bulletProofVestStops(smoke,30,PED_PIECE.leftLeg)).toBe(false);
 // Not an instant hit: a rocket's blast, a punch.
 expect(bulletProofVestStops(smoke,WEAPON.explosion,PED_PIECE.torso)).toBe(false);
 expect(bulletProofVestStops({health:100},30,PED_PIECE.torso)).toBe(false);
 expect(npcDamageReaches(smoke,{},30,true,PED_PIECE.torso)).toBe(false);
 expect(npcDamageReaches(smoke,{},30,true,PED_PIECE.rightArm)).toBe(true);
});
