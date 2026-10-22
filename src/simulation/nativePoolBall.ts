/** CPhysical::ApplySpeed's bDisableZ path (PC 547B80; inspected arm64 100248828).
 * Native axes and units per 1/50 second. Contact/turn integration is supplied by the host. */
export interface PoolPoint {x:number;y:number;z:number}
export interface PoolTable {min:PoolPoint;max:PoolPoint}
export interface PoolBallStep {position:PoolPoint;velocity:PoolPoint;applyGravity:boolean;stopped:boolean;
 impact?:{axis:'x'|'y';normal:PoolPoint;position:PoolPoint;center:PoolPoint;friction:number;time:number}}
const f=Math.fround,EPS=f(.00001),GAP=f(.06),POCKET_SPEED=f(.03);
export function nativePoolBallStep(position:PoolPoint,velocity:PoolPoint,applyGravity:boolean,table:PoolTable,timeStep:number,radius=0):PoolBallStep{
 const p={x:f(position.x),y:f(position.y),z:f(position.z)},v={x:f(velocity.x),y:f(velocity.y),z:f(velocity.z)},dt=f(timeStep);
 const min={x:f(table.min.x),y:f(table.min.y),z:f(table.min.z)},max={x:f(table.max.x),y:f(table.max.y),z:f(table.max.z)};
 const result:PoolBallStep={position:p,velocity:v,applyGravity,stopped:false};
 const advance=(time:number)=>{p.x=f(p.x+f(v.x*time));p.y=f(p.y+f(v.y*time));p.z=f(p.z+f(v.z*time));};
 if(applyGravity){
  if(f(p.z+f(dt*v.z))<min.z){p.z=min.z;v.x=v.y=v.z=0;result.stopped=true;}
  advance(dt);return result;
 }
 const crossing=(axis:'x'|'y')=>{const next=f(p[axis]+f(dt*v[axis]));return next>max[axis]&&v[axis]>0?f(f(max[axis]-p[axis])/v[axis]):next<min[axis]&&v[axis]<0?f(f(min[axis]-p[axis])/v[axis]):1000;};
 const tx=crossing('x'),ty=crossing('y');
 const axis=tx<ty&&tx<1000?'x':ty<1000?'y':undefined;
 if(!axis){advance(dt);return result;}
 const time=axis==='x'?tx:ty,normal:PoolPoint={x:0,y:0,z:0},speed=Math.abs(v[axis]);normal[axis]=v[axis]>0?-1:1;
 advance(Math.max(time,EPS));
 const other=axis==='x'?'y':'x',longX=f(max.x-min.x)>=f(max.y-min.y),middle=f(f(min[other]+max[other])*.5);
 const cushion=p[other]>=f(min[other]+GAP)&&p[other]<=f(max[other]-GAP)
  &&((axis==='x'?longX:!longX)||p[other]<=f(middle-GAP)||p[other]>=f(middle+GAP));
 if(cushion)v[axis]=-v[axis];
 else{
  result.applyGravity=true;const travel=f(dt*v[axis]);
  if(travel>POCKET_SPEED)v[axis]=f(POCKET_SPEED/dt);else if(travel< -POCKET_SPEED)v[axis]=f(-POCKET_SPEED/dt);
 }
 if(speed>0)result.impact={axis,normal,center:{...p},position:{x:f(p.x-f(normal.x*f(radius))),y:f(p.y-f(normal.y*f(radius))),z:p.z},friction:f(10*speed),time};
 advance(Math.max(f(dt-time),EPS));return result;
}
