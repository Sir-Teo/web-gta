import {requireAsset} from './binary';
import {readPlayerFiles} from './readPlayerFiles';
import {readIfp} from './ifp';
import {normalPlayerMovement} from './normalPlayerMovement';
import type {CharacterSource} from '../render/NativeCharacter';
export interface LocalPlayerFiles {body:File[];animations:File}
/** Assemble the acquired classic Normal CJ and native movement roles locally. */
export async function readLocalPlayerCharacter(files:LocalPlayerFiles):Promise<CharacterSource>{
 requireAsset(files.animations.size>0&&files.animations.size<=64*1024*1024,'Player animations exceed the 64 MiB limit or are empty.');
 const body=await readPlayerFiles(files.body,'normal','classic');
 const movement=normalPlayerMovement(readIfp(new Uint8Array(await files.animations.arrayBuffer())));
 const {walk,...roles}=movement;
 return {model:body.model,textures:body.textures,playerBody:true,convention:'san-andreas-ped',clip:walk.clip,track:walk.track!,...roles};
}
