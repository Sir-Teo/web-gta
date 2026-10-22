import RAPIER from '@dimforge/rapier3d-compat';
import {Quaternion,Vector3} from 'three';
import type {ColModel} from '../assets/col';

/** ProcessColModels tests spheres against spheres/boxes/triangles, then B's spheres against A's boxes/triangles.
 * TestCollision(false) skips suspension lines. Rapier capsules stand for the existing ped collision geometry. */
export interface ObjectQueryGeometry {
 radius:number;
 shapes:{shape:RAPIER.Shape;center:{x:number;y:number;z:number};sphere:boolean}[];
}
type Attachment={kind:'vehicle'|'ped'|'object';handle:number};
/** CObject::SpecialEntityPreCollisionStuff excludes its attachment, the reverse attachment, and siblings. */
export function objectAttachmentsIgnore(own:number,attachment:Attachment|undefined,other:number,otherAttachment:Attachment|undefined){
 return attachment?.kind==='object'&&attachment.handle===other||otherAttachment?.kind==='object'&&otherAttachment.handle===own||
  !!attachment&&!!otherAttachment&&attachment.kind===otherAttachment.kind&&attachment.handle===otherAttachment.handle;
}
export function objectQueryGeometry(col:ColModel):ObjectQueryGeometry{
 const shapes:ObjectQueryGeometry['shapes']=[];
 for(const s of col.spheres)shapes.push({shape:new RAPIER.Ball(s.radius),center:{x:s.center[0],y:s.center[2],z:-s.center[1]},sphere:true});
 for(const b of col.boxes)shapes.push({shape:new RAPIER.Cuboid((b.max[0]-b.min[0])/2,(b.max[2]-b.min[2])/2,(b.max[1]-b.min[1])/2),
  center:{x:(b.min[0]+b.max[0])/2,y:(b.min[2]+b.max[2])/2,z:-(b.min[1]+b.max[1])/2},sphere:false});
 if(col.mesh.indices.length){
  const vertices=new Float32Array(col.mesh.positions.length);
  for(let i=0;i<vertices.length;i+=3){vertices[i]=col.mesh.positions[i];vertices[i+1]=col.mesh.positions[i+2];vertices[i+2]=-col.mesh.positions[i+1];}
  shapes.push({shape:new RAPIER.TriMesh(vertices,col.mesh.indices),center:{x:0,y:0,z:0},sphere:false});
 }
 const extents=col.bounds.min.map((n,i)=>Math.max(Math.abs(n),Math.abs(col.bounds.max[i])));
 return {shapes,radius:Math.max(col.bounds.radius,Math.hypot(...extents))};
}
/** A current-pose shape query, independent of cached contact records and of the querying object's collision bit.
 * Gather candidates before shape tests so no nested physics query runs in a Rapier callback. */
export function objectIntersectsWorld(world:RAPIER.World,geometry:ObjectQueryGeometry,position:{x:number;y:number;z:number},rotation:RAPIER.Rotation,
 ignore:(candidate:RAPIER.Collider)=>boolean=()=>false){
 const near:RAPIER.Collider[]=[],r=geometry.radius;
 world.collidersWithAabbIntersectingAabb(position,{x:r,y:r,z:r},c=>{near.push(c);return true;});
 const q=new Quaternion(rotation.x,rotation.y,rotation.z,rotation.w);
 for(const c of near){
  if(!c.isEnabled()||c.isSensor()||ignore(c))continue;
  const sphereLike=c.shapeType()===RAPIER.ShapeType.Ball||c.shapeType()===RAPIER.ShapeType.Capsule;
  for(const s of geometry.shapes){
   if(!s.sphere&&!sphereLike)continue;
   const p=new Vector3(s.center.x,s.center.y,s.center.z).applyQuaternion(q).add(position);
   if(c.intersectsShape(s.shape,p,rotation))return true;
  }
 }
 return false;
}
