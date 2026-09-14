import {expect,test} from 'vitest';
import {WindowsCrtRandom} from '../src/core/WindowsCrtRandom';
import {NativeProcPlacementManager} from '../src/world/NativeProcPlacementManager';
import {NativePlantPool} from '../src/world/NativePlantPool';
import {nativePlantTriangle} from '../src/world/nativePlantTriangle';
import type {NativePlantCandidate} from '../src/world/nativePlantCollision';
import type {NativeProcRule} from '../src/world/nativeProcRules';
import constructorReference from './fixtures/native-proc-constructor-reference.json';
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
test('entity constructors consume and retain their seed before transform samples for both model kinds',()=>{
 for(const kind of ['building','object'] as const)for(const failFirst of [0,1]){
  let attempts=0;const actual:number[][]=[],random=new WindowsCrtRandom(1);
  const varied={...rule,inverseSpacingSquared:.375,maximumScaleXY:2,maximumScaleZ:3,maximumRotation:1,maximumOffsetZ:2};
  const manager=new NativeProcPlacementManager([varied],[{...model,kind}],random,{temporaryObjects:0},()=>[0,0,0],{
   allocate:()=>{const attempt=attempts++;return failFirst&&attempt===0?null:attempt;},
   install:(attempt,t,_triangle,seed)=>actual.push([failFirst,attempt,seed,t.entityMatrix[12],t.entityMatrix[13],t.entityMatrix[14],t.xyScale,t.zScale,t.rotation,t.offset]),
   destroy:()=>{},
  });
  const terrain=new NativePlantPool(manager);terrain.updateEntity('terrain',[0,0,0],[candidate]);
  const expected=constructorReference.filter(row=>row[0]===failFirst);
  expect(actual).toHaveLength(expected.length);
  actual.forEach((row,index)=>row.forEach((value,column)=>expect(value).toBeCloseTo(expected[index][column],5)));
  // AddObjects still reseeds from the saved output, not constructor state.
  expect(random.next()).toBe(new WindowsCrtRandom(new WindowsCrtRandom(1).next()).next());
  terrain.releaseEntity('terrain');
 }
});
test('pool rejection and failed allocation consume no constructor seed',()=>{
 for(const cap of [false,true]){
  const random=new WindowsCrtRandom(1);let rawDraws=0,allocations=0;
  const next=random.next.bind(random);random.next=()=>{rawDraws++;return next();};
  const manager=new NativeProcPlacementManager([{...rule,inverseSpacingSquared:.375}],[{...model,kind:'object'}],random,{temporaryObjects:cap?150:0},()=>[0,0,0],{
   allocate:()=>{allocations++;return null;},install:()=>{throw Error('not reached');},destroy:()=>{},
  });
  const terrain=new NativePlantPool(manager);terrain.updateEntity('terrain',[0,0,0],[candidate]);
  expect(rawDraws).toBe(5); // saved output + two point draws per attempt
  expect(allocations).toBe(cap?0:2);expect(terrain.size).toBe(0);
 }
});
