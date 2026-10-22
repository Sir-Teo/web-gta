import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {readIpl,type IplInstance} from '../src/assets/ipl';
import {buildDistrictIndex} from '../src/assets/districtIndex';
import {collectInteriorBounds,scriptPointHasInterior} from '../src/assets/scriptSceneArea';
const native=readIpl(new Uint8Array(readFileSync('public/play/world/files/ipl/leveldes/levelmap.ipl'))).instances;
const metadata=collectInteriorBounds(buildDistrictIndex([{id:'leveldes/levelmap',placements:native}]));
for(const p of[{x:-1004.097229,y:1000.788574,z:1350.257568},{x:-1007.213318,y:1078.534546,z:1344.337402},{x:-1130.859375,y:1059.445313,z:1345.515625}])test(`native RC battlefield point loads area 10 without an entry door: ${JSON.stringify(p)}`,()=>{
 expect(native.some(p=>p.modelName==='rczero4_base01'&&p.interior===10)).toBe(true);expect(scriptPointHasInterior(metadata,10,p)).toBe(true);expect(scriptPointHasInterior(metadata,1,p)).toBe(false);expect(scriptPointHasInterior(metadata,0,p)).toBe(false);
});
test('a script area alone does not turn street positions into the arena or Liberty interior',()=>{
 expect(scriptPointHasInterior(metadata,10,{x:-1004,y:1000,z:15})).toBe(false);
 expect(scriptPointHasInterior(metadata,1,{x:2495,y:-1687,z:13})).toBe(false);
 expect(scriptPointHasInterior(new Float64Array(),10,{x:-1004,y:1000,z:1350})).toBe(false);
});
test('transformed collision bounds recognize a large interior with a distant origin and retain strict margins',()=>{
 const p:IplInstance={modelId:1,modelName:'room',instanceType:10,interior:10,position:[0,0,1000],rotation:[0,0,Math.SQRT1_2,Math.SQRT1_2],lodIndex:-1};
 const bounds={min:[-200,-1,-2]as[number,number,number],max:[200,1,2]as[number,number,number],center:[0,0,0]as[number,number,number],radius:201};
 const meta=collectInteriorBounds(buildDistrictIndex([{id:'room',placements:[p],boundsFor:()=>bounds}]));
 expect(scriptPointHasInterior(meta,10,{x:0,y:199,z:1000},1,50)).toBe(true);
 expect(scriptPointHasInterior(meta,10,{x:0,y:199,z:1052},1,50)).toBe(false);
 expect(scriptPointHasInterior(meta,10,{x:0,y:199,z:1051.999},1,50)).toBe(true);
 expect(scriptPointHasInterior(meta,10,{x:102,y:0,z:1000},100,50)).toBe(false);
});
test('area 13 shared placements cannot establish a particular interior window',()=>{
 const p:IplInstance={modelId:1,modelName:'shared',instanceType:13,interior:13,position:[0,0,1000],rotation:[0,0,0,1],lodIndex:-1};
 const meta=collectInteriorBounds(buildDistrictIndex([{id:'shared',placements:[p]}]));expect(meta.length).toBe(0);expect(scriptPointHasInterior(meta,10,{x:0,y:0,z:1000})).toBe(false);
});
