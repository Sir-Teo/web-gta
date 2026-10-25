import {raySphere,type V3} from '../vehicle/nativeDieInCar';
/** CPedModelInfo::m_pColNodeInfos (PC 0x8A6308), captured from ARM64 0x10064afc8 (12 records, stride 32).
 * AnimatePedColModelSkinned transforms each local center by its current skeleton bone. */
export const PED_HIT_NODES:readonly {bone:number;piece:number;x:number;radius:number}[]=[
 {bone:5,piece:9,x:.05,radius:.15},
 {bone:3,piece:3,x:.2,radius:.2},{bone:3,piece:3,x:0,radius:.2},{bone:2,piece:4,x:-.1,radius:.2},
 {bone:32,piece:5,x:.06,radius:.14},{bone:22,piece:6,x:.06,radius:.14},
 {bone:33,piece:5,x:.05,radius:.14},{bone:23,piece:6,x:.05,radius:.14},
 {bone:42,piece:7,x:-.1,radius:.18},{bone:52,piece:8,x:-.1,radius:.18},
 {bone:43,piece:7,x:-.18,radius:.16},{bone:53,piece:8,x:-.18,radius:.16},
].map(n=>({...n,x:Math.fround(n.x),radius:Math.fround(n.radius)}));
export interface PedHitSphere {center:V3;radius:number;piece:number}
/** The nearest native body piece along a normalized bullet line, bounded by the first world collision. */
export function pedSphereHit(origin:V3,direction:V3,range:number,spheres:readonly PedHitSphere[]){
 let best:{t:number;piece:number;normal:V3}|undefined;
 for(const sphere of spheres){
  // CCollision::ProcessLineSphere ignores a line starting inside/on the sphere (PC 0x412AA0).
  if((origin.x-sphere.center.x)**2+(origin.y-sphere.center.y)**2+(origin.z-sphere.center.z)**2<=sphere.radius**2)continue;
  const t=raySphere(origin,direction,sphere.center,sphere.radius);
  if(t===undefined||t>=range||best&&t>=best.t)continue;
  const x=origin.x+direction.x*t-sphere.center.x,y=origin.y+direction.y*t-sphere.center.y,z=origin.z+direction.z*t-sphere.center.z,length=Math.hypot(x,y,z)||1;
  best={t,piece:sphere.piece,normal:{x:x/length,y:y/length,z:z/length}};
 }
 return best;
}
