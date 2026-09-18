import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {readIfp} from '../src/assets/ifp';
import {ANIM_ID,NATIVE_DAMAGE_CLIPS,PED_PIECE,PEDMOVE,WEAPON,browserLocalDirection,computeDamageAnim,computeDamageEventAnim,computeDeathAnim,nativeLocalDirection,type DamageAnimInput} from '../src/combat/nativeDamageAnim';

const npc={player:false,inVehicle:false,moveState:PEDMOVE.still};
const base=(over:Partial<DamageAnimInput>):DamageAnimInput=>({weapon:WEAPON.pistol,pedPiece:PED_PIECE.generic,direction:0,health:50,damageArmour:0,damageHealth:25,victim:npc,source:{ped:true,player:true},...over});

test('local direction follows CPed::GetLocalDirection quadrants in native and browser axes',()=>{
 // A ped facing native north: in front, left (west), behind, right (east).
 expect([nativeLocalDirection(0,0,1),nativeLocalDirection(0,-1,0),nativeLocalDirection(0,0,-1),nativeLocalDirection(0,1,0)]).toEqual([0,1,2,3]);
 // Quadrant edges sit 45 degrees either side of forward.
 expect(nativeLocalDirection(0,-Math.sin(.7),Math.cos(.7))).toBe(0);expect(nativeLocalDirection(0,-Math.sin(.9),Math.cos(.9))).toBe(1);
 // Rotating the ped by 90 degrees left turns a northern source into its right.
 expect(nativeLocalDirection(Math.PI/2,0,1)).toBe(3);
 // Browser heading h faces (sin h, cos h) on x/z.
 expect([browserLocalDirection(0,0,1),browserLocalDirection(0,1,0),browserLocalDirection(0,0,-1),browserLocalDirection(0,-1,0)]).toEqual([0,1,2,3]);
});

test('every clip the native damage choice can name exists in the packaged ped.ifp',()=>{
 const pack=readIfp(new Uint8Array(readFileSync('public/play/world/files/animations/ped.ifp')));
 const names=new Set(pack.animations.map(c=>c.name.toLowerCase()));
 expect(NATIVE_DAMAGE_CLIPS.filter(n=>!names.has(n))).toEqual([]);
 expect(NATIVE_DAMAGE_CLIPS.length).toBe(39);
});

test('death animations follow weapon class, direction and forced death',()=>{
 const death=(over:Partial<DamageAnimInput>)=>computeDeathAnim(base({health:0,...over}));
 // Light guns fall forward with no knockback; a forced death keeps that fall.
 expect(death({weapon:WEAPON.pistol})).toMatchObject({clip:'ko_shot_front',force:0,blend:4});
 // A Desert Eagle and shotguns knock the victim over away from the shooter.
 expect(death({weapon:WEAPON.desertEagle,direction:0})).toMatchObject({clip:'ko_skid_front',force:5});
 expect(death({weapon:WEAPON.shotgun,direction:2})).toMatchObject({clip:'ko_skid_back',force:10});
 expect(death({weapon:WEAPON.ak47,direction:1})).toMatchObject({clip:'ko_spin_r',force:2.5});
 expect(death({weapon:WEAPON.m4,direction:3})).toMatchObject({clip:'ko_spin_l'});
 expect(death({weapon:WEAPON.shotgun,forceDeath:true})).toMatchObject({clip:'ko_shot_front',force:0});
 // Melee: fists knock down, adrenaline multiplies the push fivefold, a forced death takes the face shot.
 expect(death({weapon:WEAPON.unarmed,direction:0})).toMatchObject({clip:'ko_skid_front',force:2.5});
 expect(death({weapon:WEAPON.unarmed,source:{ped:true,player:true,adrenaline:true}})).toMatchObject({force:12.5});
 expect(death({weapon:WEAPON.baseballBat,source:{ped:true,player:false}})).toMatchObject({clip:'ko_skid_front',force:7.5});
 expect(death({weapon:WEAPON.unarmed,forceDeath:true})).toMatchObject({clip:'ko_shot_face',force:0});
 expect(death({weapon:WEAPON.unarmed,megaPunch:true})).toMatchObject({force:50});
 // Fire and gas keep the plain fall; explosions knock over by direction.
 expect(death({weapon:WEAPON.molotov})).toMatchObject({clip:'ko_shot_front',force:0});
 expect(death({weapon:WEAPON.explosion,direction:2})).toMatchObject({clip:'ko_skid_back',force:0});
 expect(death({weapon:WEAPON.fall})).toMatchObject({id:ANIM_ID.koShotFront2,clip:'ko_shot_front'});
});

test('vehicle impacts, drowning, vehicles and floored victims take their dedicated death branches',()=>{
 const death=(over:Partial<DamageAnimInput>)=>computeDeathAnim(base({health:0,...over}));
 expect(death({weapon:WEAPON.rammedByCar,direction:0})).toMatchObject({clip:'kd_right'});
 expect(death({weapon:WEAPON.rammedByCar,direction:0,pedPiece:PED_PIECE.leftArm})).toMatchObject({clip:'kd_left'});
 expect(death({weapon:WEAPON.rammedByCar,direction:0,pedPiece:PED_PIECE.torso})).toMatchObject({clip:'ko_skid_back'});
 expect(death({weapon:WEAPON.runOverByCar,direction:2})).toMatchObject({clip:'ko_skid_front'});
 expect(death({weapon:WEAPON.runOverByCar,direction:2,pedPiece:PED_PIECE.rightArm})).toMatchObject({clip:'kd_right'});
 expect(death({weapon:WEAPON.rammedByCar,direction:1})).toMatchObject({clip:'ko_spin_r'});
 expect(death({weapon:WEAPON.drowning})).toMatchObject({clip:'drown'});
 expect(death({victim:{...npc,submerged:true,standing:false}})).toMatchObject({clip:'drown'});
 expect(death({victim:{...npc,inVehicle:true}})).toMatchObject({id:ANIM_ID.noAnimation,clip:undefined});
 expect(death({victim:{...npc,fallingOrGettingUp:true,headBelowRoot:true}})).toMatchObject({clip:'floor_hit',fallDown:true});
 expect(death({victim:{...npc,fallingOrGettingUp:true,headBelowRoot:true,lyingOnFront:true}})).toMatchObject({clip:'floor_hit_f'});
});

test('standing victims hit by guns play the body-part damage animation for the hit direction',()=>{
 const hit=(over:Partial<DamageAnimInput>)=>computeDamageAnim(base(over));
 expect(hit({pedPiece:PED_PIECE.torso})).toMatchObject({clip:'dam_stomach_frmft',fallDown:false,blend:8});
 expect(hit({pedPiece:PED_PIECE.torso,direction:3})).toMatchObject({clip:'dam_stomach_frmrt'});
 expect(hit({pedPiece:PED_PIECE.ass,direction:2})).toMatchObject({clip:'dam_stomach_frmbk'});
 expect(hit({pedPiece:PED_PIECE.leftArm,direction:2})).toMatchObject({clip:'dam_arml_frmbk'});
 expect(hit({pedPiece:PED_PIECE.leftArm,direction:1})).toMatchObject({clip:'dam_arml_frmlt'});
 expect(hit({pedPiece:PED_PIECE.leftArm,direction:3})).toMatchObject({clip:'dam_arml_frmft'});
 expect(hit({pedPiece:PED_PIECE.rightArm,direction:3})).toMatchObject({clip:'dam_armr_frmrt'});
 expect(hit({pedPiece:PED_PIECE.leftLeg,direction:0})).toMatchObject({clip:'dam_legl_frmft'});
 expect(hit({pedPiece:PED_PIECE.rightLeg,direction:2})).toMatchObject({clip:'dam_legr_frmbk'});
 expect(hit({pedPiece:PED_PIECE.head,direction:1})).toMatchObject({clip:'hit_l'});
});

test('moving victims flinch with the partial shot and heavy guns floor them',()=>{
 const hit=(over:Partial<DamageAnimInput>)=>computeDamageAnim(base(over));
 const running={...npc,moveState:PEDMOVE.run};
 expect(hit({victim:running,direction:0})).toMatchObject({clip:'shot_partial'});
 expect(hit({victim:running,direction:1})).toMatchObject({clip:'shot_leftp'});
 expect(hit({victim:running,direction:2})).toMatchObject({clip:'shot_partial_b'});
 expect(hit({victim:{...npc,ducking:true},direction:3})).toMatchObject({clip:'shot_rightp'});
 // A shotgun to the torso of a non-player knocks them down away from the shooter.
 expect(hit({weapon:WEAPON.shotgun,pedPiece:PED_PIECE.torso,direction:2})).toMatchObject({clip:'ko_skid_back',fallDown:true,force:5});
 // A heavy gun elsewhere still plays the body-part reaction.
 expect(hit({weapon:WEAPON.shotgun,pedPiece:PED_PIECE.leftLeg,victim:running})).toMatchObject({clip:'dam_legl_frmft',fallDown:false});
});

test('melee reactions depend on direction and damage, and weak victims are floored',()=>{
 const hit=(over:Partial<DamageAnimInput>)=>computeDamageAnim(base({weapon:WEAPON.unarmed,damageHealth:10,...over}));
 expect(hit({direction:0})).toMatchObject({clip:'hit_front'});
 expect(hit({direction:1})).toMatchObject({clip:'hit_l'});
 expect(hit({direction:3})).toMatchObject({clip:'hit_r'});
 expect(hit({direction:0,damageHealth:25})).toMatchObject({clip:'hit_walk'});
 expect(hit({direction:2})).toMatchObject({clip:'hit_behind'});
 // Every melee weapon up to WEAPON_CANE takes hit_behind from behind; an
 // explosion is past it, so a blast from behind keeps hit_back.
 expect(hit({weapon:WEAPON.chainsaw,direction:2})).toMatchObject({clip:'hit_behind'});
 expect(hit({weapon:WEAPON.explosion,direction:2})).toMatchObject({clip:'hit_back'});
 // Below 15 health a torso blow floors the victim with a strength-scaled push.
 expect(hit({pedPiece:PED_PIECE.torso,health:10,direction:0})).toMatchObject({clip:'ko_skid_front',fallDown:true,force:5});
 expect(hit({pedPiece:PED_PIECE.torso,health:10,direction:0,source:{ped:true,player:true,adrenaline:true}})).toMatchObject({force:10});
 expect(hit({pedPiece:PED_PIECE.torso,health:40,direction:0})).toMatchObject({clip:'hit_front',fallDown:false});
});

test('a repeated body-part reaction is re-picked through CGeneral random samples',()=>{
 const samples=[0,32767,20000];
 const repeat=computeDamageAnim(base({pedPiece:PED_PIECE.torso,previousAnimId:ANIM_ID.damStomachFront,nextRandom:()=>samples.shift()!}));
 // Sample 0 picks the first list entry, frmbk, which differs from the previous front hit.
 expect(repeat).toMatchObject({clip:'dam_stomach_frmbk'});
 const again=computeDamageAnim(base({pedPiece:PED_PIECE.torso,previousAnimId:ANIM_ID.damStomachBack,direction:2,nextRandom:(()=>{const s=[0,25000];return ()=>s.shift()!;})()}));
 // The first sample repeats frmbk, so the loop draws again; 25000 selects index 2, frmlt.
 expect(again).toMatchObject({clip:'dam_stomach_frmlt'});
 expect(()=>computeDamageAnim(base({pedPiece:PED_PIECE.torso,previousAnimId:ANIM_ID.damStomachFront}))).toThrow('random samples');
});

test('player victims gate hit reactions on the hit-animation timer and vehicles suppress them',()=>{
 const player={...npc,player:true,hitAnimDelayUntil:1000};
 expect(computeDamageAnim(base({victim:player,nowMs:900,pedPiece:PED_PIECE.torso}))).toMatchObject({id:ANIM_ID.noAnimation});
 // A standing player hit by a light gun takes the partial shot and arms a 1.5 s timer (2.5 s for the M4).
 expect(computeDamageAnim(base({victim:player,nowMs:1200}))).toMatchObject({clip:'shot_partial',hitAnimDelayUntil:2700});
 expect(computeDamageAnim(base({victim:player,nowMs:1200,weapon:WEAPON.m4}))).toMatchObject({hitAnimDelayUntil:3700});
 expect(computeDamageAnim(base({victim:{...player,driving:true},nowMs:1200}))).toMatchObject({id:ANIM_ID.noAnimation});
 // In a vehicle there is no animation; heavy hits and non-fist melee still knock the occupant over.
 const seated={...npc,inVehicle:true};
 expect(computeDamageAnim(base({victim:seated,weaponInfo:{fire:1,damage:25}}))).toMatchObject({id:ANIM_ID.noAnimation,fallDown:false});
 expect(computeDamageAnim(base({victim:seated,weaponInfo:{fire:1,damage:60}}))).toMatchObject({fallDown:true});
 expect(computeDamageAnim(base({victim:seated,weapon:WEAPON.baseballBat,weaponInfo:{fire:0,damage:10}}))).toMatchObject({fallDown:true});
 expect(computeDamageAnim(base({victim:seated,weapon:WEAPON.unarmed,weaponInfo:{fire:0,damage:10}}))).toMatchObject({fallDown:false});
});

test('a victim whose task refuses to abort is marked instead of animated, and ComputeAnim picks by health',()=>{
 expect(computeDamageAnim(base({victim:{...npc,taskRefusesAbort:true},pedPiece:PED_PIECE.torso}))).toMatchObject({id:ANIM_ID.doorLHingeO,clip:undefined,fallDown:false});
 expect(computeDamageEventAnim(base({health:0,weapon:WEAPON.shotgun,direction:2}))).toMatchObject({clip:'ko_skid_back'});
 expect(computeDamageEventAnim(base({health:30,pedPiece:PED_PIECE.torso}))).toMatchObject({clip:'dam_stomach_frmft'});
});
