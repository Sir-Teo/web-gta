import {readDff,type DffModel} from './dff';
import {decodeNamedTextures} from './modelTextures';
import {requireAsset} from './binary';
import type {NativePlantCover} from '../world/nativeVegetation';

export const NATIVE_GRASS_FILES=Array.from({length:2},(_,table)=>Array.from({length:4},(_,i)=>`grass${table}_${i+1}.dff`)).flat();
const textureNames=['gras07Si',...Array.from({length:2},(_,table)=>Array.from({length:4},(_,i)=>`txgrass${table}_${i}`)).flat()];

/** Decode the dedicated native grass package; embedded DFF material names are
 * replaced by PlantMgr, so ordinary model texture lookup is inappropriate. */
export function readNativeGrassAssets(files:ReadonlyMap<string,Uint8Array>){
 const bytes=(name:string)=>{
  const data=files.get(name);requireAsset(!!data&&data.byteLength>0&&data.byteLength<=16*1024*1024,`Missing or oversized native grass resource: ${name}`);return data;
 };
 const textures=decodeNamedTextures(textureNames,bytes('plant1.txd'),undefined,['plant1.txd']).map(texture=>({...texture,filter:2,addressU:1,addressV:1}));
 requireAsset(textures.length===textureNames.length,'Native grass texture dictionary is incomplete.');
 const models=NATIVE_GRASS_FILES.map(name=>{
  const source=readDff(bytes(name)),atomic=source.atomics[0];requireAsset(!!atomic,`Grass model has no atomic: ${name}`);
  const geometry=source.geometries[atomic.geometry];
  requireAsset(!geometry.skin&&geometry.uvs.length>0,`Unsupported grass geometry: ${name}`);
  const colors=new Uint8Array(geometry.positions.length/3*4);colors.fill(255);
  const model:DffModel={frames:[{name:'grass',parent:-1,matrix:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]}],atomics:[{...atomic,frame:0,geometry:0}],geometries:[{
   ...geometry,flags:((geometry.flags|8)&0xffffff8f)|64,colors,
   materials:geometry.materials.map(material=>({...material,color:[0,0,0,50],texture:'gras07Si',mask:'',filter:2,addressU:1,addressV:1})),
  }],warnings:[...source.warnings]};
  return {name,source,model};
 });
 return {models,textures};
}
export type NativeGrassAssets=ReturnType<typeof readNativeGrassAssets>;

/** Follows the inspected PC loader's table-zero assignment for all four slots.
 * That assignment remains a reference-source behavior, not proven retail parity.
 * Color must already contain collision lighting, intensity and distance fade. */
export function bindNativeGrassCover(assets:NativeGrassAssets,slot:number,cover:Pick<NativePlantCover,'model'|'texture'>,color:readonly [number,number,number,number]){
 requireAsset(Number.isInteger(slot)&&slot>=0&&slot<4&&Number.isInteger(cover.model)&&cover.model>=0&&cover.model<4&&Number.isInteger(cover.texture)&&cover.texture>=0&&cover.texture<4,'Invalid native grass cover binding.');
 requireAsset(color.length===4&&color.every(n=>Number.isInteger(n)&&n>=0&&n<=255),'Invalid native grass draw color.');
 const texture=assets.textures.find(texture=>texture.name.toLowerCase()===`txgrass${slot%2}_${cover.texture}`);
 requireAsset(!!texture,'Missing native grass cover texture.');
 const prepared=assets.models[cover.model];requireAsset(!!prepared,'Missing native grass cover model.');
 const model:DffModel={...prepared.model,geometries:prepared.model.geometries.map(geometry=>({...geometry,materials:geometry.materials.map(material=>({...material,color:[...color],texture:texture.name}))}))};
 return {model,textures:[texture],sourceModel:prepared.name};
}
