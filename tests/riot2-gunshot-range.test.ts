import {expect,test} from 'vitest';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';
import {gunshotSenseRange,gunshotWithinRange} from '../src/ped/nativeGunshotSense';
import {EVENT} from '../src/ped/nativeDecisionMaker';

test('only mission peds use the positive Riot2 override; zero/negative values restore their FOV range',()=>{
 for(const override of [-1,0,15,100])expect(gunshotSenseRange(false,override,2)).toBe(45);
 expect(gunshotSenseRange(true,15,40)).toBe(15);expect(gunshotSenseRange(true,-1,40)).toBe(40);expect(gunshotSenseRange(true,0,12)).toBe(12);expect(gunshotSenseRange(true,1e-50,12)).toBe(12);expect(gunshotSenseRange(true,15+1e-8,40)).toBe(15);
});

test('gunshot hearing uses float32 3D entity-origin distance and an inclusive squared radius',()=>{
 const origin={x:0,y:0,z:1};expect(gunshotWithinRange(origin,{x:9,y:12,z:1},15)).toBe(true);expect(gunshotWithinRange(origin,{x:9,y:12,z:2},15)).toBe(false);
 expect(gunshotWithinRange(origin,{x:15+1e-8,y:0,z:1},15)).toBe(true);expect(gunshotWithinRange(origin,{x:15.001,y:0,z:1},15)).toBe(false);expect(gunshotWithinRange(origin,{x:1,y:0,z:1},-2)).toBe(true);
});

const ped=(id:number,x:number,extra:object={})=>({id,health:100,actor:{player:{position:{x,y:0,z:0},heading:0}},...extra} as any);
const crowd=(people:any[],range:()=>number)=>Object.assign(Object.create(WorldPedestrians.prototype),{people,sim:{player:{position:{x:0,y:0,z:0}}},gunshotSenseRangeForRiot2:range,takesPriority:()=>false}) as WorldPedestrians;

test('the real gunshot event applies mission/gang/sense ranges while ambient peds keep 45, independently of the muzzle',()=>{
 let override=-1;const mission=ped(1,20,{mission:true,scriptPedType:8}),civilian=ped(2,44),custom=ped(3,20,{mission:true,ranges:{sense:25}}),ordinary=ped(4,20,{mission:true}),far=ped(5,46),people=[mission,civilian,custom,ordinary,far],world=crowd(people,()=>override);
 const heard=()=>{people.forEach(p=>p.highestEvent=undefined);world.gunShot({x:100,y:100,z:100},false);return people.filter(p=>p.highestEvent?.type===EVENT.shotFired).map(p=>p.id);};
 expect(heard()).toEqual([1,2,3]);override=15;expect(heard()).toEqual([2]);override=-1;expect(heard()).toEqual([1,2,3]);
});

test('an NPC source uses its own origin and still skips the source and its group',()=>{
 const source=ped(7,100,{party:{}}),near=ped(8,120,{mission:true,scriptPedType:8}),friend=ped(9,101,{party:source.party}),world=crowd([source,near,friend],()=>30);
 world.gunShot({x:0,y:1,z:0},false,7);expect(source.highestEvent).toBeUndefined();expect(near.highestEvent?.type).toBe(EVENT.shotFired);expect(friend.highestEvent).toBeUndefined();
});
