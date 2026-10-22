/** CPhysical::DettachEntityFromEntity, normal collision-force flags (iOS 0x1002526a0).
 * Script angles become +X/-Z radians; speed is a native per-frame push. */
export interface DetachVector{x:number;y:number;z:number}
export interface DetachBasis{right:DetachVector;forward:DetachVector;up:DetachVector}
const f=Math.fround;
const transform=(m:DetachBasis,v:DetachVector):DetachVector=>{
 const axis=(key:keyof DetachVector)=>f(f(f(f(m.right[key])*f(v.x))+f(f(m.forward[key])*f(v.y)))+f(f(m.up[key])*f(v.z)));
 return{x:axis('x'),y:axis('y'),z:axis('z')};
};
export function objectDetachMotion(parent:DetachBasis,velocity:DetachVector,angles:{x:number;y:number;speed:number},turn:{apply:boolean;basis:DetachBasis;centre:DetachVector;mass:number;speed:DetachVector}){
 const x=f(f(f(angles.x)*f(Math.PI))/180),y=f(f(f(angles.y)*f(-Math.PI))/180),sx=f(Math.sin(x)),cx=f(Math.cos(x)),sy=f(Math.sin(y)),cy=f(Math.cos(y));
 const forward=transform(parent,{x:f(-sy),y:f(cy*cx),z:f(cy*sx)}),speed=f(angles.speed),force={x:f(forward.x*speed),y:f(forward.y*speed),z:f(forward.z*speed)};
 const move={x:f(f(velocity.x)+force.x),y:f(f(velocity.y)+force.y),z:f(f(velocity.z)+force.z)};
 let rotation={x:f(turn.speed.x),y:f(turn.speed.y),z:f(turn.speed.z)};
 if(turn.apply){
  const com=transform(turn.basis,turn.centre),point={x:f(f(force.x*.5)-com.x),y:f(f(force.y*.5)-com.y),z:f(f(force.z*.5)-com.z)},inverse=f(1/f(turn.mass));
  const cross={x:f(f(point.y*force.z)-f(point.z*force.y)),y:f(f(point.z*force.x)-f(point.x*force.z)),z:f(f(point.x*force.y)-f(point.y*force.x))};
  rotation={x:f(f(cross.x*inverse)+rotation.x),y:f(f(cross.y*inverse)+rotation.y),z:f(f(cross.z*inverse)+rotation.z)};
 }
 return{velocity:move,turnSpeed:rotation};
}
