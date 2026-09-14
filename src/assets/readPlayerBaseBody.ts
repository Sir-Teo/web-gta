import {readDff} from './dff';
import {assemblePlayerBody,PLAYER_BODY_PARTS,type PlayerBodyPart} from './assemblePlayerBody';
import {decodeNamedTextures} from './modelTextures';
import {requireAsset} from './binary';
import {composePlayerTexture} from './composePlayerTexture';

export const PLAYER_BASE_FILES=['player.dff',...PLAYER_BODY_PARTS.map(name=>`${name}.dff`),
 'player_torso.txd','player_face.txd','player_legs.txd','player_feet.txd'] as const;
export const PLAYER_CLASSIC_FILES=[...PLAYER_BASE_FILES,'vest.dff','vest.txd','jeans.dff','jeansdenim.txd','sneaker.dff','sneakerbincblk.txd'] as const;
export type PlayerBodyVariant='normal'|'fat'|'ripped';
/** Read discrete native body variants with acquired vest, jeans and sneaker options.
 * Continuous stat blending and other clothing slots remain separate steps. */
export function readPlayerBaseBody(files:ReadonlyMap<string,Uint8Array>,variant:PlayerBodyVariant='normal',outfit:'bare'|'vest'|'classic'='bare'){
 const clump={normal:2,fat:1,ripped:0}[variant];
 requireAsset(clump!==undefined,'Unknown player body variant.');
 requireAsset(['bare','vest','classic'].includes(outfit),'Unknown player outfit.');
 const bytes=(name:string)=>{const data=files.get(name);requireAsset(data,`Missing player base file: ${name}.`);return data;};
 const parts=Object.fromEntries(PLAYER_BODY_PARTS.map(name=>[name,readDff(bytes(`${name}.dff`),clump)])) as Record<PlayerBodyPart,ReturnType<typeof readDff>>;
 if(outfit!=='bare')parts.torso=readDff(bytes('vest.dff'),clump);
 if(outfit==='classic'){parts.legs=readDff(bytes('jeans.dff'),clump);parts.feet=readDff(bytes('sneaker.dff'),clump);}
 const suffix=variant==='normal'?'':`_${variant}`;
 const bindings={torso:`torso${suffix}`,head:'face',hands:`torso${suffix}`,legs:`legs${suffix}`,feet:'foot'};
 const model=assemblePlayerBody(readDff(bytes('player.dff')),parts,bindings);
 const slots=[['player_torso.txd',bindings.torso],['player_face.txd',bindings.head],
  ['player_legs.txd',bindings.legs],['player_feet.txd',bindings.feet]];
 const textures=slots.flatMap(([dictionary,raster])=>{
  const decoded=decodeNamedTextures([raster],bytes(dictionary));
  requireAsset(decoded.length===1,`${dictionary} requires base raster ${raster}.`);
  return decoded;
 });
 const garments: [number,string,string][]=[];
 if(outfit!=='bare')garments.push([0,'vest.txd','vest']);
 if(outfit==='classic')garments.push([2,'jeansdenim.txd','legs'],[3,'sneakerbincblk.txd','sneakerbincblk']);
 for(const [slot,dictionary,raster] of garments){
  const layers=decodeNamedTextures([raster],bytes(dictionary));
  requireAsset(layers.length===1,`${dictionary} requires garment raster ${raster}.`);
  textures[slot]=composePlayerTexture(textures[slot],layers);
 }
 return {model,textures,variant};
}
