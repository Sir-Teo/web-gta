import {expect,test} from 'vitest';
import {applyTimecycleBoxes,findTimecycleBox,prepareTimecycleBoxes} from '../src/world/nativeTimecycleBoxes';
import type {TimecycleBox} from '../src/assets/timecycleBoxes';
import type {NativeColourSet} from '../src/world/nativeTimecycle';
import {TIMECYCLE_FIELDS} from '../src/assets/timecycle';
const box=(overrides:Partial<TimecycleBox>={}):TimecycleBox=>({min:[0,0,0],max:[10,10,10],farClip:0,extraColor:-1,strengthPercent:100,falloff:30,lodDistanceMultiplier:1,line:1,...overrides});
const color=(value:number)=>Object.fromEntries(TIMECYCLE_FIELDS.map(k=>[k,value])) as NativeColourSet;
const table=()=>({samples:Array.from({length:184},()=>color(100))});
test('native box preparation quantizes LOD and position blending weights vertical distance by three',()=>{
 const boxes=prepareTimecycleBoxes([box({lodDistanceMultiplier:.9})]);expect(boxes[0].lodByte).toBe(28);
 expect(findTimecycleBox(boxes,[25,5,5],'lod')).toEqual({index:0,weight:.5});
 expect(findTimecycleBox(boxes,[5,5,15],'lod')).toEqual({index:0,weight:.5});
 expect(findTimecycleBox(boxes,[5,5,20],'lod')).toEqual({index:-1,weight:0});
 expect(findTimecycleBox(boxes,[40,40,5],'lod').index).toBe(-1);
 expect(prepareTimecycleBoxes([box({lodDistanceMultiplier:9})])[0].lodByte).toBe(128);
 expect(()=>findTimecycleBox(boxes,[NaN,0,0],'color')).toThrow('position');
});
test('box filters, ignored boxes, inside ties and zero falloff follow source selection',()=>{
 const boxes=prepareTimecycleBoxes([box({falloff:0}),box({farClip:800})]);
 expect(findTimecycleBox(boxes,[5,5,5],'color').index).toBe(1);
 expect(findTimecycleBox(boxes,[5,5,5],'color',1).index).toBe(0);
 expect(findTimecycleBox(boxes,[5,5,5],'lod').index).toBe(-1);
 expect(findTimecycleBox(boxes,[5,5,5],'far').index).toBe(1);
 expect(findTimecycleBox(boxes,[11,5,5],'color',1).index).toBe(-1);
});
test('regional extra colors use weather 21/22 and field-specific sentinel and integer rules',()=>{
 const data=table(),base=color(20),row=color(81);base.farClip=1000;
 row.skyBottomR=255;row.waterR=255;row.ambientR=255;row.objectAmbientR=255;row.fogStart=-1;row.farClip=-1;row.postFx1R=255;row.postFx2R=255;
 data.samples[22*8+1]=row;
 const result=applyTimecycleBoxes(base,data,prepareTimecycleBoxes([box({extraColor:9,strengthPercent:50})]),[5,5,5]);
 expect(result.colors.skyTopR).toBe(50);expect(result.colors.skyBottomG).toBe(20);expect(result.colors.waterAlpha).toBe(20);expect(result.colors.ambientG).toBe(20);expect(result.colors.objectAmbientG).toBe(20);expect(result.colors.fogStart).toBe(20);expect(result.colors.farClip).toBe(1000);expect(result.colors.postFx1Alpha).toBe(20);expect(result.colors.postFx2G).toBe(20);
 expect(result.colors.sunCoreR).toBe(20);expect(result.colors.shadowStrength).toBe(20);
 const active=table();active.samples[21*8]=color(81);const mixed=applyTimecycleBoxes(base,active,prepareTimecycleBoxes([box({extraColor:0,strengthPercent:50})]),[5,5,5]);
 expect(mixed.colors.fogStart).toBe(50.5);expect(mixed.colors.postFx1Alpha).toBe(50.5);expect(mixed.colors.postFx2G).toBe(50.5);expect(mixed.colors.objectAmbientR).toBe(50.5);
 expect(base.skyTopR).toBe(20);expect(row.skyTopR).toBe(81);
 const other=applyTimecycleBoxes(base,data,prepareTimecycleBoxes([box({extraColor:1})]),[5,5,5]);expect(other.colors.skyTopR).toBe(100);expect(other.colors.farClip).toBe(100);expect(other.colors.waterAlpha).toBe(100);
});
test('wide far-clip box blends first, neither box increases distance, and LOD interpolates separately',()=>{
 const boxes=prepareTimecycleBoxes([box({min:[400,0,0],max:[410,10,10],falloff:100,farClip:600,lodDistanceMultiplier:.9}),box({min:[0,0,0],max:[400,10,10],falloff:100,farClip:800})]);
 const base=color(0);base.farClip=1000;const result=applyTimecycleBoxes(base,table(),boxes,[450,5,5]);
 expect(result.colors.farClip).toBeCloseTo(720,3);expect(result.lodDistanceMultiplier).toBeCloseTo(.925,6);
 base.farClip=500;expect(applyTimecycleBoxes(base,table(),boxes,[450,5,5]).colors.farClip).toBe(500);
 const outside=applyTimecycleBoxes(base,table(),boxes,[900,5,5]);expect(outside.colors).toEqual(base);expect(outside.lodDistanceMultiplier).toBe(1);
});
