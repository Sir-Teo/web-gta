import RAPIER from '@dimforge/rapier3d-compat';
import {Quaternion,Vector3} from 'three';
import {pedSphereHit,type PedHitSphere} from '../combat/nativePedHitSpheres';
import {bulletLine,type BulletLineOptions} from './bulletLine';

type V={x:number;y:number;z:number};
export interface SkinnedPedBulletTarget {
 collider:RAPIER.Collider;body:RAPIER.RigidBody;
 bounds():{center:V;rotation:{x:number;y:number;z:number;w:number}}|undefined;
 hitSpheres():readonly PedHitSphere[];
}
export type PedBulletIntersection=RAPIER.RayColliderIntersection&{pedPiece?:number};
export type NpcBulletLine=(from:V,direction:V,range:number,excludeBody:RAPIER.RigidBody)=>PedBulletIntersection|null|undefined;
/** Impact notifications/surface FX now, ped blood after the caller applies its damage result. */
export type NpcBulletImpact=(hit:PedBulletIntersection,point:V,weapon:number,direction:V)=>((accepted:boolean)=>void)|undefined;
/** AnimatePedColModelSkinned (PC 0x4C6F70) centers its box on BONE_SPINE1, with 1.2 units on every local axis.
 * ProcessLineOfSight tests that box before its spheres. The bound sphere is not a gate in that routine. */
export function pedBulletBoxHit(from:V,direction:V,range:number,bounds:NonNullable<ReturnType<SkinnedPedBulletTarget['bounds']>>){
 const q=bounds.rotation,inverse=new Quaternion(-q.x,-q.y,-q.z,q.w),center=bounds.center;
 const origin=new Vector3(from.x-center.x,from.y-center.y,from.z-center.z).applyQuaternion(inverse),along=new Vector3(direction.x,direction.y,direction.z).applyQuaternion(inverse),half=Math.fround(1.2);
 let near=0,far=range;
 for(const axis of ['x','y','z'] as const){
  if(along[axis]===0){if(Math.abs(origin[axis])>half)return false;continue;}
  const a=(-half-origin[axis])/along[axis],b=(half-origin[axis])/along[axis];near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));if(near>far)return false;
 }
 return true;
}
/** CWorld's animated ped collision alongside the physical world. Replace eligible movement capsules only for this
 * bullet trace, then choose the closest native body piece before any opaque world surface. */
export function skinnedPedBulletLine(world:RAPIER.World,from:V,direction:V,range:number,o:BulletLineOptions,targets:Iterable<SkinnedPedBulletTarget>):PedBulletIntersection|null|undefined{
 const peds=[...targets].filter(p=>p.body.isEnabled()&&p.collider.isEnabled()&&!p.collider.isSensor()&&p.collider.handle!==o.excludeCollider?.handle&&p.body.handle!==o.excludeBody?.handle&&(!o.filter||o.filter(p.collider))),handles=new Set(peds.map(p=>p.collider.handle));
 let nearest:PedBulletIntersection|null|undefined=bulletLine(world,from,direction,range,{...o,filter:c=>!handles.has(c.handle)&&(!o.filter||o.filter(c))});
 for(const ped of peds){
  const limit=nearest?.timeOfImpact??range,bounds=ped.bounds();if(!bounds||!pedBulletBoxHit(from,direction,limit,bounds))continue;
  const hit=pedSphereHit(from,direction,limit,ped.hitSpheres());if(!hit)continue;
  nearest={collider:ped.collider,timeOfImpact:hit.t,normal:hit.normal,featureType:RAPIER.FeatureType.Face,featureId:0,pedPiece:hit.piece};
 }
 return nearest;
}
