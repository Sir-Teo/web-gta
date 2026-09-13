import {Vector3} from 'three';
import type {Vec3} from '../core/math';
const f=Math.fround;
/** CColTrianglePlane's reverse cross product and signed 1/4096 unit-vector
 * storage. Calculate in source coordinates before transforming the normal. */
export function nativeColNormal(a:Vec3,b:Vec3,c:Vec3,target=new Vector3()){
 const bx=f(b.x-a.x),by=f(b.y-a.y),bz=f(b.z-a.z),cx=f(c.x-a.x),cy=f(c.y-a.y),cz=f(c.z-a.z);
 let x=f(f(cy*bz)-f(cz*by)),y=f(f(cz*bx)-f(cx*bz)),z=f(f(cx*by)-f(cy*bx));
 const squared=f(f(f(x*x)+f(y*y))+f(z*z));
 if(squared<=0)x=1;
 else{const reciprocal=f(1/f(Math.sqrt(squared)));x=f(x*reciprocal);y=f(y*reciprocal);z=f(z*reciprocal);}
 return target.set(Math.trunc(f(x*4096))/4096,Math.trunc(f(y*4096))/4096,Math.trunc(f(z*4096))/4096);
}
