import {expect,test} from 'vitest';
import {normalPlayerMovement} from '../src/assets/normalPlayerMovement';
import type {AnimationPackage,AnimationTrack} from '../src/assets/ifp';
const track=(boneId:number):AnimationTrack=>({boneId,name:'not-a-root-name',frameType:4,times:new Float32Array([0,1]),rotations:new Float32Array([0,0,0,1,0,0,0,1]),translations:new Float32Array(6)});
const pack=():AnimationPackage=>({name:'ped',format:'ANP3',animations:['Gun_stand','GunMove_FWD','GunMove_BWD','GunMove_L','GunMove_R','WALK_start','Run_stop','Run_stopR','IDLE_stance','WALK_player','run_player','SPRINT_civi','WEAPON_crouch','GunCrouchFwd','JUMP_launch','JUMP_launch_R','JUMP_glide','FALL_land','GunCrouchBwd','Crouch_Roll_L','Crouch_Roll_R','JUMP_land'].map(name=>({name,flags:0,duration:1,tracks:[track(12),track(0)]}))});
test('native roles use exact case-insensitive names and root bone identity, preserving idle source motion',()=>{
 const source=pack(),roles=normalPlayerMovement(source);
 expect(roles.walk).toEqual({clip:source.animations[9],track:1});
 expect(roles.run).toEqual({clip:source.animations[10],track:1});
 expect(roles.landingMoving).toEqual({clip:source.animations[21],track:1,forwardMotion:true});
 expect(roles.launch).toEqual({clip:source.animations[14],track:1,forwardMotion:true});
 expect(roles.launchRight).toEqual({clip:source.animations[15],track:1,forwardMotion:true});
 expect(roles.airborne).toEqual({clip:source.animations[16],track:1});
 expect(roles.landing).toEqual({clip:source.animations[17],track:1,forwardMotion:true});
 expect(roles.crouchIdle).toEqual({clip:source.animations[12]});
 expect(roles.crouchWalk).toEqual({clip:source.animations[13],track:1});
 expect(roles.crouchWalkBack).toEqual({clip:source.animations[18],track:1});
 expect(roles.crouchRollL).toEqual({clip:source.animations[19],track:1});
 expect(roles.crouchRollR).toEqual({clip:source.animations[20],track:1});
 expect(roles.idle).toEqual({clip:source.animations[8]});
 expect(roles.gunStand).toEqual({clip:source.animations[0]});
 expect(roles.gunMoveFwd).toEqual({clip:source.animations[1],track:1});
 expect(roles.gunMoveR).toEqual({clip:source.animations[4],track:1});
 expect(roles.walkStart).toEqual({clip:source.animations[5],track:1});
 expect(roles.runStop).toEqual({clip:source.animations[6],track:1});
 expect(roles.runStopR).toEqual({clip:source.animations[7],track:1});
});
test('incomplete or ambiguous packages cannot produce a partial preset',()=>{
 const source=pack();source.animations.pop();expect(()=>normalPlayerMovement(source)).toThrow('jump_land');
 const duplicate=pack();duplicate.animations.push({...duplicate.animations[1],name:'walk_PLAYER'});expect(()=>normalPlayerMovement(duplicate)).toThrow('walk_player');
});
test('a translated non-root track cannot substitute for native root motion',()=>{
 const source=pack();source.animations[9].tracks=[track(12)];expect(()=>normalPlayerMovement(source)).toThrow('root bone');
 source.animations[9].tracks=[{...track(0),translations:undefined}];expect(()=>normalPlayerMovement(source)).toThrow('root bone');
 source.animations[9].tracks=[track(0),track(0)];expect(()=>normalPlayerMovement(source)).toThrow('root bone');
});
test.skipIf(!process.env.GTA_CONTENT_DIR)('the native player roles build a character with every movement clip',async()=>{
 const {readFileSync,openAsBlob}=await import('node:fs');const {readIfp}=await import('../src/assets/ifp');const {readDff}=await import('../src/assets/dff');
 const {readImgIndex,readImgEntry}=await import('../src/assets/img');const {NativeCharacter}=await import('../src/render/NativeCharacter');
 const dir=process.env.GTA_CONTENT_DIR!,roles=normalPlayerMovement(readIfp(new Uint8Array(readFileSync(`${dir}/animations/ped.ifp`))));
 // A street ped's skin stands in for the player body: the check is that no role is rejected.
 const archive=await openAsBlob(`${dir}/gta3.img`),entry=(await readImgIndex(archive)).find(e=>e.name.toLowerCase()==='bmydj.dff')!;
 const model=readDff(await readImgEntry(archive,entry));
 expect(()=>new NativeCharacter({model,textures:[],convention:'san-andreas-ped',clip:roles.walk.clip,track:roles.walk.track!,...roles}).dispose()).not.toThrow();
});
