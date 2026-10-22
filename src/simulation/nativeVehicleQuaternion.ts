import {quaternionFromRows} from '../engine/ScmObjects';
import {requireAsset} from '../assets/binary';
type V={x:number;y:number;z:number};
export type NativeVehicleBasis={right:V;forward:V;up:V};
const f=Math.fround;
/** CQuaternion::Get(RwMatrix*), iOS 0x1002cb070: no quaternion normalization, all operations in float32. */
export function nativeQuaternionBasis(q:{x:number;y:number;z:number;w:number}):NativeVehicleBasis{
 const x=f(q.x),y=f(q.y),z=f(q.z),w=f(q.w),x2=f(x+x),y2=f(y+y),z2=f(z+z);
 const xx=f(x*x2),xy=f(x*y2),xz=f(x*z2),yy=f(y*y2),yz=f(y*z2),zz=f(z*z2),xw=f(x2*w),yw=f(y2*w),zw=f(w*z2);
 return {right:{x:f(1-f(yy+zz)),y:f(xy+zw),z:f(xz-yw)},forward:{x:f(xy-zw),y:f(1-f(xx+zz)),z:f(xw+yz)},up:{x:f(xz+yw),y:f(yz-xw),z:f(1-f(xx+yy))}};
}
const cross=(a:V,b:V):V=>({x:f(f(a.y*b.z)-f(a.z*b.y)),y:f(f(a.z*b.x)-f(a.x*b.z)),z:f(f(a.x*b.y)-f(a.y*b.x))});
const normalise=(v:V):V=>{
 const d=f(f(f(v.x*v.x)+f(v.y*v.y))+f(v.z*v.z));if(d<=0)return {...v,x:1};
 const reciprocal=f(1/f(Math.sqrt(d)));return {x:f(v.x*reciprocal),y:f(v.y*reciprocal),z:f(v.z*reciprocal)};
};
/** CMatrix::Reorthogonalise, PC 0x59B6A0: derive up from right x forward, right from forward x up, then forward. */
export function reorthogonaliseVehicleBasis(basis:NativeVehicleBasis):NativeVehicleBasis{
 const up=normalise(cross(basis.right,basis.forward)),right=normalise(cross(basis.forward,up));
 return {right,forward:cross(up,right),up};
}
/** Rapier needs a rigid rotation. Use the native physical-process result, then convert native axes to renderer axes. */
export function vehicleQuaternionRotation(basis:NativeVehicleBasis){
 const b=reorthogonaliseVehicleBasis(basis),q=quaternionFromRows(b.right,b.forward,b.up),length=Math.hypot(q.x,q.y,q.z,q.w);
 requireAsset(Number.isFinite(length)&&length>0,'Invalid vehicle quaternion matrix.');
 return {x:q.x/length,y:q.z/length,z:-q.y/length,w:q.w/length};
}
