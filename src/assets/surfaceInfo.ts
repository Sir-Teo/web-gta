import {requireAsset} from './binary';

export const ADHESION_GROUPS=['RUBBER','HARD','ROAD','LOOSE','SAND','WET'] as const;
export const SURFACE_INTEGER_FIELDS=['softLand','seeThrough','shootThrough','sand','water','shallowWater','beach',
  'steepSlope','glass','stairs','skateable','pavement','roughness','flame','sparks','sprint','footsteps','footDust',
  'carDirt','carClean','wheelGrass','wheelGravel','wheelMud','wheelDust','wheelSand','wheelSpray','procPlant','procObj','climbable'] as const;
export interface SurfaceInfoRecord {
  name:string;line:number;adhesionGroup:string;tyreGrip:number;wetGrip:number;
  skidMark:string;frictionEffect:string;bulletFx:string;
  /** File values, before native boolean/bitfield conversion. */
  values:Record<typeof SURFACE_INTEGER_FIELDS[number],number>;
  issues:string[];
}
const floatToken=/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

/** Read SURFINFO.DAT's 36 columns without guessing surface IDs or applying the
 * native grip-byte conversion. SURFACE.DAT is a separate adhesion matrix. */
export function readSurfaceInfo(text:string){
  requireAsset(text.length<=4*1024*1024,'Surface info exceeds the 4 MiB text limit.');
  const records:SurfaceInfoRecord[]=[];
  for(const [index,raw] of text.replace(/^\uFEFF/,'').split(/\r?\n/).entries()){
    const line=raw.replace(/[\x01-\x20,]/g,' ').trim(),label=`Surface info line ${index+1}`;
    if(!line||line.startsWith('#'))continue;
    requireAsset(!line.includes('\0'),`${label}: embedded NUL.`);
    // Native sscanf consumes 36 fields and ignores trailing labels/comments.
    const tokens=line.split(/\s+/);
    requireAsset(tokens.length>=36,`${label}: expected at least 36 columns.`);
    const [name,adhesionGroup,tyreToken,wetToken,skidMark,frictionEffect]=tokens,bulletFx=tokens[35];
    requireAsset(name.length<=63,`${label}: surface name exceeds 63 characters.`);
    for(const token of [adhesionGroup,skidMark,frictionEffect,bulletFx])requireAsset(token.length<=31,`${label}: category exceeds 31 characters.`);
    const numeric=(token:string)=>{
      const value=Number(token);
      requireAsset(floatToken.test(token)&&Number.isFinite(value)&&Number.isFinite(Math.fround(value)),`${label}: invalid grip.`);
      return value;
    };
    const tyreGrip=numeric(tyreToken),wetGrip=numeric(wetToken),values={} as SurfaceInfoRecord['values'],issues:string[]=[];
    for(const [i,field] of SURFACE_INTEGER_FIELDS.entries()){
      const token=tokens[i+6],value=Number(token);
      requireAsset(/^[+-]?\d+$/.test(token)&&value>=-2147483648&&value<=2147483647,`${label}: ${field} requires a signed 32-bit integer.`);
      values[field]=value;
      if(field==='roughness'||field==='flame'){
        if(value<0||value>3)issues.push(`${field} requires native two-bit narrowing.`);
      }else if(value!==0&&value!==1)issues.push(`${field} requires native boolean conversion.`);
    }
    for(const [field,value,known] of [
      ['adhesionGroup',adhesionGroup,ADHESION_GROUPS],['skidMark',skidMark,['DEFAULT','SANDY','MUDDY']],
      ['frictionEffect',frictionEffect,['NONE','SPARKS']],['bulletFx',bulletFx,['NONE','SPARKS','SAND','WOOD','DUST']],
    ] as const)if(!(known as readonly string[]).includes(value))issues.push(`Unrecognized ${field} ${value}.`);
    records.push({name,line:index+1,adhesionGroup,tyreGrip,wetGrip,skidMark,frictionEffect,bulletFx,values,issues});
    requireAsset(records.length<=50000,'Surface info exceeds the 50,000 record limit.');
  }
  return {records};
}

/** Exact names only. Native fixed-name lookup and unknown-name fallback are not emulated. */
export function indexSurfaceInfo(records:readonly SurfaceInfoRecord[]){return new Map(records.map(record=>[record.name,record]));}
