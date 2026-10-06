import {expect,test} from 'vitest';
import {npcThrowForce,playerThrowForce,throwButtonCounter,throwClip,throwFireTime,throwFiresNow,THROW_CLIP,THROW_UP_CLIP} from '../src/weapons/nativeThrowProjectile';
import {molotovArmed} from '../src/weapons/nativeProjectile';
test('the button counter is the held time capped at 533 ms over 20, the force 0.0375 of it',()=>{
 expect(throwButtonCounter(0)).toBe(0);expect(throwButtonCounter(200)).toBe(10);expect(throwButtonCounter(533)).toBeCloseTo(26.65,6);expect(throwButtonCounter(2000)).toBeCloseTo(26.65,6);expect(throwButtonCounter(-5)).toBe(0);
 expect(playerThrowForce(2000)).toBeCloseTo(26.65*.0375,6);expect(playerThrowForce(100)).toBeCloseTo(5*.0375,6);
});
test('an NPC throws with 0.3, or the distance past 10 over 10 clamped to 0.2..1 with a target point',()=>{
 expect(npcThrowForce()).toBe(.3);expect(npcThrowForce(5)).toBe(.2);expect(npcThrowForce(15)).toBeCloseTo(.5,6);expect(npcThrowForce(40)).toBe(1);
});
test('WEAPON_throwu only plays with a far target entity, a far target point, the button still held and no satchel',()=>{
 expect(throwClip({buttonReleased:false,satchel:false})).toBe(THROW_CLIP);
 expect(throwClip({targetEntityDistance:30,buttonReleased:false,satchel:false})).toBe(THROW_CLIP);
 expect(throwClip({targetEntityDistance:30,targetPointDistance:30,buttonReleased:false,satchel:false})).toBe(THROW_UP_CLIP);
 expect(throwClip({targetEntityDistance:30,targetPointDistance:9,buttonReleased:false,satchel:false})).toBe(THROW_CLIP);
 expect(throwClip({targetEntityDistance:8,targetPointDistance:30,buttonReleased:false,satchel:false})).toBe(THROW_CLIP);
 expect(throwClip({targetEntityDistance:30,targetPointDistance:30,buttonReleased:true,satchel:false})).toBe(THROW_CLIP);
 expect(throwClip({targetEntityDistance:30,targetPointDistance:30,buttonReleased:false,satchel:true})).toBe(THROW_CLIP);
});
test('the projectile leaves at anim loop 2 fire for WEAPON_throw and anim loop fire for WEAPON_throwu, once',()=>{
 const loops={loop:{fire:.2},loop2:{fire:.2667}};
 expect(throwFireTime(THROW_CLIP,loops)).toBe(.2667);expect(throwFireTime(THROW_UP_CLIP,loops)).toBe(.2);
 expect(throwFiresNow(.2667,.25,1/60)).toBe(false);expect(throwFiresNow(.2667,.27,1/60)).toBe(true);expect(throwFiresNow(.2667,.29,1/60)).toBe(false);
});

test('a molotov is tested for a burst only once its last position is √2 or more from its thrower',()=>{
 const thrower={x:0,y:1,z:0};
 expect(molotovArmed({x:1,y:1.9,z:0},thrower)).toBe(false);
 expect(molotovArmed({x:1,y:2,z:0},thrower)).toBe(true);
 expect(molotovArmed({x:1.2,y:1.8,z:.1},undefined)).toBe(true);
});
