import {requireAsset} from './binary';

export const PLANT_FIELDS=['cover','slot','model','texture','red','green','blue','intensity','intensityVariation','alpha','scaleXY','scaleZ','scaleVariationXY','scaleVariationZ','windBend','windVariation','density'] as const;
export const PROC_OBJECT_FIELDS=['spacing','minDistance','minRotation','maxRotation','minScaleXY','maxScaleXY','minScaleZ','maxScaleZ','minOffsetZ','maxOffsetZ','align','useGrid'] as const;
const numeric=/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

/** Preserve file values. Native clamping, byte casts and random placement belong
 * to the simulation, not content parsing (some source ranges are reversed). */
function readRows<const F extends readonly string[]>(text:string,fields:F,procedural:boolean){
 requireAsset(text.length<=4*1024*1024,'Vegetation data exceeds the 4 MiB limit.');
 const rows:{surface:string;modelName?:string;line:number;values:Record<F[number],number>}[]=[];
 for(const [index,raw] of text.replace(/^\uFEFF/,'').split(/\r?\n/).entries()){
  const line=raw.replace(/[\x01-\x20,]/g,' ').trim(),label=`Vegetation line ${index+1}`;
  if(!procedural&&line===';the end')break;
  if(!line||line.startsWith(procedural?'#':';'))continue;
  const tokens=line.split(/\s+/),offset=procedural?2:1;
  requireAsset(tokens.length>=fields.length+offset,`${label}: incomplete record.`);
  requireAsset(tokens.slice(0,offset).every(name=>/^[a-z0-9_]+$/i.test(name)&&name.length<=63),`${label}: invalid surface/model name.`);
  const values={} as Record<F[number],number>;
  fields.forEach((field,i)=>{
   const token=tokens[i+offset],value=Number(token);
   requireAsset(numeric.test(token)&&Number.isFinite(value)&&Number.isFinite(Math.fround(value)),`${label}: invalid ${field}.`);
   if(procedural?[2,3,10,11].includes(i):i<10)requireAsset(Number.isInteger(value)&&value>=-2147483648&&value<=2147483647,`${label}: ${field} must be a signed integer.`);
   values[field as F[number]]=value;
  });
  rows.push({surface:tokens[0],...(procedural?{modelName:tokens[1]}:{}),line:index+1,values});
  requireAsset(rows.length<=4096,'Vegetation data exceeds the record limit.');
 }
 return rows;
}
export const readPlants=(text:string)=>readRows(text,PLANT_FIELDS,false);
export const readProcObjects=(text:string)=>readRows(text,PROC_OBJECT_FIELDS,true);
