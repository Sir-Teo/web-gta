import RAPIER from '@dimforge/rapier3d-compat';
import type {NativeCollisionSource} from './nativeCollision';
import type {ColModel} from '../assets/col';
import type {DffModel} from '../assets/dff';
const f=Math.fround,LIMIT=2500,MOVING=65;
const MISC=new Set([406,443,486,524,530,592]);
export function movingComponentSpec(model:number){
 switch(model){
  case 406:return {frame:'misc_a',factor:f(.0002),translation:false};
  case 443:return {frame:'misc_a',factor:f(-.0001),translation:false};
  case 486:return {frame:'misc_a',factor:f(.0002),translation:false};
  case 530:return {frame:'misc_a',factor:f(.0006),translation:true};
  case 592:return {frame:'misc_b',factor:f(.00015),translation:false};
 }
}
/** CAutomobile::UpdateMovingCollision (iOS 0x10043ddf8), including the signed clamp omitted by the reversed code.
 * The native four special-COL slots are not shared here: each supported vehicle already owns a collision copy. */
export class NativeMovingComponent {
 angle=0;previous=0;
 constructor(readonly model:number){}
 update(input:{angle:number;player:boolean;mission:boolean;pad:number;timeStep:number;playing?:boolean}){
  const misc=MISC.has(this.model),special=this.model===524||this.model===544;
  if(misc)this.previous=this.angle;
  if(input.player){if(input.playing===false)return false;}
  else if(!input.mission||input.angle<0||!misc&&this.model!==544)return false;
  this.previous=this.angle;
  if(input.angle>=0)this.angle=Math.trunc(f(f(input.angle)*LIMIT))&0xffff;
  else if(special){
   if(input.pad< -10)this.angle=Math.min(LIMIT,this.angle-Math.trunc(f(f(f(input.pad*20)*f(input.timeStep))/128)))&0xffff;
   else if(this.angle)this.angle=Math.max(0,this.angle-Math.trunc(f(f(f((input.pad+100)*10)*f(input.timeStep))/128)))&0xffff;
  }else{
   if(Math.abs(input.pad)<=10)return false;
   const multiplier=this.model===530&&input.pad<=0?20:10;
   const delta=Math.trunc(f(f(f(input.pad*multiplier)*f(input.timeStep))/128));
   this.angle=Math.max(0,Math.min(LIMIT,this.angle+delta));
  }
  return !special&&!!movingComponentSpec(this.model);
 }
 offset(hasFrame=true){
  if(!this.angle)return 0;
  const spec=movingComponentSpec(this.model);
  return spec&&(hasFrame||this.model===443||this.model===530)?f(this.angle*spec.factor):0;
 }
}
/** CAutomobile::PreRender's cement drum accumulator (iOS 0x10044a5d8): angle changes speed, not pose directly. */
export function stepCementDrum(phase:number,angle:number,timeStep:number){
 const rate=f(f(f(f(angle/LIMIT)+.5)*f(.02))*f(timeStep));return f(f(phase)+rate);
}
/** Original COL transformed afresh, never from the previous pose; only surface 65 moves. */
export function movingComponentCollision(original:ColModel,model:number,offset:number,pivot:readonly number[]):ColModel{
 const out=structuredClone(original),translation=model===530,c=f(Math.cos(offset)),s=f(Math.sin(offset));
 const transform=(x:number,y:number,z:number):[number,number,number]=>{
  if(translation)return [x,y,f(z+offset)];
  const dy=f(y-pivot[1]),dz=f(z-pivot[2]);
  return [x,f(f(f(dy*c)-f(dz*s))+pivot[1]),f(f(f(dy*s)+f(dz*c))+pivot[2])];
 };
 let minZ=1000,maxZ=-1000;
 const bounds=(z:number,r=0)=>{if(maxZ<z+r)maxZ=z+r;else if(minZ>z-r)minZ=z-r;};
 for(let t=0;t<out.mesh.materials.length;t++)if(out.mesh.materials[t]===MOVING){
  for(let v=0;v<3;v++){
   const i=out.mesh.indices[t*3+v]*3,p=transform(original.mesh.positions[i],original.mesh.positions[i+1],original.mesh.positions[i+2]);
   out.mesh.positions.set(p,i);bounds(p[2]);
  }
 }
 out.spheres.forEach((sphere,i)=>{if(sphere.surface.material!==MOVING)return;const p=original.spheres[i].center;sphere.center=transform(...p);bounds(sphere.center[2],sphere.radius);});
 out.bounds.min[2]=Math.min(original.bounds.min[2],minZ);out.bounds.max[2]=Math.max(original.bounds.max[2],maxZ);
 return out;
}
/** RwFrameGetMatrix(component)->pos, in the native parent frame, rather than its accumulated world position. */
export function movingComponentPivot(model:DffModel,frame:string):[number,number,number]|undefined{
 const matrix=model.frames.find(f=>f.name.toLowerCase()===frame)?.matrix;
 return matrix?[matrix[12],matrix[13],matrix[14]]:undefined;
}

/** Update the instance's existing shapes and metadata; preserve collider handles, groups, and body mass. */
export function applyMovingCollisionShapes(world:RAPIER.World,sources:ReadonlyMap<number,NativeCollisionSource>,collision:ColModel){
 for(const [handle,source] of sources){
  const collider=world.getCollider(handle);if(!collider)continue;
  if(source.kind==='sphere'&&source.surface.material===MOVING){const p=collision.spheres[source.index].center;collider.setTranslationWrtParent({x:p[0],y:p[2],z:-p[1]});}
  else if(source.kind==='mesh'){
   source.mesh.positions.set(collision.mesh.positions);const vertices=new Float32Array(source.mesh.positions.length);
   for(let i=0;i<vertices.length;i+=3){vertices[i]=source.mesh.positions[i];vertices[i+1]=source.mesh.positions[i+2];vertices[i+2]=-source.mesh.positions[i+1];}
   collider.setShape(new RAPIER.TriMesh(vertices,source.mesh.indices));
  }
 }
}
