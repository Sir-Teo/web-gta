import {requireAsset} from './binary';

export const HANDLING_FIELDS=['mass','turnMass','dragMultiplier','centerOfMassX','centerOfMassY','centerOfMassZ',
  'percentSubmerged','tractionMultiplier','tractionLoss','tractionBias','gears','maxVelocity','engineAcceleration','engineInertia',
  'driveType','engineType','brakeDeceleration','brakeBias','abs','steeringLock','suspensionForce','suspensionDamping',
  'suspensionHighSpeedCompression','suspensionUpperLimit','suspensionLowerLimit','suspensionBias','suspensionAntiDive',
  'seatOffset','collisionDamageMultiplier','monetaryValue','modelFlags','handlingFlags','frontLights','rearLights','animationGroup'] as const;
type Field=typeof HANDLING_FIELDS[number];
type NumericField=Exclude<Field,'driveType'|'engineType'>;
export interface HandlingRecord {
  name:string;line:number;
  /** Original file units and precision; no float/byte narrowing or physics conversion. */
  values:Record<NumericField,number>&{driveType:string;engineType:string};
  issues:string[];
}
export interface HandlingSupplement {
  kind:'bike'|'flying'|'boat'|'animation';line:number;tokens:string[];
}
const byteFields=new Set<Field>(['percentSubmerged','gears','abs','frontLights','rearLights','animationGroup']);
const floatToken=/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;
const kinds={'!':'bike','$':'flying','%':'boat','^':'animation'} as const;

/** Read the 35-field base vehicle records. Specialized rows remain explicit raw
 * supplements until their separate schemas and conversions are implemented. */
export function readHandling(text:string){
  requireAsset(text.length<=4*1024*1024,'Handling data exceeds the 4 MiB text limit.');
  const records:HandlingRecord[]=[],supplements:HandlingSupplement[]=[];
  for(const [index,raw] of text.replace(/^\uFEFF/,'').split(/\r?\n/).entries()){
    const line=raw.replace(/[\x01-\x20,]/g,' ').trim(),label=`Handling line ${index+1}`;
    if(line===';the end')break;
    if(!line||line.startsWith(';'))continue;
    requireAsset(!line.includes('\0'),`${label}: embedded NUL.`);
    if(Object.hasOwn(kinds,line[0])){
      const tokens=line.slice(1).trim().split(/\s+/);
      requireAsset(tokens[0].length>0,`${label}: empty specialized record.`);
      supplements.push({kind:kinds[line[0] as keyof typeof kinds],line:index+1,tokens});
    }else{
      const [name,...tokens]=line.split(/\s+/);
      requireAsset(name.length<=31,`${label}: handling name exceeds 31 characters.`);
      requireAsset(tokens.length===HANDLING_FIELDS.length,`${label}: expected 35 values after the name.`);
      const values={} as HandlingRecord['values'],issues:string[]=[];
      for(const [i,field] of HANDLING_FIELDS.entries()){
        const token=tokens[i];
        if(field==='driveType'||field==='engineType'){
          requireAsset(token.length===1,`${label}: ${field} must be one character.`);
          values[field]=token;continue;
        }
        if(field==='modelFlags'||field==='handlingFlags'){
          requireAsset(/^(?:0x)?[0-9a-f]{1,8}$/i.test(token),`${label}: invalid unsigned hexadecimal ${field}.`);
          values[field]=parseInt(token.replace(/^0x/i,''),16);continue;
        }
        const value=Number(token),integer=byteFields.has(field)||field==='monetaryValue';
        requireAsset(floatToken.test(token)&&Number.isFinite(value)&&Number.isFinite(Math.fround(value)),`${label}: invalid ${field}.`);
        requireAsset(!integer||(/^[+-]?\d+$/.test(token)&&value>=-2147483648&&value<=2147483647),`${label}: ${field} requires a signed 32-bit integer.`);
        values[field]=value;
        if(byteFields.has(field)&&(value<0||value>255))issues.push(`${field} requires native byte narrowing.`);
      }
      if(values.mass<=0)issues.push('Nonpositive mass has no supported physics conversion.');
      if(values.percentSubmerged===0)issues.push('Zero percent submerged has no finite native buoyancy conversion.');
      if(!['F','R','4'].includes(values.driveType))issues.push(`Unrecognized drive type ${values.driveType}.`);
      if(!['P','D','E'].includes(values.engineType))issues.push(`Unrecognized engine type ${values.engineType}.`);
      records.push({name,line:index+1,values,issues});
    }
    requireAsset(records.length+supplements.length<=50000,'Handling data exceeds the 50,000 record limit.');
  }
  return {records,supplements,warnings:supplements.length?[`${supplements.length} specialized handling rows preserved without interpretation.`]:[]};
}

/** Exact, case-sensitive names; duplicate raw rows remain available separately.
 * This does not emulate the native fixed-name table's prefix-matching lookup. */
export function indexHandling(records:readonly HandlingRecord[]){return new Map(records.map(record=>[record.name,record]));}
