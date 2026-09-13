import {requireAsset} from './binary';
import {ADHESION_GROUPS,type SurfaceInfoRecord} from './surfaceInfo';

export interface AdhesionRow {label:string;line:number;cells:(number|string)[]}
const numeric=/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;
/** SURFACE.DAT is positional: labels do not identify/reorder adhesion groups.
 * Preserve placeholders and absent cells; do not invent symmetric entries. */
export function readSurfaceAdhesion(text:string){
  requireAsset(text.length<=64*1024,'Surface adhesion exceeds the 64 KiB text limit.');
  const rows:AdhesionRow[]=[];
  for(const [index,raw] of text.replace(/^\uFEFF/,'').split(/\r?\n/).entries()){
    const line=raw.replace(/[\x01-\x20,]/g,' ').trim(),context=`Surface adhesion line ${index+1}`;
    if(!line||line.startsWith(';'))continue;
    requireAsset(!line.includes('\0'),`${context}: embedded NUL.`);
    const [label,...tokens]=line.split(/\s+/);
    requireAsset(label.length<=63&&tokens.length<=6,`${context}: invalid label or more than six cells.`);
    const cells=tokens.map(token=>{
      requireAsset(token.length<=63,`${context}: cell token exceeds 63 characters.`);
      if(!numeric.test(token))return token;
      const value=Number(token);requireAsset(Number.isFinite(value)&&Number.isFinite(Math.fround(value)),`${context}: nonfinite coefficient.`);
      return value;
    });
    rows.push({label,line:index+1,cells});
    requireAsset(rows.length<=6,'Surface adhesion exceeds six group rows.');
  }
  return {rows};
}

/** Resolve only explicitly numeric [road group][contact group] entries. The
 * native loader's symmetry/placeholder behavior remains unverified. */
export function surfaceAdhesiveLimit(rows:readonly AdhesionRow[],surfaceA:SurfaceInfoRecord,surfaceB:SurfaceInfoRecord):number{
  requireAsset(rows.length===6,'Adhesion lookup requires all six positional group rows.');
  const group=(surface:SurfaceInfoRecord)=>{
    const id=(ADHESION_GROUPS as readonly string[]).indexOf(surface.adhesionGroup);
    requireAsset(id>=0,`Unknown adhesion group ${surface.adhesionGroup}.`);return id;
  };
  const cell=rows[group(surfaceB)]?.cells[group(surfaceA)];
  requireAsset(typeof cell==='number'&&Number.isFinite(cell)&&cell>=0&&Number.isFinite(Math.fround(cell)),'Adhesion pair has no supported explicit coefficient.');
  return Math.fround(cell);
}
