import {BufferAttribute,BufferGeometry,DoubleSide,DynamicDrawUsage,Mesh,MeshBasicMaterial,Quaternion,Vector3,type Scene} from 'three';
import {WAKE} from '../simulation/nativeBuoyancy';
import type {WorldBoat} from '../simulation/WorldBoat';
/** CBoat::RenderWakePoints over CWaterLevel::RenderWakeSegment (reversed): the
 * stern trail renders as striped ribbon sub-quads with source width/alpha
 * formulas and wind ripple. The waterwake texture and debug-tunable part
 * colors are not local, so the ribbon uses plain foam-white vertex alpha
 * (authored); the 0th-point zero alpha and the stripe multipliers are
 * preserved as written. Native trail x/y (east/north) maps to browser x/-z. */
export const WAKE_PARTS=4;
export const WAKE_ALPHA_MULTS=[.4,1,.2,1,.4];
/** 0x6EDAF7 width: hull half-beam grown by trail age and recorded speed. */
export function wakeWidth(boundsMaxX:number,counter:number,speed:number){
 const maxWidth=boundsMaxX*.65;
 const t=(WAKE.lifetime-counter)*((speed/25+.5)/WAKE.lifetime);
 return maxWidth+maxWidth*t;
}
/** 0x6EDC6B alpha: fades along the trail, scaled by speed and camera distance. */
export function wakeAlpha(index:number,count:number,speed:number,camDist:number){
 let alpha=(1-index/count)*160;
 if(index<3)alpha*=index/3;
 alpha*=speed/100+.15;
 if(camDist>50)alpha*=(80-camDist)/30;
 return Math.max(0,alpha);
}
/** Stern wake ribbons for driven hulls. */
export class BoatWakes {
 readonly mesh:Mesh<BufferGeometry,MeshBasicMaterial>;
 private positions=new Float32Array(32*(WAKE_PARTS*6)*3);
 private colors=new Float32Array(32*(WAKE_PARTS*6)*4);
 private disposed=false;
 constructor(private scene:Scene){
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new BufferAttribute(this.positions,3).setUsage(DynamicDrawUsage));
  geometry.setAttribute('color',new BufferAttribute(this.colors,4).setUsage(DynamicDrawUsage));
  geometry.setDrawRange(0,0);
  this.mesh=new Mesh(geometry,new MeshBasicMaterial({color:0xffffff,transparent:true,depthWrite:false,side:DoubleSide,vertexColors:true,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
  this.mesh.name='BoatWakes';this.mesh.frustumCulled=false;this.mesh.renderOrder=8500;this.mesh.visible=false;
  scene.add(this.mesh);
 }
 /** Rebuild the ribbon from live trails. */
 update(boats:Iterable<WorldBoat>,input:{waterLevel:(x:number,y:number)=>number|undefined;camera:{x:number;z:number};windClipped:number;elapsedMs:number}){
  if(this.disposed)return;
  let vertex=0;
  const push=(x:number,y:number,z:number,a:number)=>{this.positions.set([x,y,z],vertex*3);this.colors.set([1,1,1,Math.max(0,Math.min(1,a/255))],vertex*4);vertex++;};
  const angle=(Math.floor(input.elapsedMs)%4096)/(4096/(Math.PI*2)),windRadius=input.windClipped*.4+.2;
  for(const boat of boats){
   const trail=boat.wake,n=trail.coords.length;
   if(n<=1)continue;
   const p=boat.body.translation(),camDist=Math.hypot(p.x-input.camera.x,p.z-input.camera.z);
   const q=boat.body.rotation(),fwd=new Vector3(0,0,-1).applyQuaternion(new Quaternion(q.x,q.y,q.z,q.w));
   const level=input.waterLevel(p.x,-p.z),surface=(level===undefined?p.y:level)+.05;
   // RenderWakeSegment's CalcAngleOfPos: the fractional part (p - floor p) of (native x + 3072) / 32 and of
   // (native y + 3072) / 32; the renderer's z is native -y.
   const frac=(p:number)=>{const v=(p+3072)/32;return v-Math.floor(v);};
   const ripple=(x:number,z:number)=>surface+Math.sin((frac(x)+frac(-z))*Math.PI*2+angle)*windRadius;
   let prevWidth=wakeWidth(boat.assets.collision!.bounds.max[0],trail.counters[0],trail.speeds[0]);
   let prevAlpha=wakeAlpha(0,n,trail.speeds[0],camDist);
   let dirX=fwd.x,dirZ=fwd.z;
   for(let i=1;i<n&&vertex+(WAKE_PARTS*6)<=this.positions.length/3;i++){
    const curr=trail.coords[i],prev=trail.coords[i-1];
    // Browser-space trail direction (trail y is native north).
    let dx=prev.x-curr.x,dz=-(prev.y-curr.y);
    const distSq=dx*dx+dz*dz;
    if(distSq>=9){const d=Math.sqrt(distSq);dx/=d;dz/=d;}
    const currAlpha=wakeAlpha(i,n,trail.speeds[i],camDist);
    const currWidth=wakeWidth(boat.assets.collision!.bounds.max[0],trail.counters[i],trail.speeds[i]);
    if(distSq<=169){
     const prevAx=prev.x+dirZ*prevWidth,prevAz=-prev.y-dirX*prevWidth;
     const prevBx=prev.x-dirZ*prevWidth,prevBz=-prev.y+dirX*prevWidth;
     const currBx=curr.x-dz*currWidth,currBz=-curr.y+dx*currWidth;
     const currAx=curr.x+dz*currWidth,currAz=-curr.y-dx*currWidth;
     for(let part=0;part<WAKE_PARTS;part++){
      const t0=part/WAKE_PARTS,t1=(part+1)/WAKE_PARTS;
      const ax=prevBx+(prevAx-prevBx)*t0,az=prevBz+(prevAz-prevBz)*t0;
      const bx=prevBx+(prevAx-prevBx)*t1,bz=prevBz+(prevAz-prevBz)*t1;
      const cx=currBx+(currAx-currBx)*t1,cz=currBz+(currAz-currBz)*t1;
      const ex=currBx+(currAx-currBx)*t0,ez=currBz+(currAz-currBz)*t0;
      const aa=prevAlpha*WAKE_ALPHA_MULTS[part],ab=prevAlpha*WAKE_ALPHA_MULTS[part+1];
      const ac=currAlpha*WAKE_ALPHA_MULTS[part+1],ad=currAlpha*WAKE_ALPHA_MULTS[part];
      push(ax,ripple(ax,az),az,aa);push(bx,ripple(bx,bz),bz,ab);push(cx,ripple(cx,cz),cz,ac);
      push(ax,ripple(ax,az),az,aa);push(cx,ripple(cx,cz),cz,ac);push(ex,ripple(ex,ez),ez,ad);
     }
    }
    prevWidth=currWidth;prevAlpha=currAlpha;dirX=dx;dirZ=dz;
   }
  }
  const geometry=this.mesh.geometry;
  (geometry.getAttribute('position') as BufferAttribute).needsUpdate=true;
  (geometry.getAttribute('color') as BufferAttribute).needsUpdate=true;
  geometry.setDrawRange(0,vertex);
  this.mesh.visible=vertex>0;
 }
 snapshot(){return {vertices:this.mesh.geometry.drawRange.count};}
 dispose(){if(this.disposed)return;this.disposed=true;this.scene.remove(this.mesh);this.mesh.geometry.dispose();(this.mesh.material as MeshBasicMaterial).dispose();}
}
