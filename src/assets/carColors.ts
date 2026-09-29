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
   // CVehicleModelInfo::LoadVehicleColours (0x5B6890): sscanf "%d %d %d" into zeroed red, green and blue, then
   // CRGBA::Set keeps each low byte. A scan stops at the first field that is not an integer, so the stock row
   // `77.93,96` (98, malachite poly) is (77, 0, 0), not a missing colour.
   palette.push({line:index+1,raw,issues,rgb:valid?tokens.map(Number) as [number,number,number]:scanPaletteRow(line)});
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
/** sscanf(line, "%d %d %d") as CRGBA::Set stores it: fields in order until one fails, the rest 0, each one byte. */
function scanPaletteRow(line:string):[number,number,number]{
 const rgb:[number,number,number]=[0,0,0],field=/\s*([+-]?\d+)/y;
 for(let i=0;i<3;i++){const match=field.exec(line);if(!match)break;rgb[i]=Number(BigInt.asUintN(8,BigInt(match[1])));}
 return rgb;
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
  // The stock CARCOLS gives the Moonbeam a 227 (`117,227`), past the 128-entry ms_vehicleColourTable, where the
  // original reads whatever follows the table. Such a slot paints as entry 0, as a model without variations does,
  // so the van is still made: throwing here cancelled the car, and INTRO, which asks for a random one, gave up
  // with the player's controls off.
  const entry=index>=128?data.palette[0]:data.palette[index];
  requireAsset(entry?.rgb,`Unresolved car palette index ${index}.`);return [...entry.rgb] as [number,number,number];
 }) as unknown as NativeCarColors;
 return {colors,indices:[...indices] as [number,number,number,number],line:definition.line};
}
/** CVehicleModelInfo::ChooseVehicleColour (0x4C8500): a model with no CARCOLS variations, or any model under the black
 * traffic cheat, paints every slot with palette index 0; the pink traffic cheat paints them 126. */
/** The model's carcols variations, capped at the native eight. */
export function carColorVariationCount(data:CarColorData,model:string){
 const name=model.toLowerCase();
 for(let i=data.definitions.length-1;i>=0;i--)if(data.definitions[i].model.toLowerCase()===name)return Math.min(8,data.definitions[i].variants.length);
 return 0;
}
/** A model variation's four palette indices, for the player-match test. */
export function carColorVariationIndices(data:CarColorData,model:string,variation:number){
 const name=model.toLowerCase();
 for(let i=data.definitions.length-1;i>=0;i--)if(data.definitions[i].model.toLowerCase()===name)return data.definitions[i].variants[variation];
 return undefined;
}
export function chooseVehicleColors(data:CarColorData,model:string,variation:number){
 const defined=data.definitions.some(d=>d.model.toLowerCase()===model.toLowerCase());
 const index=!defined||CHEATS.isActive('blackTraffic')?0:CHEATS.isActive('pinkTraffic')?126:undefined;
 if(index!==undefined){
  const rgb=data.palette[index]?.rgb;requireAsset(rgb,`Unresolved car palette index ${index}.`);
  return {colors:[0,1,2,3].map(()=>[...rgb!]) as unknown as NativeCarColors,indices:[index,index,index,index] as [number,number,number,number],line:0};
 }
 return resolveCarColors(data,model,variation);
}
