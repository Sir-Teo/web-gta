import {BinaryReader,requireAsset} from './binary';
/** CFileCarGenerator: native float position/angle and eight 32-bit fields.
 * Preserve raw settings before CCarGenerator's narrower runtime conversion. */
export interface IplCarGenerator {
 position:[number,number,number];angle:number;modelId:number;primaryColor:number;secondaryColor:number;flags:number;
 alarmChance:number;doorLockChance:number;minDelay:number;maxDelay:number;
}
function validate(value:IplCarGenerator){
 requireAsset(value.position.every(n=>Number.isFinite(n)&&Math.abs(n)<=1e7)&&Number.isFinite(value.angle),'Invalid IPL car generator position or angle.');
 for(const field of ['modelId','primaryColor','secondaryColor','alarmChance','doorLockChance','minDelay','maxDelay'] as const)requireAsset(Number.isInteger(value[field])&&value[field]>=-2147483648&&value[field]<=2147483647,`Invalid IPL car generator ${field}.`);
 requireAsset(Number.isInteger(value.flags)&&value.flags>=0&&value.flags<=0xffffffff,'Invalid IPL car generator flags.');return value;
}
export function readBinaryCarGenerator(reader:BinaryReader):IplCarGenerator{
 return validate({position:[reader.f32(),reader.f32(),reader.f32()],angle:reader.f32(),modelId:reader.i32(),primaryColor:reader.i32(),secondaryColor:reader.i32(),flags:reader.u32(),alarmChance:reader.i32(),doorLockChance:reader.i32(),minDelay:reader.i32(),maxDelay:reader.i32()});
}
export function readTextCarGenerator(fields:string[]):IplCarGenerator{
 requireAsset(fields.length===12,'IPL car generator requires 12 fields.');
 const numeric=/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;
 requireAsset(fields.slice(0,4).every(s=>numeric.test(s))&&fields.slice(4).every(s=>/^[+-]?\d+$/.test(s)),'Invalid IPL car generator number.');
 const n=fields.map(Number);requireAsset(Number.isInteger(n[7])&&n[7]>=-2147483648&&n[7]<=0xffffffff,'Invalid IPL car generator flags.');
 return validate({position:n.slice(0,3).map(Math.fround) as [number,number,number],angle:Math.fround(n[3]),modelId:n[4],primaryColor:n[5],secondaryColor:n[6],flags:n[7]>>>0,alarmChance:n[8],doorLockChance:n[9],minDelay:n[10],maxDelay:n[11]});
}
