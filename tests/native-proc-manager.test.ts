import {expect,test} from 'vitest';
import {WindowsCrtRandom} from '../src/core/WindowsCrtRandom';
import {NativeProcPlacementManager} from '../src/world/NativeProcPlacementManager';
import {NativePlantPool} from '../src/world/NativePlantPool';
import {nativePlantTriangle} from '../src/world/nativePlantTriangle';
import type {NativePlantCandidate} from '../src/world/nativePlantCollision';
import type {NativeProcRule} from '../src/world/nativeProcRules';
const rule:NativeProcRule={surface:8,modelName:'shrub',line:1,spacing:2,inverseSpacingSquared:.25,minimumDistanceSquared:6400,minimumRotation:0,maximumRotation:0,minimumScaleXY:1,maximumScaleXY:1,minimumScaleZ:1,maximumScaleZ:1,minimumOffsetZ:0,maximumOffsetZ:0,align:false,useGrid:0};
const model={name:'shrub',id:865,minimumZ:-1,kind:'building' as const};
const candidate:NativePlantCandidate={index:0,surface:8,lighting:0xab,counts:undefined,triangle:nativePlantTriangle([85,0,0],[85,4,0],[89,0,0]),createsPlants:false,createsObjects:true,slot:3};
test('retained terrain creates once, preserves slots and releases on terrain deletion',()=>{
 const events:string[]=[],random=new WindowsCrtRandom(1),counts={temporaryObjects:0};
 const manager=new NativeProcPlacementManager([rule,rule],[model],random,counts,()=>[0,0,0],{
  allocate:(_model,slot)=>{events.push(`allocate:${slot}`);return slot;},
  install:(slot,t,owner)=>{events.push(`install:${slot}`);expect(t.entityMatrix[14]).toBe(1);expect(owner.candidate.lighting).toBe(0xab);},
  destroy:slot=>events.push(`destroy:${slot}`),
 });
 const terrain=new NativePlantPool(manager);
 terrain.updateEntity('terrain',[0,0,0],[candidate]);expect(terrain.size).toBe(1);expect(manager.snapshot().active).toBe(2);
 expect(events).toEqual(['allocate:511','install:511','allocate:510','install:510']);
 terrain.updateEntity('terrain',[0,0,0],[candidate]);expect(events).toHaveLength(4);
 terrain.releaseEntity('terrain');expect(events.slice(4)).toEqual(['destroy:511','destroy:510']);
 expect(manager.snapshot()).toEqual({free:512,active:0,detached:0,matrices:0,temporaryObjects:0});
});
test('camera-dependent retries can populate a retained grass triangle without replacing its seeds',()=>{
 let camera:readonly [number,number,number]=[85,0,0],installs=0;
 const manager=new NativeProcPlacementManager([rule],[model],new WindowsCrtRandom(1),{temporaryObjects:0},()=>camera,{allocate:()=>1,install:()=>{installs++;},destroy:()=>{}});
 const terrain=new NativePlantPool(manager),grass={...candidate,createsPlants:true,slot:0};
 terrain.updateEntity('terrain',camera,[grass]);const retained=terrain.triangles()[0],seeds=[...retained.seeds];expect(installs).toBe(0);
 camera=[0,0,0];terrain.updateEntity('terrain',camera,[grass],7);
 expect(terrain.triangles()[0]).toBe(retained);expect(retained.seeds).toEqual(seeds);expect(installs).toBe(1);expect(retained.createdObjects).toBe(true);
 terrain.releaseEntity('terrain');expect(manager.snapshot().active).toBe(0);
});
test('allocation failure skips transform draws and object-only triangles release immediately',()=>{
 const rng=new WindowsCrtRandom(1);let draws=0;const next=rng.nextUnit.bind(rng);rng.nextUnit=()=>{draws++;return next();};
 const manager=new NativeProcPlacementManager([rule],[model],rng,{temporaryObjects:0},()=>[0,0,0],{allocate:()=>null,install:()=>{throw Error('not reached');},destroy:()=>{}});
 const terrain=new NativePlantPool(manager);terrain.updateEntity('terrain',[0,0,0],[candidate]);
 expect(draws).toBe(2);expect(terrain.size).toBe(0);expect(manager.snapshot()).toMatchObject({active:0,detached:1,free:511});
});
test('a later installation failure releases earlier successful objects for the same triangle',()=>{
 const destroyed:number[]=[];let allocated=0;
 const manager=new NativeProcPlacementManager([rule,rule],[model],new WindowsCrtRandom(1),{temporaryObjects:0},()=>[0,0,0],{
  allocate:()=>++allocated,install:value=>{if(value===2)throw Error('material');},destroy:value=>destroyed.push(value),
 });
 const terrain=new NativePlantPool(manager);expect(()=>terrain.updateEntity('terrain',[0,0,0],[candidate])).toThrow('material');
 expect(destroyed).toEqual([2,1]);expect(manager.snapshot()).toMatchObject({active:0,matrices:0,temporaryObjects:0,detached:1});
 terrain.releaseEntity('terrain');expect(destroyed).toEqual([2,1]);
});
