import {expect,test,vi} from 'vitest';
import {scriptRiderDeath} from '../src/vehicle/scriptRiderDeath';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';

test('a scripted rider death keeps its entity and corpse pose, without scorching or restarting a prior death',async()=>{
 const load=vi.fn(async()=>({name:'KO_shot_front'} as any)),r={health:100,gone:false,offset:{x:0,y:2,z:1},diedInSeat:false,driveBy:{},clip:undefined as any,renderScorched:false};scriptRiderDeath(r,1000,load);const first=r.clip;await Promise.resolve();expect(r).toMatchObject({health:0,gone:false,diedInSeat:true,driveBy:undefined,renderScorched:false});expect(r.clip).toMatchObject({name:'ko_shot_front',started:1000,hold:true,loop:false,seconds:Infinity,animation:{name:'KO_shot_front'}});
 scriptRiderDeath(r,2000,load);expect(r.clip).toBe(first);expect(load).toHaveBeenCalledTimes(1);
 const seated={health:100,gone:false,diedInSeat:false};scriptRiderDeath(seated,1000,load);expect(seated).toMatchObject({health:0,gone:false,diedInSeat:true});expect(load).toHaveBeenCalledTimes(1);
});

test('an old death animation load cannot replace a removed or changed rider clip, and missing clips settle',async()=>{
 let resolve!:(clip:any)=>void;const r={health:100,gone:false,offset:{},clip:undefined as any};scriptRiderDeath(r,0,()=>new Promise<any>(done=>resolve=done));const next={name:'different'};r.clip=next;resolve({name:'old'});await Promise.resolve();expect(r.clip).toBe(next);
 const gone={health:100,gone:false,offset:{},clip:undefined as any};scriptRiderDeath(gone,0,()=>new Promise<any>(done=>resolve=done));gone.gone=true;resolve({name:'old'});await Promise.resolve();expect(gone.clip.animation).toBeUndefined();
 const missing={health:100,gone:false,offset:{},clip:undefined as any};scriptRiderDeath(missing,0,async()=>{throw new Error('missing');});await Promise.resolve();await Promise.resolve();expect(missing.clip.failed).toBe(true);
});

test('restoring a dead script body retains scorched state, a low collider and a visible held pose without another hit',()=>{
 const setTranslation=vi.fn(),setNextKinematicTranslation=vi.fn(),setShape=vi.fn(),playReaction=vi.fn(),p={health:100,down:0,renderScorched:true,order:{kind:'wander'},actor:{player:{position:{x:3,y:4,z:5}}},body:{setTranslation,setNextKinematicTranslation},collider:{setShape},view:{playReaction}} as any;
 WorldPedestrians.prototype.restoreDeadScriptPed.call({people:[p]} as any,p);expect(p).toMatchObject({health:0,down:Infinity,renderScorched:true,order:undefined,fallClip:'ko_shot_front'});expect(setTranslation).toHaveBeenCalledWith({x:3,y:4.3,z:5},true);expect(setNextKinematicTranslation).toHaveBeenCalledWith({x:3,y:4.3,z:5});expect(setShape).toHaveBeenCalledOnce();expect(playReaction).toHaveBeenCalledWith('ko_shot_front',Infinity);
});
