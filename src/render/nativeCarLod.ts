import type {Object3D} from 'three';
import type {DffModel} from '../assets/dff';
import {requireAsset} from '../assets/binary';
import type {CarWheel} from '../simulation/nativeDriveContacts';
const f=(n:number)=>{const value=Math.fround(n);requireAsset(Number.isFinite(value),'Nonfinite vehicle LOD input.');return value;};
/** SetRenderWareCamera / VehicleVisibilityCB / ordinary vehicle callbacks.
 * Distances are squared; the caller supplies distance from the native clump root. */
export function nativeCarLod(distanceSquared:number,generationMultiplier:number){
 const distance=f(distanceSquared),multiplier=f(generationMultiplier);requireAsset(distance>=0&&multiplier>=0,'Negative vehicle LOD input.');
 const near=f(multiplier*70),far=f(multiplier*150),highLimit=f(f(near*near)*2),visibleLimit=f(f(far*far)*2);
 return {detail:distance>visibleLimit?'culled':distance<highLimit?'high':'low',highLimit,visibleLimit} as const;
}
/** Bind only atomic meshes, never frame groups: hiding a chassis frame would also
 * hide nested components. Native wheel callbacks bypass the body detail threshold.
 * Initially choose high detail until the scene supplies its camera distance. */
/** `wheels`: a car's four wheel dummies, or a bike's (its front and rear wheel frames), which every detail keeps. */
export function bindNativeCarLod(root:Object3D,model:DffModel,wheels:Record<CarWheel,number>|readonly number[]){
 const wheelFrames=new Set(Array.isArray(wheels)?wheels:Object.values(wheels));
 requireAsset((Array.isArray(wheels)?wheelFrames.size>0:wheelFrames.size===4)&&[...wheelFrames].every(i=>Number.isInteger(i)&&i>=0&&i<model.frames.length),'Invalid vehicle LOD wheel frames.');
 const meshes=new Map<number,Object3D[]>();root.traverse(node=>{const index=node.userData.nativeAtomic;if(index!==undefined){const group=meshes.get(index)??[];group.push(node);meshes.set(index,group);}});
 const targets:{node:Object3D;role:'wheel'|'high'|'low'}[]=[];
 model.atomics.forEach((atomic,index)=>{
  if(!(atomic.flags&4))return;
  const matches=meshes.get(index)??[];
  requireAsset(matches.length===1,'Expected one rendered mesh per native car atomic.');
  targets.push({node:matches[0],role:wheelFrames.has(atomic.frame)?'wheel':model.frames[atomic.frame].name.includes('_vlo')?'low':'high'});
 });
 const apply=(detail:'high'|'low'|'culled')=>{for(const {node,role} of targets)node.visible=detail!=='culled'&&(role==='wheel'||role===detail);};
 apply('high');
 return {update(distanceSquared:number,generationMultiplier:number){const result=nativeCarLod(distanceSquared,generationMultiplier);apply(result.detail);return result;}};
}
