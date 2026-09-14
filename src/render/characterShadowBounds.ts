import {Sphere,Vector3} from 'three';
import type {DffModel,ModelMorphBounds} from '../assets/dff';
/** Stable capture candidate from native morph bounds. Assembled player parts
 * share one atomic frame; unrelated multi-frame clumps need a separate policy. */
export function characterShadowBounds(model:DffModel,playerBody:boolean):ModelMorphBounds|undefined{
 const atomics=model.atomics.filter(a=>a.flags&4);
 if(!atomics.length||atomics.length>1&&(!playerBody||atomics.some(a=>a.frame!==atomics[0].frame)))return;
 const combined=new Sphere();combined.makeEmpty();
 for(const atomic of atomics){
  const bound=model.geometries[atomic.geometry]?.morphBounds?.[0];
  if(!bound||!Number.isFinite(bound.radius)||bound.radius<=0||!bound.center.every(Number.isFinite))return;
  combined.union(new Sphere(new Vector3(...bound.center),bound.radius));
 }
 return {center:combined.center.toArray() as [number,number,number],radius:combined.radius};
}
