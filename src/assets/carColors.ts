import {CHEATS} from '../simulation/nativeCheats';
import {requireAsset} from './binary';
import type {NativeCarColors,NativePaintRGB} from '../render/nativeCarPaint';
export interface CarPaletteEntry {line:number;raw:string;rgb?:NativePaintRGB;issues:string[]}
export interface CarColorDefinition {line:number;raw:string;model:string;slots:2|4;variants:[number,number,number,number][];issues:string[]}
export interface CarColorData {palette:CarPaletteEntry[];definitions:CarColorDefinition[]}
/** Bounded raw CARCOLS import. Malformed palette rows retain their slot, so later
 * indices never shift. No malformed decimal separator or byte overflow repair. */
export function readCarColors(text:string):CarColorData {
 requireAsset(text.length<=4*1024*1024,'Car colors exceed the 4 MiB text limit.');
 const palette:CarPaletteEntry[]=[],definitions:CarColorDefinition[]=[];let section='';
 for(const [index,raw] of text.replace(/^\uFEFF/,'').split(/\r?\n/).entries()){
  requireAsset(!raw.includes('\0'),`Car colors line ${index+1}: embedded NUL.`);
  const line=raw.split('#')[0].replace(/[,\x01-\x20]/g,' ').trim();if(!line)continue;
  if(line==='end'){section='';continue;}
  if(!section){requireAsset(['col','car','car4'].includes(line),`Car colors line ${index+1}: unknown section.`);section=line;continue;}
  const tokens=line.split(/\s+/),issues:string[]=[];
  const integers=(values:string[])=>values.every(v=>/^[+-]?\d+$/.test(v)&&Number.isSafeInteger(Number(v)));
  if(section==='col'){
   requireAsset(palette.length<128,'Car palette exceeds 128 entries.');
   const valid=tokens.length===3&&integers(tokens)&&tokens.every(v=>Number(v)>=0&&Number(v)<=255);
   if(!valid)issues.push('Unresolved palette entry: expected three byte RGB integers.');
   palette.push({line:index+1,raw,issues,...(valid?{rgb:tokens.map(Number) as [number,number,number]}:{})});
  }else{
   const [model,...values]=tokens,slots=section==='car'?2:4;
   requireAsset(/^[a-z0-9_]{1,63}$/i.test(model),`Car colors line ${index+1}: invalid model name.`);
   const valid=values.length>0&&values.length<=256&&values.length%slots===0&&integers(values)&&values.every(v=>Number(v)>=0&&Number(v)<=255);
   if(!valid)issues.push('Unresolved combinations: expected complete sets of byte palette indices.');
   if(valid&&values.length>slots*8)issues.push('Only the first eight combinations are loaded natively.');
   const variants:CarColorDefinition['variants']=[];
   if(valid)for(let i=0;i<values.length;i+=slots)variants.push([Number(values[i]),Number(values[i+1]),slots===4?Number(values[i+2]):0,slots===4?Number(values[i+3]):0]);
   definitions.push({line:index+1,raw,model,slots,variants,issues});requireAsset(definitions.length<=50000,'Too many car color definitions.');
  }
 }
 requireAsset(!section,'Unterminated car colors section.');
 return {palette,definitions};
}
/** Explicit variation selection; does not emulate traffic RNG or mission overrides.
 * Later definitions replace earlier ones for the same normalized model name. */
export function resolveCarColors(data:CarColorData,model:string,variation:number){
 let definition:CarColorDefinition|undefined;
 for(let i=data.definitions.length-1;i>=0;i--)if(data.definitions[i].model.toLowerCase()===model.toLowerCase()){definition=data.definitions[i];break;}
 requireAsset(definition,`No car colors for ${model}.`);
 requireAsset(definition.variants.length>0,`Unresolved car colors for ${model} at line ${definition.line}.`);
 requireAsset(Number.isInteger(variation)&&variation>=0&&variation<Math.min(8,definition.variants.length),'Invalid car color variation.');
 const indices=definition.variants[variation],colors=indices.map(index=>{
  const entry=data.palette[index];requireAsset(entry?.rgb,`Unresolved car palette index ${index}.`);return [...entry.rgb] as [number,number,number];
 }) as unknown as NativeCarColors;
 return {colors,indices:[...indices] as [number,number,number,number],line:definition.line};
}
/** CVehicleModelInfo::ChooseVehicleColour (0x4C8500): a model with no CARCOLS variations, or any model under the black
 * traffic cheat, paints every slot with palette index 0; the pink traffic cheat paints them 126. */
export function chooseVehicleColors(data:CarColorData,model:string,variation:number){
 const defined=data.definitions.some(d=>d.model.toLowerCase()===model.toLowerCase());
 const index=!defined||CHEATS.isActive('blackTraffic')?0:CHEATS.isActive('pinkTraffic')?126:undefined;
 if(index!==undefined){
  const rgb=data.palette[index]?.rgb;requireAsset(rgb,`Unresolved car palette index ${index}.`);
  return {colors:[0,1,2,3].map(()=>[...rgb!]) as unknown as NativeCarColors,indices:[index,index,index,index] as [number,number,number,number],line:0};
 }
 return resolveCarColors(data,model,variation);
}
