import {readFileSync} from 'node:fs';
import {afterEach,beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {NativeCharacter} from '../src/render/NativeCharacter';
import {readDff} from '../src/assets/dff';
import {readIfp} from '../src/assets/ifp';
import {Simulation} from '../src/simulation/Simulation';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';
let sim:Simulation|undefined,view:NativeCharacter|undefined;
beforeAll(async()=>{await RAPIER.init();});afterEach(()=>{view?.dispose();sim?.dispose();view=undefined;sim=undefined;});
function setup(death='ko_shot_front'){
 sim=new Simulation();const clip=readIfp(new Uint8Array(readFileSync('tests/fixtures/animation-rig.ifp'))).animations[0];
 view=new NativeCharacter({model:readDff(new Uint8Array(readFileSync('tests/fixtures/dragonff-skin.dff'))),textures:[],clip,track:0});view.installReactions({[death]:clip,floor_hit:clip,floor_hit_f:clip});view.playReaction(death,Infinity);
 const p={id:1,health:0,deadTime:100,view,collider:{handle:1},actor:{player:sim.player}} as any,host={people:[p]} as any;
 const hit=()=>WorldPedestrians.prototype.damageCollider.call(host,1,100,{x:0,z:1},'bullet',{weapon:22});return {p,host,hit,view,sim,clip};
}

test('a paused/slowed dying clip cannot become a settled corpse just because its removal clock elapsed',()=>{
 const {p,hit,view,sim}=setup();view.setReactionPlaying('ko_shot_front',false);view.step(5,{x:0,y:0,cameraYaw:0,sprint:false,jump:false},sim);
 expect(view.reactionPlayedOut).toBe(false);expect(hit()).toBe(false);expect(view.reactionName).toBe('ko_shot_front');
 view.setReactionPlaying('ko_shot_front',true);view.setReactionSpeed('ko_shot_front',.1);view.step(1,{x:0,y:0,cameraYaw:0,sprint:false,jump:false},sim);expect(hit()).toBe(false);expect(p.health).toBe(0);
});

test('medical treatment resets corpse removal time without suppressing a finished death animation’s floor hit',()=>{
 const {p,host,hit,view}=setup();view.setReactionProgress('ko_shot_front',1);WorldPedestrians.prototype.holdDead.call(host,1);expect(p.deadTime).toBe(0);
 expect(hit()).toBe(true);expect(view.reactionName).toBe('floor_hit_f');expect(view.reactionProgress).toBe(0);expect(p.health).toBe(0);expect(p.deadTime).toBe(0);
 view.setReactionProgress('floor_hit_f',.5);expect(hit()).toBe(true);expect(view.reactionProgress).toBe(0);
});

test('a fatal floor-hit animation must finish before later corpse hits, which can then restart it immediately',()=>{
 const {hit,view}=setup('floor_hit');expect(hit()).toBe(false);view.setReactionProgress('floor_hit',1);expect(hit()).toBe(true);expect(view.reactionName).toBe('floor_hit');expect(view.reactionPlayedOut).toBe(false);expect(hit()).toBe(true);
});

test('revival clears corpse-hit readiness before a later death',()=>{
 const {p,host,hit,view}=setup();view.setReactionProgress('ko_shot_front',1);expect(hit()).toBe(true);expect(p.corpseHitReady).toBe(true);
 expect(WorldPedestrians.prototype.revive.call(host,1)).toBe(true);expect(p.corpseHitReady).toBe(false);
 p.health=0;p.deadTime=100;view.playReaction('ko_shot_front',Infinity);expect(hit()).toBe(false);
});
