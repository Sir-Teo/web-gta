import {afterEach,beforeAll,expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import RAPIER from '@dimforge/rapier3d-compat';
import {Scene} from 'three';
import {NativeBuildingSwaps,buildingPlacementKey,closestBuildingForSwap,replaceSceneBuildingModels,sceneBuildings,type BuildingSwapCandidate} from '../src/simulation/nativeBuildingSwap';
import {installNativeScene} from '../src/simulation/nativeScene';
import {readDff} from '../src/assets/dff';
import {readCol} from '../src/assets/col';
import type {ScenePart} from '../src/assets/scene';
import {indexObjectData,readObjectData} from '../src/assets/objectData';
import {ScmMission} from '../src/simulation/ScmMission';
import {decodeScmInstructions,readScmHeader} from '../src/assets/scm';
const candidate=(key:string,x=0,y=0,z=0,modelId=1):BuildingSwapCandidate=>({key,model:'old',modelId,position:{x,y,z},format:'text'});
const model=readDff(new Uint8Array(readFileSync('tests/fixtures/dragonff-model.dff'))),collision=readCol(new Uint8Array(readFileSync('tests/fixtures/dragonff-collision-v3.col')))[0];
function part(name='old',id=1):ScenePart{return {name,model,collision,collisionSource:'diagnostic.col',textures:[],dictionaryNames:[],notices:[],definition:{id,model:name,dictionary:'test',section:'objs',drawDistance:150,flags:0},placements:[0,10].map(x=>({modelId:id,modelName:name,instanceType:0,interior:0,position:[x,0,0],rotation:[0,0,0,1],lodIndex:-1})),sourceRefs:[0,1].map(index=>({namespace:'static',index,format:'text',sourceName:'test.ipl'}))};}

test('building swaps use a strict planar radius then strict three-dimensional nearest, with the first tie retained',()=>{
 const a=candidate('high',0,0,19),b=candidate('near',3,0,0),tie=candidate('tie',-3,0,0),outside=candidate('edge',10,0,0);
 expect(closestBuildingForSwap([a,b,tie,outside],{x:0,y:0,z:0},10,1)).toBe(b);
 expect(closestBuildingForSwap([outside],{x:0,y:0,z:0},10,1)).toBeUndefined();
 expect(closestBuildingForSwap([candidate('too high',0,0,20)],{x:0,y:0,z:0},10,1)).toBeUndefined();
 expect(closestBuildingForSwap([a],{x:0,y:0,z:0},10,'OLD')).toBe(a);
});

test('only the first sixteen matching buildings inside the float32 radius reach nearest selection',()=>{
 const rows=[...Array.from({length:30},(_,i)=>candidate(`wrong${i}`,0,0,0,2)),...Array.from({length:16},(_,i)=>candidate(`high${i}`,0,0,19)),candidate('seventeenth',0,0,0)];
 expect(closestBuildingForSwap(rows,{x:0,y:0,z:0},10,1)?.key).toBe('high0');
 // Native input conversion rounds the just-inside double to the exact, excluded radius.
 expect(closestBuildingForSwap([candidate('rounded edge',10-1e-8)],{x:0,y:0,z:0},10,1)).toBeUndefined();
});

test('one building gets the new clump and COL while preserving placement, source and LOD identity',()=>{
 const original=part(),target=part('replacement',2);original.sourceRefs![0].lodTarget={namespace:'static',index:1};
 const key=buildingPlacementKey(original,0)!,next=replaceSceneBuildingModels([original],new Map([[key,target]])),swapped=next.find(p=>p.name===target.name)!;
 expect(next.find(p=>p.name==='old')?.placements).toEqual([original.placements[1]]);expect(swapped.model).toBe(target.model);expect(swapped.collision).toBe(target.collision);
 expect(swapped.placements[0]).toEqual({...original.placements[0],modelId:2,modelName:'replacement'});expect(swapped.sourceRefs).toEqual([original.sourceRefs![0]]);expect(swapped.nativeEntityKind).toBe('building');expect(original.placements).toHaveLength(2);
 const defs=indexObjectData(readObjectData('replacement 99999 20 .99 .1 50 0 1 0 0 0 0 0'));
 expect(sceneBuildings([target],defs)).toEqual([]);expect(sceneBuildings([swapped],defs)).toHaveLength(1);
});

test('the text swap ledger updates, clears on restoration, persists across windows and rolls back a failed replacement',()=>{
 const old=part(),b=part('open',2),c=part('filled',3),registry=new NativeBuildingSwaps(),source=sceneBuildings([old],new Map())[0];
 registry.stage(source,b);expect(registry.snapshot().tracked).toEqual([{key:source.key,original:'old',current:'open'}]);
 registry.windowInstalled([]);expect(registry.apply([old]).some(p=>p.name==='open')).toBe(true);
 const undo=registry.stage({...source,model:'open',modelId:2},c);expect(registry.snapshot().tracked[0].current).toBe('filled');undo();expect(registry.snapshot().tracked[0].current).toBe('open');
 registry.stage({...source,model:'open',modelId:2},old);expect(registry.snapshot().tracked).toEqual([]);expect(registry.apply([old])[0]).toBe(old);
});

test('a full 25-slot ledger still changes live geometry; binary entities retire only after a window commits',()=>{
 const registry=new NativeBuildingSwaps(),target=part('open',2);
 for(let i=0;i<26;i++)registry.stage(candidate(String(i)),target);
 expect(registry.snapshot().tracked).toHaveLength(25);expect(registry.snapshot().live).toBe(26);
 const old=part(),source={...sceneBuildings([old],new Map())[0],format:'binary' as const};registry.stage(source,target);
 registry.apply([]);expect(registry.apply([old]).some(p=>p.name==='open')).toBe(true);
 registry.windowInstalled([]);expect(registry.apply([old])[0]).toBe(old);expect(registry.snapshot().tracked).toHaveLength(25);
});

let world:RAPIER.World|undefined;beforeAll(async()=>{await RAPIER.init();});afterEach(()=>{world?.free();world=undefined;});
test('installed replacement changes the collision surface, retains neighboring bodies and keeps CBuilding classification',()=>{
 world=new RAPIER.World({x:0,y:-9.81,z:0});const old=part(),target=part('open',2),newCol=structuredClone(collision);target.collision=newCol;
 newCol.spheres=[];newCol.boxes=[];newCol.mesh={positions:new Float32Array([-2,-2,-3,2,-2,-3,0,2,-3]),indices:new Uint32Array([0,1,2]),materials:new Uint8Array([0]),lights:new Uint8Array([0])};
 let installed=installNativeScene(world,new Scene(),[old],{datasetIdentity:'test'});installed.setObjectData(new Map());world.step();
 const neighbor=[...installed.sources].filter(([,s])=>s.placement?.position[0]===10).map(([h])=>h),before=world.castRay(new RAPIER.Ray({x:0,y:10,z:0},{x:0,y:-1,z:0}),20,true)!.timeOfImpact;
 const next=replaceSceneBuildingModels(installed.parts,new Map([[buildingPlacementKey(old,0)!,target]]));installed=installed.replace(next,undefined,'test');world.step();
 const hit=world.castRay(new RAPIER.Ray({x:0,y:10,z:0},{x:0,y:-1,z:0}),20,true)!;expect(hit.timeOfImpact).toBeCloseTo(13);expect(hit.timeOfImpact).toBeGreaterThan(before);
 expect([...installed.sources].filter(([,s])=>s.placement?.position[0]===10).map(([h])=>h)).toEqual(neighbor);expect(installed.reusedPlacementCount).toBe(1);
 installed.setObjectData(indexObjectData(readObjectData('open 99999 20 .99 .1 50 0 1 0 0 0 0 0')));expect(installed.sources.get(hit.collider.handle)?.entityKind).toBe('building');expect(installed.datasetIdentity).toBe('test');expect(installed.parts).toEqual(next);installed.dispose();
});

test('all three original DECON instructions resolve used-object names and reach the building replacement adapter',()=>{
 const script=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm')),header=readScmHeader(script),block=header.missions[50],sites=decodeScmInstructions(script,block.start,block.end).filter(i=>i.opcode===0x3b6),calls:unknown[][]=[];
 const m=new ScmMission(script,{infoLabels:['TEST'],population:[]} as any,{swapWorldBuildingModel:(...args:unknown[])=>calls.push(args)} as any);
 expect(sites.map(i=>i.offset)).toEqual([1384334,1402873,1402940]);
 for(const site of sites){const code=new Uint8Array(site.end-site.offset+2);code.set(script.subarray(site.offset,site.end));code.set([0x4e,0],site.end-site.offset);m.runtime.start(0,[],{space:code}).thread.run(1000,100,1);}
 expect(calls.map(c=>c.slice(1))).toEqual([[20,'HUBHOLE1_SFSE','HUBHOLE2_SFSE'],[20,'HUBHOLE2_SFSE','HUBHOLE1_SFSE'],[20,'HUBHOLE2_SFSE','HUBHOLE4_SFSE']]);
 expect(calls[0][0]).toEqual({x:-2049.17138671875,y:250.31930541992188,z:34.47700119018555});expect(m.snapshot().skipped).toEqual([]);
});
