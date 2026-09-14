import {requireAsset} from '../assets/binary';
import type {PlantPoint} from './nativePlantTriangle';
import type {NativeProcRule} from './nativeProcRules';
const f=Math.fround;
const mix=(a:number,b:number,t:number)=>f(f(f(b)*f(t))+f(f(a)*f(1-f(t))));
const cross=(a:PlantPoint,b:PlantPoint):PlantPoint=>[f(f(a[1]*b[2])-f(a[2]*b[1])),f(f(a[2]*b[0])-f(a[0]*b[2])),f(f(a[0]*b[1])-f(a[1]*b[0]))];
const normalized=(v:PlantPoint):PlantPoint=>{
 const dot=f(f(f(v[0]*v[0])+f(v[1]*v[1]))+f(v[2]*v[2]));
 if(dot<=0)return [1,v[1],v[2]];
 const reciprocal=f(1/f(Math.sqrt(dot)));return v.map(n=>f(n*reciprocal)) as [number,number,number];
};

/** ProcSurfaceInfo::AddObject transform stage after successful allocation.
 * Samples are XY scale, Z scale, rotation and offset, in native call order.
 * Keep entity/collision and render matrices separate: native visual scaling
 * happens after the entity has been inserted into the world. */
export function nativeProcTransform(rule:NativeProcRule,position:PlantPoint,normal:PlantPoint,minimumZ:number,kind:'building'|'object',samples:readonly [number,number,number,number]){
 requireAsset([position,normal].every(p=>p.length===3&&p.every(n=>Number.isFinite(n)&&Math.abs(n)<=1e7))&&Number.isFinite(minimumZ)&&Math.abs(minimumZ)<=1e7,'Invalid procedural transform geometry.');
 requireAsset(samples.length===4&&samples.every(n=>Number.isFinite(n)&&n>=0&&n<=1),'Procedural transform requires four samples in [0,1].');
 requireAsset(kind==='building'||kind==='object','Invalid procedural entity kind.');
 const xy=mix(rule.minimumScaleXY,rule.maximumScaleXY,samples[0]),z=mix(rule.minimumScaleZ,rule.maximumScaleZ,samples[1]),rotation=mix(rule.minimumRotation,rule.maximumRotation,samples[2]),offset=mix(rule.minimumOffsetZ,rule.maximumOffsetZ,samples[3]);
 requireAsset([xy,z,rotation,offset].every(Number.isFinite),'Invalid procedural transform ranges.');
 const n=normal.map(f) as [number,number,number],p=position.map(f) as [number,number,number];
 const c=f(Math.cos(rotation)),s=f(Math.sin(rotation)),allocatedMatrix=rule.align&&n[2]<f(.95),height=f(offset-f(minimumZ));
 let right:PlantPoint=[c,s,0],forward:PlantPoint=[-s,c,0],up:PlantPoint=[0,0,1];
 if(allocatedMatrix){
  forward=normalized(cross(n,right));right=normalized(cross(forward,n));up=n;
  for(let i=0;i<3;i++)p[i]=f(p[i]+f(n[i]*height));
 }else p[2]=f(p[2]+height);
 const entityMatrix=new Float32Array([...right,0,...forward,0,...up,0,...p,1]),renderMatrix=entityMatrix.slice();
 const scaleApplied=kind==='object'&&xy!==1&&z!==1;
 if(scaleApplied){
  for(let column=0;column<3;column++)for(let row=0;row<3;row++)renderMatrix[column*4+row]=f(renderMatrix[column*4+row]*(column===2?z:xy));
  renderMatrix[14]=f(renderMatrix[14]-f(f(f(minimumZ)*z)-f(minimumZ)));
 }
 requireAsset(entityMatrix.every(Number.isFinite)&&renderMatrix.every(Number.isFinite),'Procedural transform exceeds float32 limits.');
 return {entityMatrix,renderMatrix,allocatedMatrix,scaleApplied,xyScale:xy,zScale:z,rotation,offset};
}
