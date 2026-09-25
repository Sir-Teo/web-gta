import {expect,test} from 'vitest';
import {ScmObjects} from '../src/engine/ScmObjects';

const made=()=>{const objects=new ScmObjects(),h=objects.create(3127,{x:0,y:0,z:0},{external:false,missionCleanup:true}).handle;return {objects,h};};

test('PLAY_OBJECT_ANIM puts an association on a clump, found by name without regard to case, and loops it',()=>{
 const {objects,h}=made();
 expect(objects.isPlayingAnim(h,'BD_FIRE1')).toBe(false);
 objects.playAnim(h,'BD_Fire1','BD_FIRE',1000,false,true);
 expect(objects.isPlayingAnim(h,'bd_fire1')).toBe(true);
 // No length yet: the time runs, but the progress reads nothing.
 objects.advanceAnims(.5);expect(objects.animProgress(h,'BD_FIRE1')).toBe(0);
 objects.setAnimLength(h,'BD_FIRE1',2);
 expect(objects.animProgress(h,'BD_FIRE1')).toBeCloseTo(.25,9);
 objects.advanceAnims(1.75);expect(objects.animProgress(h,'BD_FIRE1')).toBeCloseTo(.125,9);
 // Played again, the same association keeps its time.
 objects.playAnim(h,'BD_FIRE1','BD_FIRE',1000,false,true);expect(objects.animProgress(h,'BD_FIRE1')).toBeCloseTo(.125,9);
 // SET_OBJECT_ANIM_SPEED scales the time; nothing for a name the clump is not playing.
 objects.setAnimSpeed(h,'BD_FIRE1',2);objects.setAnimSpeed(h,'OTHER',0);
 objects.advanceAnims(.25);expect(objects.animProgress(h,'BD_FIRE1')).toBeCloseTo(.375,9);
 expect(objects.animProgress(h,'OTHER')).toBe(0);
});

test('SET_OBJECT_ANIM_CURRENT_TIME sets m_Speed times the progress, as the object handler does',()=>{
 const {objects,h}=made();
 objects.playAnim(h,'POOL_XLONG_SHOT_O','POOL',10000,false,true);objects.setAnimLength(h,'POOL_XLONG_SHOT_O',4);
 objects.setAnimProgress(h,'POOL_XLONG_SHOT_O',.5);expect(objects.at(h).anim!.time).toBeCloseTo(.5,9);
 objects.setAnimSpeed(h,'POOL_XLONG_SHOT_O',0);objects.setAnimProgress(h,'POOL_XLONG_SHOT_O',.5);
 expect(objects.at(h).anim!.time).toBe(0);
 // A held association does not move.
 objects.advanceAnims(1);expect(objects.at(h).anim!.time).toBe(0);
 // Past the end, a loop wraps.
 objects.setAnimSpeed(h,'POOL_XLONG_SHOT_O',3);objects.setAnimProgress(h,'POOL_XLONG_SHOT_O',2);expect(objects.at(h).anim!.time).toBeCloseTo(2,9);
 objects.setAnimProgress(h,'POOL_XLONG_SHOT_O',3);expect(objects.at(h).anim!.time).toBeCloseTo(1,9);
});

test('a one-shot stops at its end: lockF holds it there, otherwise it fades out and goes; another replaces it',()=>{
 const {objects,h}=made();
 objects.playAnim(h,'KAT_THROW_O','MISC',10000,true,false);objects.setAnimLength(h,'KAT_THROW_O',1);
 objects.advanceAnims(3);
 expect(objects.animProgress(h,'KAT_THROW_O')).toBe(1);expect(objects.isPlayingAnim(h,'KAT_THROW_O')).toBe(true);
 objects.advanceAnims(3);expect(objects.isPlayingAnim(h,'KAT_THROW_O')).toBe(true);
 // Played again once it has run out, it starts over.
 objects.playAnim(h,'KAT_THROW_O','MISC',10000,true,false);expect(objects.animProgress(h,'KAT_THROW_O')).toBe(0);
 objects.playAnim(h,'PASS_RIFLE_O','MISC',10000,false,false);
 expect(objects.isPlayingAnim(h,'KAT_THROW_O')).toBe(false);
 objects.setAnimLength(h,'PASS_RIFLE_O',1);
 objects.advanceAnims(1.1);expect(objects.isPlayingAnim(h,'PASS_RIFLE_O')).toBe(true);
 objects.advanceAnims(.2);expect(objects.isPlayingAnim(h,'PASS_RIFLE_O')).toBe(true);
 objects.advanceAnims(.1);expect(objects.isPlayingAnim(h,'PASS_RIFLE_O')).toBe(false);
});

test('an atomic model takes no animation',()=>{
 const {objects,h}=made();objects.clumpModel=model=>model!==3127;
 objects.playAnim(h,'BD_FIRE1','BD_FIRE',1000,false,true);
 expect(objects.isPlayingAnim(h,'BD_FIRE1')).toBe(false);
});
