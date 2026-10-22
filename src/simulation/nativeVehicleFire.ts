import type {Vec3} from '../core/math';
/** CWorld::ExtinguishAllCarFiresInArea (iOS 0x10027652c): float32 native XYZ distance, strictly inside the sphere.
 * Inputs use renderer axes, so the native horizontal Y term is renderer Z and the vertical term is renderer Y. */
export function vehicleInsideFireSphere(position:Vec3,center:Vec3,radius:number){
 const f=Math.fround,dx=f(f(center.x)-f(position.x)),dz=f(f(center.z)-f(position.z)),dy=f(f(center.y)-f(position.y));
 return f(f(f(dx*dx)+f(dz*dz))+f(dy*dy))<f(f(radius)*f(radius));
}
