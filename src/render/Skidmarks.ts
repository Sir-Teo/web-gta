import {BufferAttribute,BufferGeometry,DoubleSide,DynamicDrawUsage,Mesh,ShaderMaterial,Vector3,type Scene} from 'three';
import {NATIVE_CAR_WHEELS} from '../simulation/nativeDriveContacts';
import type {WorldCar} from '../simulation/WorldCar';
/** Authored skidmark approximation (AddSingleWheelParticles in CAutomobile::PreRender
 * is not reversed): spinning or skidding wheels on DEFAULT-skidmark surfaces lay
 * fading quads; emission rate, width, opacity and lifetime are authored. */
export const SKID={max:600,fadeMs:40000,stepM:.35,halfWidth:.14,startAlpha:.5,minSpeed:3} as const;
const WHEEL_DUMMY:Record<string,string>={frontLeft:'wheel_lf_dummy',rearLeft:'wheel_lb_dummy',frontRight:'wheel_rf_dummy',rearRight:'wheel_rb_dummy'};
/** Native emission conditions that are observable in the browser. */
export function skidEmitting(states:readonly string[],skidMark:string|undefined,speed:number,contacts:number){
 return skidMark==='DEFAULT'&&contacts>0&&speed>SKID.minSpeed&&states.some(s=>s==='spinning'||s==='skidding');
}
interface V3 {x:number;y:number;z:number}
interface Mark {ax:number;ay:number;az:number;bx:number;by:number;bz:number;cx:number;cy:number;cz:number;dx:number;dy:number;dz:number;born:number}
/** Fading dark quads trailing skidding wheels. */
export class Skidmarks {
 readonly mesh:Mesh<BufferGeometry,ShaderMaterial>;
 private marks:Mark[]=[];
 private last=new Map<number,Map<string,V3>>();
 private positions=new Float32Array(SKID.max*18);
 private alphas=new Float32Array(SKID.max*6);
 private disposed=false;
 constructor(private scene:Scene){
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new BufferAttribute(this.positions,3).setUsage(DynamicDrawUsage));
  geometry.setAttribute('aAlpha',new BufferAttribute(this.alphas,1).setUsage(DynamicDrawUsage));
  geometry.setDrawRange(0,0);
  const material=new ShaderMaterial({
   vertexShader:`attribute float aAlpha;varying float vAlpha;void main(){vAlpha=aAlpha;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
   fragmentShader:`varying float vAlpha;void main(){gl_FragColor=vec4(0.02,0.02,0.02,vAlpha);}`,
   transparent:true,depthWrite:false,side:DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,
  });
  this.mesh=new Mesh(geometry,material);this.mesh.name='Skidmarks';this.mesh.frustumCulled=false;this.mesh.renderOrder=9000;this.mesh.visible=false;
  scene.add(this.mesh);
 }
 private push(a:V3,b:V3,c:V3,d:V3,now:number){
  if(this.marks.length>=SKID.max)this.marks.shift();
  this.marks.push({ax:a.x,ay:a.y,az:a.z,bx:b.x,by:b.y,bz:b.z,cx:c.x,cy:c.y,cz:c.z,dx:d.x,dy:d.y,dz:d.z,born:now});
 }
 /** Lay trail segments for one car; `surfaces` resolves a COL material to its SURFINFO SKIDMARK class. */
 lay(car:WorldCar,now:number,surfaces:{skidMark(material:number):string|undefined},ground:(x:number,z:number,fromY:number)=>number|undefined){
  if(this.disposed)return;
  const v=car.car.body.linvel(),speed=Math.hypot(v.x,v.z);
  if(!skidEmitting(car.audio.states,surfaces.skidMark(car.audio.contactSurface),speed,car.audio.contactWheels)){this.last.delete(car.car.body.handle);return;}
  car.car.root.updateWorldMatrix(true,true);
  let slots=this.last.get(car.car.body.handle);
  if(!slots){slots=new Map();this.last.set(car.car.body.handle,slots);}
  NATIVE_CAR_WHEELS.forEach((wheel,i)=>{
   if(car.audio.states[i]!=='spinning'&&car.audio.states[i]!=='skidding'){slots!.delete(wheel);return;}
   const dummy=car.car.root.getObjectByName(WHEEL_DUMMY[wheel]);if(!dummy)return;
   const at=dummy.getWorldPosition(new Vector3()),gy=ground(at.x,at.z,at.y+.3);
   if(gy===undefined){slots!.delete(wheel);return;}
   const cur={x:at.x,y:gy+.02,z:at.z},prev=slots!.get(wheel);
   slots!.set(wheel,cur);
   if(!prev)return;
   const dx=cur.x-prev.x,dz=cur.z-prev.z,len=Math.hypot(dx,dz);
   if(len<SKID.stepM)return;
   const nx=-dz/len*SKID.halfWidth,nz=dx/len*SKID.halfWidth;
   this.push({x:prev.x-nx,y:prev.y,z:prev.z-nz},{x:prev.x+nx,y:prev.y,z:prev.z+nz},{x:cur.x+nx,y:cur.y,z:cur.z+nz},{x:cur.x-nx,y:cur.y,z:cur.z-nz},now);
  });
 }
 /** Fade old marks and rewrite the vertex buffers. */
 frame(now:number){
  if(this.disposed)return;
  this.marks=this.marks.filter(m=>now-m.born<SKID.fadeMs);
  for(const [handle,slots] of this.last)if(!slots.size)this.last.delete(handle);
  const n=this.marks.length;
  for(let i=0;i<n;i++){
   const m=this.marks[i],o=i*18,alpha=SKID.startAlpha*(1-(now-m.born)/SKID.fadeMs);
   this.positions.set([m.ax,m.ay,m.az,m.bx,m.by,m.bz,m.cx,m.cy,m.cz,m.ax,m.ay,m.az,m.cx,m.cy,m.cz,m.dx,m.dy,m.dz],o);
   this.alphas.fill(alpha,i*6,i*6+6);
  }
  const geometry=this.mesh.geometry;
  (geometry.getAttribute('position') as BufferAttribute).needsUpdate=true;
  (geometry.getAttribute('aAlpha') as BufferAttribute).needsUpdate=true;
  geometry.setDrawRange(0,n*6);
  this.mesh.visible=n>0;
 }
 snapshot(){return {marks:this.marks.length};}
 dispose(){
  if(this.disposed)return;this.disposed=true;
  this.scene.remove(this.mesh);this.mesh.geometry.dispose();this.mesh.material.dispose();this.marks=[];this.last.clear();
 }
}
