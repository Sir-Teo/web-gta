import {test,expect} from 'vitest';
import {selectSceneRegion} from '../src/assets/sceneRegion';
import type {IplInstance} from '../src/assets/ipl';
import type {PlacementRef} from '../src/assets/scenePlacements';
const instance=(x:number,y:number):IplInstance=>({modelId:1,modelName:'terrain',position:[x,y,0],rotation:[0,0,0,1],instanceType:0,interior:0,lodIndex:-1});
const rows=(placements:IplInstance[])=>placements.map((placement,index)=>({placement,ref:{namespace:'primary',index,format:'text',sourceName:'test.ipl',...(placement.lodIndex>=0?{lodTarget:{namespace:'primary',index:placement.lodIndex}}:{})} as PlacementRef}));
const bounds={min:[-100,-2,-2] as [number,number,number],max:[100,2,2] as [number,number,number],center:[0,0,0] as [number,number,number],radius:101};
test('boundary selection includes long terrain and its distant LOD without changing origin mode',()=>{
 const terrain=instance(100,0);terrain.lodIndex=1;const lod=instance(500,0),data=rows([terrain,lod,instance(300,0)]),region={x:0,y:0,radius:10};
 expect(selectSceneRegion(data,0,region,()=>bounds)).toEqual([]);
 expect(selectSceneRegion(data,0,{...region,includeCollisionBounds:true},()=>bounds)).toEqual([terrain,lod]);
 expect(selectSceneRegion(data,0,{...region,includeCollisionBounds:true})).toEqual([]);
});
test('terrain bounds respect inverse IPL rotation and native XY coordinates',()=>{
 const p=instance(0,100);p.rotation=[0,0,Math.SQRT1_2,Math.SQRT1_2];
 const asymmetric={...bounds,min:[0,0,-2] as [number,number,number],max:[100,2,2] as [number,number,number]};
 expect(selectSceneRegion(rows([p]),0,{x:0,y:0,radius:1,includeCollisionBounds:true},()=>asymmetric)).toEqual([p]);
 p.interior=1;expect(selectSceneRegion(rows([p]),0,{x:0,y:0,radius:1,includeCollisionBounds:true},()=>bounds)).toEqual([]);
});
test('distant selection expands only original big buildings and keeps nearby LOD ancestry',()=>{
 const near=instance(0,0);near.lodIndex=3;
 const farDetail=instance(700,0),farLod=instance(700,0),parent=instance(1500,0),outside=instance(1200,0);
 const data=rows([near,farDetail,farLod,parent,outside]);
 const selected=selectSceneRegion(data,0,{x:0,y:0,radius:100,lodRadius:1000},undefined,p=>p===farLod||p===outside?1000:undefined);
 expect(selected).toEqual([near,farLod,parent]);
 expect(()=>selectSceneRegion(data,0,{x:0,y:0,radius:100,lodRadius:50})).toThrow('distant');
 expect(()=>selectSceneRegion(data,0,{x:0,y:0,radius:100,lodRadius:Infinity})).toThrow('distant');
});
