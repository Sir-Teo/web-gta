import {readDff} from './dff';
import {assemblePlayerBody,PLAYER_BODY_PARTS,type PlayerBodyPart} from './assemblePlayerBody';
import {decodeNamedTextures} from './modelTextures';
import {requireAsset} from './binary';

export const PLAYER_BASE_FILES=['player.dff',...PLAYER_BODY_PARTS.map(name=>`${name}.dff`),
 'player_torso.txd','player_face.txd','player_legs.txd','player_feet.txd'] as const;
export type PlayerBodyVariant='normal'|'fat'|'ripped';
/** Read discrete native body variants. Clothing layers and continuous stat blending
 * are separate steps; similarly named legacy TXDs are not substitutes. */
export function readPlayerBaseBody(files:ReadonlyMap<string,Uint8Array>,variant:PlayerBodyVariant='normal'){
 const clump={normal:2,fat:1,ripped:0}[variant];
 requireAsset(clump!==undefined,'Unknown player body variant.');
 const bytes=(name:string)=>{const data=files.get(name);requireAsset(data,`Missing player base file: ${name}.`);return data;};
 const parts=Object.fromEntries(PLAYER_BODY_PARTS.map(name=>[name,readDff(bytes(`${name}.dff`),clump)])) as Record<PlayerBodyPart,ReturnType<typeof readDff>>;
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
 return {model,textures,variant};
}
