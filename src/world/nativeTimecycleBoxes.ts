import type {TimecycleBox} from '../assets/timecycleBoxes';
import {readTimecycleBox} from '../assets/timecycleBoxes';
import type {NativeColourSet,NativeTimecycle} from './nativeTimecycle';
type Point=readonly [number,number,number];
export interface NativeTimecycleBox {min:Point;max:Point;farClip:number;extraColor:number;strength:number;falloff:number;lodByte:number}
const f=Math.fround;
const lerp=(a:number,b:number,t:number)=>f(f(a*f(1-t))+f(b*t));
/** Store the source's float and fixed-point fields before spatial evaluation. */
export function prepareTimecycleBoxes(boxes:readonly TimecycleBox[]):NativeTimecycleBox[]{
 if(boxes.length>4096)throw new Error('Too many regional timecycle modifiers.');
 return boxes.map(b=>{
  readTimecycleBox([...b.min,...b.max,b.farClip,b.extraColor,b.strengthPercent,b.falloff,b.lodDistanceMultiplier].map(String),b.line);
  return {min:b.min.map(f) as unknown as Point,max:b.max.map(f) as unknown as Point,farClip:b.farClip,extraColor:b.extraColor,strength:f(f(b.strengthPercent)/100),falloff:f(b.falloff),lodByte:Math.trunc(f(Math.min(f(b.lodDistanceMultiplier),4)*32))};
 });
}
/** Native XYZ. Vertical distance is weighted by three; ties inside select the last box. */
export function findTimecycleBox(boxes:readonly NativeTimecycleBox[],position:Point,kind:'color'|'lod'|'far',ignored=-1){
 const p=position.map(f);if(!p.every(Number.isFinite))throw new Error('Invalid timecycle sampling position.');
 let index=-1,weight=0;
 boxes.forEach((b,i)=>{
  if(i===ignored||kind==='lod'&&b.lodByte===32||kind==='far'&&b.farClip===0)return;
  if(p.some((v,a)=>v<f(b.min[a]-(a===2?f(b.falloff/3):b.falloff))||v>f(b.max[a]+(a===2?f(b.falloff/3):b.falloff))))return;
  const d=p.map((v,a)=>v<b.min[a]?f(b.min[a]-v):v>b.max[a]?f(v-b.max[a]):0);d[2]=f(d[2]*3);
  const distance=f(Math.sqrt(f(f(f(d[0]*d[0])+f(d[1]*d[1]))+f(d[2]*d[2]))));
  if(distance===0){index=i;weight=1;return;}
  const t=f(1-f(distance/b.falloff));if(t>weight){index=i;weight=t;}
 });
 return {index,weight};
}
/** Apply regional rules after base weather/time, before the final altitude far-clip correction.
 * The caller owns camera/player sampling choice and application of returned LOD distance. */
export function applyTimecycleBoxes(base:NativeColourSet,data:NativeTimecycle,boxes:readonly NativeTimecycleBox[],position:Point,baseLod=1){
 const colors={...base},weather=findTimecycleBox(boxes,position,'color'),lod=findTimecycleBox(boxes,position,'lod');
 let a=findTimecycleBox(boxes,position,'far'),b=a.index>=0?findTimecycleBox(boxes,position,'far',a.index):{index:-1,weight:0};
 if(a.index>=0&&b.index>=0&&f(boxes[b.index].max[0]-boxes[b.index].min[0])>f(boxes[a.index].max[0]-boxes[a.index].min[0]))[a,b]=[b,a];
 const box=boxes[weather.index];
 if(box&&box.extraColor>=0){
  const row=data.samples[(box.extraColor>=8?22:21)*8+box.extraColor%8];
  if(!row)throw new Error('Unavailable regional extra-color sample.');
  const t=f(weather.weight*box.strength);
  const blend=(keys:(keyof NativeColourSet)[],integer=false)=>{for(const key of keys){const value=lerp(colors[key]!,row[key]!,t);colors[key]=integer?((Math.trunc(value)%65536)+65536)%65536:value;}};
  blend(['skyTopR','skyTopG','skyTopB'],true);
  if(row.skyBottomR!==255)blend(['skyBottomR','skyBottomG','skyBottomB'],true);
  if(row.waterR!==255)blend(['waterR','waterG','waterB','waterAlpha']);
  if(row.ambientR!==255)blend(['ambientR','ambientG','ambientB']);
  if(row.objectAmbientR!==255)blend(['objectAmbientR','objectAmbientG','objectAmbientB']);
  if(row.farClip!==-1&&row.farClip<colors.farClip)colors.farClip=lerp(colors.farClip,row.farClip,t);
  if(row.fogStart!==-1)blend(['fogStart']);
  if(row.postFx1R!==255)blend(['postFx1R','postFx1G','postFx1B','postFx1Alpha']);
  if(row.postFx2R!==255)blend(['postFx2R','postFx2G','postFx2B','postFx2Alpha']);
 }
 for(const selected of [a,b])if(selected.index>=0)colors.farClip=lerp(colors.farClip,Math.min(colors.farClip,boxes[selected.index].farClip),selected.weight);
 return {colors,lodDistanceMultiplier:lod.index>=0?lerp(baseLod,f(boxes[lod.index].lodByte/32),lod.weight):baseLod};
}
