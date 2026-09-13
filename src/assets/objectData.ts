import {requireAsset} from './binary';

export const OBJECT_DATA_FIELDS=['model','mass','turnMass','airResistance','elasticity','percentSubmerged','uprootLimit','collisionDamageMultiplier',
  'collisionDamageEffect','specialCollisionResponse','cameraAvoid','causesExplosion','fxType','fxOffsetX','fxOffsetY','fxOffsetZ','effectName',
  'smashMultiplier','breakVelocityX','breakVelocityY','breakVelocityZ','breakVelocityRandom','gunBreakMode','sparksOnImpact'] as const;
type NumericField=Exclude<typeof OBJECT_DATA_FIELDS[number],'model'|'effectName'>;
export interface ObjectDataRecord {
  model:string;line:number;fieldCount:number;
  /** Raw input units. Optional fields remain absent; byte narrowing and physics conversion are not applied. */
  values:Partial<Record<NumericField,number>>;
  effectName?:string;
  issues:string[];
}
const integerColumns=new Set([8,9,10,11,12,22,23]);
const numberToken=/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

/** Object definitions select the native IPL building/dummy branch independently of mass and IDE section. */
export function readObjectData(text:string):ObjectDataRecord[] {
  requireAsset(text.length<=4*1024*1024,'Object data exceeds the 4 MiB text limit.');
  const records:ObjectDataRecord[]=[];
  for(const [index,raw] of text.replace(/^\uFEFF/,'').split(/\r?\n/).entries()){
    const line=raw.replace(/[\x01-\x20,]/g,' ').trim();
    if(!line||line[0]===';'||line[0]==='#')continue;
    if(line[0]==='*')break;
    const fields=line.split(/\s+/),label=`Object data line ${index+1}`;
    requireAsset(fields.length>=13&&fields.length<=24,`${label}: expected 13 to 24 fields.`);
    requireAsset(fields[0].length<=255&&!fields[0].includes('\0'),`${label}: invalid model name.`);
    const record:ObjectDataRecord={model:fields[0],line:index+1,fieldCount:fields.length,values:{},issues:[]};
    for(let i=1;i<fields.length;i++){
      const token=fields[i],field=OBJECT_DATA_FIELDS[i];
      if(field==='effectName'){
        requireAsset(token.length<=255&&!token.includes('\0'),`${label}: invalid effect name.`);record.effectName=token;continue;
      }
      const value=Number(token),integer=integerColumns.has(i);
      requireAsset(numberToken.test(token)&&Number.isFinite(value)&&Number.isFinite(Math.fround(value)),`${label}: invalid ${field}.`);
      requireAsset(!integer||(/^[+-]?\d+$/.test(token)&&value>=-2147483648&&value<=2147483647),`${label}: ${field} requires a signed 32-bit integer.`);
      record.values[field as NumericField]=value;
    }
    if(record.values.fxType!>0&&record.effectName===undefined)record.issues.push('Enabled effects require a complete offset and effect name before effect simulation.');
    if(record.values.percentSubmerged===0)record.issues.push('Zero percent submerged has no finite native buoyancy conversion.');
    records.push(record);requireAsset(records.length<=50000,'Object data exceeds the 50,000 record limit.');
  }
  return records;
}

/** Preserve native last-definition lookup order without throwing away the raw records. */
export function indexObjectData(records:readonly ObjectDataRecord[]) {
  return new Map(records.map(record=>[record.model.toLowerCase(),record]));
}
export function placedEntityKind(model:string,definitions:ReadonlyMap<string,ObjectDataRecord>|undefined):'building'|'dummy'|'unknown' {
  return definitions===undefined?'unknown':definitions.has(model.toLowerCase())?'dummy':'building';
}
