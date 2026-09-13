import type {Material} from 'three';
import {nativeAlphaReference} from './nativeAlphaReference';
/** CPed::Render's player alpha reference, with the ordinary world depth policy.
 * Applies to the locally controlled native ped, not generic imported previews. */
export function nativePlayerMaterial(material:Material){
 material.depthWrite=true;
 nativeAlphaReference(material,1);
}
