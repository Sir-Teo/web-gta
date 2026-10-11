import {BufferAttribute,BufferGeometry,Line,LineBasicMaterial,type Scene} from 'three';
import type {Vec3} from '../core/math';
import {ROPE_QUARRY_CRANE_ARM,ROPE_SEGMENTS} from '../simulation/nativeRope';
/* CRope::Render (0x556800, reversed): the rope as a line through its 32 nodes, black at half alpha with the depth
 * written, for a rope whose top is within 120 of the camera across (the caller's choice of ropes); the quarry crane's
 * also a line from its top to the cab at (709.32, 916.20, 53). Three's frustum culling stands in for the original's
 * IsSphereVisible on the middle node. */
const QUARRY_CAB={x:709.32,y:916.2,z:53};
export class NativeRopes {
 private readonly lines:Line<BufferGeometry,LineBasicMaterial>[]=[];
 private readonly material=new LineBasicMaterial({color:0,transparent:true,opacity:128/255});
 constructor(private readonly scene:Scene){}
 /** The ropes to draw this frame, their nodes native. */
 update(ropes:readonly {type:number;segments:readonly Vec3[]}[]){
  let used=0;
  const draw=(points:readonly Vec3[])=>{
   let line=this.lines[used];
   if(!line||line.geometry.getAttribute('position').count!==points.length){
    if(line){this.scene.remove(line);line.geometry.dispose();}
    line=new Line(new BufferGeometry().setAttribute('position',new BufferAttribute(new Float32Array(points.length*3),3)),this.material);
    line.frustumCulled=true;this.lines[used]=line;this.scene.add(line);
   }
   const position=line.geometry.getAttribute('position') as BufferAttribute;
   for(let i=0;i<points.length;i++)position.setXYZ(i,points[i].x,points[i].z,-points[i].y);
   position.needsUpdate=true;line.geometry.computeBoundingSphere();line.visible=true;used++;
  };
  for(const rope of ropes){
   draw(rope.segments.length===ROPE_SEGMENTS?rope.segments:rope.segments.slice(0,ROPE_SEGMENTS));
   if(rope.type===ROPE_QUARRY_CRANE_ARM)draw([rope.segments[0],QUARRY_CAB]);
  }
  for(let i=used;i<this.lines.length;i++)this.lines[i].visible=false;
 }
 dispose(){for(const line of this.lines){this.scene.remove(line);line.geometry.dispose();}this.lines.length=0;this.material.dispose();}
}
