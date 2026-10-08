import * as THREE from 'three';
import {NativeImmediateTriangles} from './NativeImmediateTriangles';
/* CHeli::SearchLightCone's beam (iOS 0x100466ba8), which CTheScripts::RenderAllSearchLights draws for each script
 * searchlight: an RwIm3D triangle list from the 41 points round the bulb to the 41 where the cone meets the ground,
 * additive and unlit. Each bulb-end vertex is (200, 200, 255) at 0.1 + 0.15 of the beam brightness (a global, 1), times
 * how squarely the camera sees along it (the squared cosine between the camera and that edge from the origin, over the
 * most any edge has); the ground end is black, so the beam fades out along its length. The triangles run (near i,
 * ground i + 1, ground i) and, with a radius at the bulb, (near i, near i + 1, ground i + 1). Native in, renderer out. */
type V3={x:number;y:number;z:number};
export const SEARCHLIGHT_BRIGHTNESS=.1+.15*1;
const toRenderer=(p:V3)=>[p.x,p.z,-p.y];
/** One beam's triangles (renderer positions, RGBA bytes: the additive SRCALPHA, ONE blend at full alpha). */
export function searchlightBeam(origin:V3,near:readonly V3[],ground:readonly V3[],camera:V3){
 const n=Math.min(near.length,ground.length),positions:number[]=[],colors:number[]=[];
 if(n<2)return {positions,colors};
 const c=camera,toCam={x:c.x-origin.x,y:c.y-origin.y,z:c.z-origin.z},cl=Math.hypot(toCam.x,toCam.y,toCam.z)||1;
 const facing=near.map(p=>{const d={x:p.x-origin.x,y:p.y-origin.y,z:p.z-origin.z},l=Math.hypot(d.x,d.y,d.z);const u=l>0?d:{x:1,y:d.y,z:d.z},ul=l>0?l:Math.hypot(1,d.y,d.z);
  const k=Math.abs((u.x*toCam.x+u.y*toCam.y+u.z*toCam.z)/(ul*cl));return k*k;});
 const most=Math.max(...facing)||1;
 const rounded=near.some((p,i)=>i>0&&(p.x!==near[0].x||p.y!==near[0].y||p.z!==near[0].z));
 const vertex=(p:V3,lit:number)=>{positions.push(...toRenderer(p));const b=SEARCHLIGHT_BRIGHTNESS*lit;colors.push(Math.trunc(b*200),Math.trunc(b*200),Math.trunc(b*255),255);};
 for(let i=0;i<n-1;i++){
  const a=facing[i]/most,b=facing[i+1]/most;
  vertex(near[i],a);vertex(ground[i+1],0);vertex(ground[i],0);
  if(rounded){vertex(near[i],a);vertex(near[i+1],b);vertex(ground[i+1],0);}
 }
 return {positions,colors};
}
export class SearchlightBeams {
 private mesh:NativeImmediateTriangles;
 constructor(scene:THREE.Scene){this.mesh=new NativeImmediateTriangles(scene,8*40*6,'Native searchlight beams',6.25,false,true);}
 frame(beams:readonly {origin:V3;cone:{near:readonly V3[];ground:readonly V3[]}}[],camera:V3){
  const positions:number[]=[],colors:number[]=[];
  for(const beam of beams){const b=searchlightBeam(beam.origin,beam.cone.near,beam.cone.ground,camera);positions.push(...b.positions);colors.push(...b.colors);}
  this.mesh.frame({positions,colors});
 }
 get drawn(){return this.mesh.drawn;}
 dispose(){this.mesh.dispose();}
}
