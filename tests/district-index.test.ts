import {expect,test} from 'vitest';
import {buildDistrictIndex,queryDistrictIndex} from '../src/assets/districtIndex';
import {selectSceneRegion} from '../src/assets/sceneRegion';
import type {IplInstance} from '../src/assets/ipl';
const placement=(x:number,y:number,interior=0):IplInstance=>({modelId:1,modelName:'terrain',instanceType:interior,interior,position:[x,y,0],rotation:[0,0,0,1],lodIndex:-1});
const bounds={min:[-10,-2,-1] as [number,number,number],max:[10,2,1] as [number,number,number],center:[0,0,0] as [number,number,number],radius:11};
test('discovers crossing terrain from another district, excludes interiors and reports origin-only fallback',()=>{
 const index=buildDistrictIndex([{id:'LA/east',placements:[placement(0,0)]},{id:'LA/west',placements:[placement(9,0),placement(0,0,1)],boundsFor:()=>bounds},{id:'other',placements:[placement(20,0)]}]);
 expect(queryDistrictIndex(index,{x:0,y:0,radius:1,includeCollisionBounds:true})).toEqual([{id:'la/east',placements:1,originMatches:1,boundsOnlyMatches:0},{id:'la/west',placements:1,originMatches:0,boundsOnlyMatches:1}]);
 expect(queryDistrictIndex(index,{x:0,y:0,radius:1})).toHaveLength(1);expect(index[1].placements).toBe(2);expect(index[1].collisionBounds).toBe(2);
 expect(queryDistrictIndex(index,{x:0,y:0,radius:1,interior:1})).toEqual([{id:'la/west',placements:1,originMatches:1,boundsOnlyMatches:0}]);
});
test('rotated bounds and exact circle tangencies agree with the existing scene region selector',()=>{
 const p=placement(10,20);p.rotation=[0,0,Math.sin(Math.PI/4),Math.cos(Math.PI/4)];
 const index=buildDistrictIndex([{id:'a',placements:[p],boundsFor:()=>bounds}]);
 const rows=[{placement:p,ref:{namespace:'primary' as const,index:0,format:'text' as const,sourceName:'a.ipl'}}];
 for(const x of [7,8,10,12,13])for(const y of [9,10,20,30,31]){
  const region={x,y,radius:1,includeCollisionBounds:true};expect(queryDistrictIndex(index,region).length>0).toBe(selectSceneRegion(rows,0,region,()=>bounds).length>0);
 }
 p.position[0]=1000;expect(queryDistrictIndex(index,{x:10,y:20,radius:1})).toHaveLength(1);
});
test('rejects ambiguous source identity and invalid queries',()=>{
 expect(()=>buildDistrictIndex([{id:'A',placements:[]},{id:'a',placements:[]}])).toThrow('Duplicate');
 for(const radius of [-1,0,Infinity,NaN])expect(()=>queryDistrictIndex([],{x:0,y:0,radius})).toThrow('query region');
 expect(()=>buildDistrictIndex([{id:'a',placements:[placement(NaN,0)]}])).toThrow('position');
});
test('AREA_CODE_13 placements join every area',()=>{
 const index=buildDistrictIndex([{id:'a',placements:[placement(0,0,13)]},{id:'b',placements:[placement(0,0,5)]}]);
 expect(queryDistrictIndex(index,{x:0,y:0,radius:1}).map(m=>m.id)).toEqual(['a']);
 expect(queryDistrictIndex(index,{x:0,y:0,radius:1,interior:5}).map(m=>m.id)).toEqual(['a','b']);
 const rows=[placement(0,0,13),placement(0,0,5),placement(0,0)].map((p,index)=>({placement:p,ref:{namespace:'primary' as const,index,format:'text' as const,sourceName:'a.ipl'}}));
 expect(selectSceneRegion(rows,5,{x:0,y:0,radius:1}).map(p=>p.interior)).toEqual([13,5]);
 expect(selectSceneRegion(rows,0,undefined).map(p=>p.interior)).toEqual([13,0]);
});
