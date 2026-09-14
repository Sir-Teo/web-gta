import {requireAsset} from './binary';
import type {HandlingSupplement} from './handling';
/** cHandlingDataMgr.h VT_SEAPLANE through VT_RCRAIDER, in native table order. File names SEASPAR/POLMAV correspond to
 * VT_SEASPARROW/VT_POLICEMAV; enum identifiers are not file lookup names. */
export const NATIVE_FLYING_HANDLING_NAMES=['SEAPLANE','VORTEX','RUSTLER','BEAGLE','CROPDUST','STUNT','SHAMAL','HYDRA','NEVADA','AT400','ANDROM','DODO','SPARROW','SEASPAR','MAVERICK','COASTMAV','POLMAV','HUNTER','LEVIATHN','CARGOBOB','RAINDANC','RCBARON','RCGOBLIN','RCRAIDER'] as const;
export const FLYING_HANDLING_FIELDS=['thrust','thrustFallOff','yaw','yawStabilization','sideSlip','roll','rollStabilization','pitch','pitchStabilization','formLift','attackLift','gearUpResistance','gearDownLift','windMultiplier','moveResistance','turnResistanceX','turnResistanceY','turnResistanceZ','speedResistanceX','speedResistanceY','speedResistanceZ'] as const;
export interface FlyingHandling {
 name:string;line:number;handlingId:number;
 values:Record<typeof FLYING_HANDLING_FIELDS[number],number>;
 /** Preserve any source-specific accepted spelling without hiding it. */
 sourceQuirks:string[];
}
const numeric=/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;
/** Native InitFromData writes 21 float32 fields directly; no car-unit conversion.
 * Its skipped character after wind handles the original RCRAIDER `0.1s` spelling.
 * Only that documented suffix is accepted here; arbitrary numeric prefixes are not. */
export function prepareFlyingHandling(row:HandlingSupplement):FlyingHandling{
 requireAsset(row.kind==='flying','Expected a flying handling supplement.');
 const [name,...tokens]=row.tokens,index=(NATIVE_FLYING_HANDLING_NAMES as readonly string[]).indexOf(name);
 requireAsset(index>=0,`Unknown native flying handling name: ${name}`);
 requireAsset(tokens.length===21,`Flying handling ${name}: expected 21 fields.`);
 const values={} as FlyingHandling['values'],sourceQuirks:string[]=[];
 for(const [i,field] of FLYING_HANDLING_FIELDS.entries()){
  let token=tokens[i];
  if(name==='RCRAIDER'&&field==='windMultiplier'&&token==='0.1s'){token='0.1';sourceQuirks.push('Original windMultiplier suffix: 0.1s');}
  requireAsset(numeric.test(token),`Flying handling ${name}: invalid ${field}.`);
  const value=Math.fround(Number(token));requireAsset(Number.isFinite(value),`Flying handling ${name}: nonfinite ${field}.`);values[field]=value;
 }
 return {name,line:row.line,handlingId:186+index,values,sourceQuirks};
}
export function indexFlyingHandling(rows:readonly HandlingSupplement[]){
 const result=new Map<string,FlyingHandling>();
 for(const row of rows){if(row.kind!=='flying')continue;const prepared=prepareFlyingHandling(row);requireAsset(!result.has(prepared.name),`Duplicate flying handling: ${prepared.name}`);result.set(prepared.name,prepared);}
 return result;
}
