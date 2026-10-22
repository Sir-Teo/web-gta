export type PickupPoint={x:number;y:number;z:number};
export type PickupBounds={min:PickupPoint;max:PickupPoint};
export type PickupFrame={position:PickupPoint;heading:number;matrix?:{right:PickupPoint;forward:PickupPoint;up:PickupPoint}};
const f=Math.fround;
const point=(x:number,y:number,z:number)=>({x:f(x),y:f(y),z:f(z)});
function matrix(heading:number){return {right:point(Math.cos(heading),Math.sin(heading),0),forward:point(-Math.sin(heading),Math.cos(heading),0),up:point(0,0,1)};}
function dot(a:PickupPoint,b:PickupPoint){return f(f(f(a.x*b.x)+f(a.y*b.y))+f(a.z*b.z));}
/** CTaskComplexGoPickUpEntity::CreateFirstSubTask, pinned iOS 100431604. Native axes and unscaled COL bounds. */
export function nativeObjectPickupPlan(ped:PickupPoint,object:PickupFrame,bounds:PickupBounds){
 const delta=point(f(ped.x)-f(object.position.x),f(ped.y)-f(object.position.y),f(ped.z)-f(object.position.z));
 let heading=object.heading,axes=object.matrix??matrix(heading),turn=false;
 if(f(bounds.max.x)>f(2*f(bounds.max.y))){heading=Math.atan2(-delta.x,delta.y);turn=true;}
 else if(f(bounds.max.y)>f(2*f(bounds.max.x))){heading=f(Math.atan2(-delta.x,delta.y)+f(Math.PI/2));turn=true;}
 else if(axes.up.z<f(.9)){heading=Math.atan2(-axes.forward.x,axes.forward.y);turn=true;}
 if(turn)axes=matrix(heading);
 const right=dot(delta,axes.right),forward=dot(delta,axes.forward),across=Math.abs(forward),side=right>across?point(f(bounds.max.x)+f(.4),0,f(bounds.min.z)+1):right<-across?point(f(bounds.min.x)-f(.4),0,f(bounds.min.z)+1):point(0,forward>0?f(bounds.max.y)+f(.4):f(bounds.min.y)-f(.4),f(bounds.min.z)+1);
 const transform=(axis:'x'|'y'|'z')=>f(f(f(f(axes.right[axis]*side.x)+f(axes.forward[axis]*side.y))+f(axes.up[axis]*side.z))+f(object.position[axis]));
 return {heading,axes,approach:point(transform('x'),transform('y'),transform('z')),offset:point(-.2,f(-.2)-f(bounds.min.y),-f(bounds.min.z)),minZ:f(bounds.min.z),bottom:f(f(object.position.z)+f(bounds.min.z)),radius:f(.2)};
}
/** CreateNextSubTask 100431a50: absolute association times, not normalized animation fractions. */
export function nativeObjectPickupLift(originZ:number,bottomZ:number){
 if(f(originZ)<f(bottomZ))return {clip:'liftup105',attachAt:f(.2),group:83};
 if(f(originZ)<f(f(bottomZ)+f(.55)))return {clip:'liftup05',attachAt:f(.26666668),group:82};
 return {clip:'liftup',attachAt:f(.6),group:81};
}
