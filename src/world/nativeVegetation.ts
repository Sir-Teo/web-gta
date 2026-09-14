import {requireAsset} from '../assets/binary';
import {nativeSurfaceId} from '../assets/surfaceIds';
import type {readPlants} from '../assets/vegetation';
import type {SurfaceInfoRecord} from '../assets/surfaceInfo';

export interface NativePlantCover {
 model:number;texture:number;color:[number,number,number,number];intensity:number;intensityVariation:number;
 scaleXY:number;scaleZ:number;scaleVariationXY:number;scaleVariationZ:number;windBend:number;windVariation:number;density:number;
}
export interface NativePlantSurface {slot:number;covers:[NativePlantCover,NativePlantCover,NativePlantCover];}
const defaultCover=():NativePlantCover=>({model:65535,texture:0,color:[255,255,255,255],intensity:255,intensityVariation:0,scaleXY:1,scaleZ:1,scaleVariationXY:0,scaleVariationZ:0,windBend:0,windVariation:0,density:0});

/** PlantSurfPropMgr initialization. Input is the validated raw table. Native
 * byte/word casts, cover normalization and last-row assignment stay explicit. */
export function initializeNativePlants(records:ReturnType<typeof readPlants>){
 const surfaces=new Map<number,NativePlantSurface>();
 for(const record of records){
  const id=nativeSurfaceId(record.surface),v=record.values;
  requireAsset(id>0&&id<178,`Unknown or unsupported plant surface: ${record.surface}.`);
  let surface=surfaces.get(id);
  if(!surface){requireAsset(surfaces.size<57,'Native plant surface pool exceeds 57 entries.');surface={slot:0,covers:[defaultCover(),defaultCover(),defaultCover()]};surfaces.set(id,surface);}
  const coverWord=v.cover&65535,cover=coverWord>2?0:coverWord;
  const slot=v.slot&65535,model=v.model&65535,texture=v.texture&65535;
  // Native code indexes fixed PC model/texture tables without checking. Reject
  // unsupported indices here instead of reproducing an out-of-bounds access.
  requireAsset(slot<4&&(model<4||model===65535)&&texture<4,'Plant indices exceed the PC model/texture tables.');
  requireAsset(v.density>=0,'Plant density must be nonnegative.');
  surface.slot=slot;
  surface.covers[cover]={model,texture,color:[v.red&255,v.green&255,v.blue&255,v.alpha&255],intensity:v.intensity&255,intensityVariation:v.intensityVariation&255,
   scaleXY:Math.fround(v.scaleXY),scaleZ:Math.fround(v.scaleZ),scaleVariationXY:Math.fround(v.scaleVariationXY),scaleVariationZ:Math.fround(v.scaleVariationZ),windBend:Math.fround(v.windBend),windVariation:Math.fround(v.windVariation),density:Math.fround(v.density)};
 }
 return surfaces;
}

/** SURFINFO flags gate the two systems independently; a missing row enables neither. */
export function nativeVegetationEligibility(surface:number,info:ReadonlyMap<number,SurfaceInfoRecord>){
 const row=info.get(surface);
 return {plants:!!row?.values.procPlant,objects:!!row?.values.procObj};
}

/** PlantLocTri::Add casts area*density to uint16. PlantMgr::Render then uses
 * (count+8)&0xfff8, including an extra group when count is already divisible by 8.
 * This does not allocate triangles, seeds or generated instances. */
export function nativePlantCounts(area:number,surface:NativePlantSurface){
 requireAsset(Number.isFinite(area)&&area>=0&&Number.isFinite(Math.fround(area)),'Invalid plant triangle area.');
 const maximum=surface.covers.map(cover=>{
  const value=Math.trunc(Math.fround(Math.fround(area)*cover.density));
  requireAsset(value>=0&&value<=65535,'Plant triangle population exceeds uint16 range.');return value;
 }) as [number,number,number];
 const active=maximum.some(value=>value>0);
 return {maximum,draw:surface.covers.map((cover,i)=>active&&cover.model!==65535?(maximum[i]+8)&0xfff8:0) as [number,number,number]};
}
