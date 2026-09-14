import {expect,test} from 'vitest';
import {normalPlayerMovement} from '../src/assets/normalPlayerMovement';
import type {AnimationPackage,AnimationTrack} from '../src/assets/ifp';
const track=(boneId:number):AnimationTrack=>({boneId,name:'not-a-root-name',frameType:4,times:new Float32Array([0,1]),rotations:new Float32Array([0,0,0,1,0,0,0,1]),translations:new Float32Array(6)});
const pack=():AnimationPackage=>({name:'ped',format:'ANP3',animations:['IDLE_stance','WALK_player','run_player','SPRINT_civi','WEAPON_crouch','GunCrouchFwd'].map(name=>({name,flags:0,duration:1,tracks:[track(12),track(0)]}))});
test('native roles use exact case-insensitive names and root bone identity, preserving idle source motion',()=>{
 const source=pack(),roles=normalPlayerMovement(source);
 expect(roles.walk).toEqual({clip:source.animations[1],track:1});
 expect(roles.run).toEqual({clip:source.animations[2],track:1});
 expect(roles.crouchIdle).toEqual({clip:source.animations[4]});
 expect(roles.crouchWalk).toEqual({clip:source.animations[5],track:1});
 expect(roles.idle).toEqual({clip:source.animations[0]});
});
test('incomplete or ambiguous packages cannot produce a partial preset',()=>{
 const source=pack();source.animations.pop();expect(()=>normalPlayerMovement(source)).toThrow('guncrouchfwd');
 const duplicate=pack();duplicate.animations.push({...duplicate.animations[1],name:'walk_PLAYER'});expect(()=>normalPlayerMovement(duplicate)).toThrow('walk_player');
});
test('a translated non-root track cannot substitute for native root motion',()=>{
 const source=pack();source.animations[1].tracks=[track(12)];expect(()=>normalPlayerMovement(source)).toThrow('root bone');
 source.animations[1].tracks=[{...track(0),translations:undefined}];expect(()=>normalPlayerMovement(source)).toThrow('root bone');
 source.animations[1].tracks=[track(0),track(0)];expect(()=>normalPlayerMovement(source)).toThrow('root bone');
});
