import {readDff} from './dff';
import {assemblePlayerBody,PLAYER_BODY_PARTS,type PlayerBodyPart} from './assemblePlayerBody';
import {decodeNamedTextures} from './modelTextures';
import {requireAsset} from './binary';
import {composePlayerTexture} from './composePlayerTexture';
import {blendPlayerGeometry,blendPlayerTextures,type PlayerBodyRatios} from './blendPlayerBody';

export const PLAYER_BASE_FILES=['player.dff',...PLAYER_BODY_PARTS.map(name=>`${name}.dff`),
 'player_torso.txd','player_face.txd','player_legs.txd','player_feet.txd'] as const;
export const PLAYER_CLASSIC_FILES=[...PLAYER_BASE_FILES,'vest.dff','vest.txd','jeans.dff','jeansdenim.txd','sneaker.dff','sneakerbincblk.txd'] as const;
export type PlayerBodyVariant='normal'|'fat'|'ripped';
/** Read native body variants with acquired vest, jeans and sneaker options: one of the three bodies whole, or the
 * three blended by CClothesBuilder's ratios (`blendPlayerBody.ts`), skin textures and all. Other clothing slots remain
 * a separate step. */
export function readPlayerBaseBody(files:ReadonlyMap<string,Uint8Array>,variant:PlayerBodyVariant|PlayerBodyRatios='normal',outfit:'bare'|'vest'|'classic'='bare'){
 const ratios=typeof variant==='object'?variant:undefined;
 requireAsset(!ratios||[ratios.normal,ratios.fat,ratios.ripped].every(r=>Number.isFinite(r)&&r>=0&&r<=1),'Invalid player body ratios.');
 const clump=ratios?2:{normal:2,fat:1,ripped:0}[variant as PlayerBodyVariant];
 requireAsset(clump!==undefined,'Unknown player body variant.');
 requireAsset(['bare','vest','classic'].includes(outfit),'Unknown player outfit.');
 const bytes=(name:string)=>{const data=files.get(name);requireAsset(data,`Missing player base file: ${name}.`);return data;};
 // ConstructGeometryArray: each clothing model's three clumps (ripped, fat, normal in the file) blended into the normal.
 const read=(name:string)=>{
  const model=readDff(bytes(name),clump);if(!ratios)return model;
  const body=(m:ReturnType<typeof readDff>)=>m.geometries[m.atomics[0].geometry];
  requireAsset(model.atomics.length===1,`Player ${name} requires one atomic a body.`);
  const [fat,ripped]=[1,0].map(c=>body(readDff(bytes(name),c)));
  model.geometries[model.atomics[0].geometry]=blendPlayerGeometry(body(model),fat,ripped,ratios);
  return model;
 };
 const parts=Object.fromEntries(PLAYER_BODY_PARTS.map(name=>[name,read(`${name}.dff`)])) as Record<PlayerBodyPart,ReturnType<typeof readDff>>;
 if(outfit!=='bare')parts.torso=read('vest.dff');
 if(outfit==='classic'){parts.legs=read('jeans.dff');parts.feet=read('sneaker.dff');}
 const suffix=ratios||variant==='normal'?'':`_${variant}`;
 const bindings={torso:`torso${suffix}`,head:'face',hands:`torso${suffix}`,legs:`legs${suffix}`,feet:'foot'};
 const model=assemblePlayerBody(readDff(bytes('player.dff')),parts,bindings);
 if(!ratios)model.warnings.push('One body whole: stat blending is not applied.');
 const slots=[['player_torso.txd',bindings.torso],['player_face.txd',bindings.head],
  ['player_legs.txd',bindings.legs],['player_feet.txd',bindings.feet]];
 const textures=slots.flatMap(([dictionary,raster])=>{
  // ConstructTextures: the torso's and the legs' skins blended from their _fat and _ripped rasters by the same ratios.
  const blend=ratios&&(raster==='torso'||raster==='legs');
  const names=blend?[raster,`${raster}_fat`,`${raster}_ripped`]:[raster];
  const decoded=decodeNamedTextures(names,bytes(dictionary));
  requireAsset(decoded.length===names.length,`${dictionary} requires base raster ${names.join(', ')}.`);
  if(!blend)return decoded;
  const by=(name:string)=>decoded.find(t=>t.name.toLowerCase()===name)!;
  return [blendPlayerTextures(by(raster),by(`${raster}_fat`),by(`${raster}_ripped`),ratios)];
 });
 const garments: [number,string,string][]=[];
 if(outfit!=='bare')garments.push([0,'vest.txd','vest']);
 if(outfit==='classic')garments.push([2,'jeansdenim.txd','legs'],[3,'sneakerbincblk.txd','sneakerbincblk']);
 for(const [slot,dictionary,raster] of garments){
  const layers=decodeNamedTextures([raster],bytes(dictionary));
  requireAsset(layers.length===1,`${dictionary} requires garment raster ${raster}.`);
  textures[slot]=composePlayerTexture(textures[slot],layers);
 }
 return {model,textures,variant,playerBody:true as const};
}
