import type RAPIER from '@dimforge/rapier3d-compat';
import type {Matrix4} from 'three';
import {placementMatrix} from '../assets/placement';
import {projectShadowReceiver,shadowFootprintBounds,type ShadowFootprint} from '../render/projectShadowReceiver';
import type {InstalledCollisionSource} from './nativeScene';

interface ReceiverBudget {candidates:number;triangles:number;vertices:number}
const defaults:ReceiverBudget={candidates:256,triangles:100000,vertices:65535};
/** Query after physics broad-phase synchronization. Returns only installed, fixed,
 * nonsensor COL meshes. Primitive/shadow-mesh policy is a separate rendering stage.
 * Budgets cover the entire query; overflow throws instead of returning partial shadows. */
export function nativeShadowReceivers(world:RAPIER.World,sources:ReadonlyMap<number,InstalledCollisionSource>,footprint:ShadowFootprint,limits:Partial<ReceiverBudget>={},uvProjection?:Matrix4){
 const budget={...defaults,...limits},bounds=shadowFootprintBounds(footprint);
 if(Object.values(budget).some(value=>!Number.isInteger(value)||value<0||value>1000000))throw new Error('Invalid shadow receiver budget.');
 const selected:{handle:number;source:InstalledCollisionSource}[]=[];
 let overflow=false;
 world.collidersWithAabbIntersectingAabb(bounds.center,bounds.halfExtents,collider=>{
  const source=sources.get(collider.handle);
  if(!source||source.source.kind!=='mesh'||collider.isSensor()||!collider.isEnabled()||!collider.parent()?.isFixed())return true;
  if(selected.length===budget.candidates){overflow=true;return false;}
  selected.push({handle:collider.handle,source});return true;
 });
 if(overflow)throw new Error('Shadow receiver candidate budget exceeded.');
 // Stable ordering makes combined uploads and diagnostics independent of broad-phase traversal.
 selected.sort((a,b)=>a.handle-b.handle);
 let triangles=0,vertices=0;
 const chunks:{handle:number;modelName:string;geometry:ReturnType<typeof projectShadowReceiver>}[]=[];
 for(const {handle,source} of selected){
  if(source.source.kind!=='mesh')continue;
  triangles+=source.source.mesh.indices.length/3;
  if(triangles>budget.triangles)throw new Error('Shadow receiver triangle budget exceeded.');
  const geometry=projectShadowReceiver(source.source.mesh,placementMatrix(source.placement),footprint,budget.vertices-vertices,uvProjection);
  vertices+=geometry.positions.length/3;
  if(geometry.positions.length)chunks.push({handle,modelName:source.modelName,geometry});
 }
 return {chunks,candidateCount:selected.length,triangleCount:triangles,vertexCount:vertices};
}
