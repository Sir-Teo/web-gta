import {requireAsset} from './binary';
export interface TimecycleBox {
  min:[number,number,number]; max:[number,number,number]; farClip:number; extraColor:number;
  strengthPercent:number; falloff:number; lodDistanceMultiplier:number; unused?:number; line:number;
}
/** San Andreas TCYC: nine required fields, then falloff and one/two LOD fields.
 * Retain source numbers; native float/byte conversion belongs to runtime preparation. */
export function readTimecycleBox(fields:string[],line:number):TimecycleBox{
  const prefix=`IPL line ${line}: `;
  requireAsset(fields.length>=9&&fields.length<=12,prefix+'expected 9–12 timecycle modifier fields.');
  const values=fields.map(Number);
  requireAsset(values.every(Number.isFinite),prefix+'non-finite timecycle modifier.');
  requireAsset(values.slice(0,6).every(v=>Math.abs(v)<=1e7),prefix+'timecycle bounds exceed the coordinate limit.');
  requireAsset(/^-?[0-9]+$/.test(fields[6])&&values[6]>=-32768&&values[6]<=32767,prefix+'invalid timecycle far clip.');
  requireAsset(/^-?[0-9]+$/.test(fields[7])&&values[7]>=-2147483648&&values[7]<=2147483647,prefix+'invalid timecycle extra color.');
  requireAsset(values.slice(0,3).every((v,i)=>v<=values[i+3]),prefix+'inverted timecycle bounds.');
  const falloff=values[9]??100,lodDistanceMultiplier=values[11]??values[10]??1;
  requireAsset(falloff>=0&&falloff<=1e7&&lodDistanceMultiplier>=0&&lodDistanceMultiplier<=1e7,prefix+'invalid timecycle falloff or LOD multiplier.');
  requireAsset(Math.abs(values[8])<=1e7,prefix+'timecycle strength exceeds the limit.');
  return {min:values.slice(0,3) as TimecycleBox['min'],max:values.slice(3,6) as TimecycleBox['max'],farClip:values[6],extraColor:values[7],strengthPercent:values[8],falloff,lodDistanceMultiplier,...(values.length===12?{unused:values[10]}:{}),line};
}
