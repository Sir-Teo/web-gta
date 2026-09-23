import {Vector3} from 'three';
type V3={x:number;y:number;z:number};
/** CVehicle::IsSphereTouchingVehicle: the point, in the vehicle's own (native) axes, inside the collision bounding box
 * grown by the radius. `point` is in the browser frame (y up); the body's local frame maps to native as (x, -z, y). */
export function sphereTouchingVehicle(body:{translation():V3;rotation():{x:number;y:number;z:number;w:number}},bounds:{min:readonly number[];max:readonly number[]},point:V3,radius:number){
 const p=body.translation(),q=body.rotation();
 const local=new Vector3(point.x-p.x,point.y-p.y,point.z-p.z).applyQuaternion({x:-q.x,y:-q.y,z:-q.z,w:q.w} as never);
 const n=[local.x,-local.z,local.y];
 return n.every((v,i)=>v>bounds.min[i]-radius&&v<bounds.max[i]+radius);
}
