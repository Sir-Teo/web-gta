import {MeshBasicMaterial,type Texture} from 'three';
/** PlantMgr grass state: blend source alpha, depth-test without depth writes,
 * no alpha cutoff. Native textures use the existing raw color-space convention. */
export function nativeGrassMaterial(map:Texture){
 return new MeshBasicMaterial({map,transparent:true,depthWrite:false,depthTest:true,alphaTest:0,fog:true,toneMapped:false});
}
