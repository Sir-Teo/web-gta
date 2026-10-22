type V3={x:number;y:number;z:number};
export interface AttachedDiveVehicle {position:V3;right:V3;forward:V3;up:V3;moveSpeed:V3;bounds:{min:V3;max:V3}}
const f=Math.fround,add=(a:number,b:number)=>f(a+b),sub=(a:number,b:number)=>f(a-b),mul=(a:number,b:number)=>f(a*b);
const dot=(a:V3,b:V3)=>add(add(mul(a.x,b.x),mul(a.y,b.y)),mul(a.z,b.z));
const neg=(a:V3):V3=>({x:f(-a.x),y:f(-a.y),z:f(-a.z)});
const normal=(x:number,y:number):V3=>{const length=f(Math.sqrt(add(mul(x,x),mul(y,y))));return length>0?{x:f(x/length),y:f(y/length),z:0}:{x:1,y:0,z:0};};

/** CPedGeometryAnalyser::ComputeEntityBoundingBoxCornersUncached, vehicle branch (iOS 0x10034541c).
 * The largest horizontally projected box axis supplies the rectangle's direction; the other axes expand it.
 * This is the native footprint fit, including tilted vehicles, rather than a world-axis box. */
export function attachedDiveFootprint(v:AttachedDiveVehicle,z:number):V3[]{
 const axes=[v.right,v.forward,v.up],lo=v.bounds.min,hi=v.bounds.max,keys=['x','y','z'] as const;
 const low=keys.map(k=>sub(lo[k],.35)),high=keys.map(k=>add(hi[k],.35));
 const half=low.map((n,i)=>mul(sub(high[i],n),.5)),center=low.map((n,i)=>mul(add(high[i],n),.5));
 const c={x:add(add(add(mul(axes[0].x,center[0]),mul(axes[1].x,center[1])),mul(axes[2].x,center[2])),v.position.x),
  y:add(add(add(mul(axes[0].y,center[0]),mul(axes[1].y,center[1])),mul(axes[2].y,center[2])),v.position.y)};
 const size=axes.map((a,i)=>mul(mul(half[i],add(mul(a.x,a.x),mul(a.y,a.y))),2));
 const major=size[0]>size[1]&&size[0]>size[2]?0:size[1]>size[2]?1:2,a=axes[major],dir=normal(a.x,a.y);
 let along=0,across=0;
 for(let i=0;i<3;i++)if(i!==major){along=add(along,Math.abs(mul(dot(dir,axes[i]),half[i])));across=add(across,Math.abs(mul(sub(mul(dir.x,axes[i].y),mul(dir.y,axes[i].x)),half[i])));}
 const px=add(add(c.x,mul(a.x,half[major])),mul(dir.x,along)),py=add(add(c.y,mul(a.y,half[major])),mul(dir.y,along)),
  mx=sub(sub(c.x,mul(a.x,half[major])),mul(dir.x,along)),my=sub(sub(c.y,mul(a.y,half[major])),mul(dir.y,along)),
  lx=f(-mul(dir.y,across)),ly=mul(dir.x,across);
 return [{x:add(px,lx),y:add(py,ly),z:f(z)},{x:add(mx,lx),y:add(my,ly),z:f(z)},
  {x:sub(mx,lx),y:sub(my,ly),z:f(z)},{x:sub(px,lx),y:sub(py,ly),z:f(z)}];
}

/** ComputeEntityHitSide's diagonal sectors (0x1003451dc). Exact diagonal boundaries use the native scan order. */
export function attachedDiveHitSide(p:V3,corners:readonly V3[]){
 const c={x:mul(corners.reduce((sum,v)=>add(sum,v.x),0),.25),y:mul(corners.reduce((sum,v)=>add(sum,v.y),0),.25)};
 const values=corners.map(v=>{const n={x:f(-sub(v.y,c.y)),y:sub(v.x,c.x),z:0},d=f(-dot(n,v));return add(dot(n,p),d);});
 for(let i=0;i<4;i++)if(values[i]<0&&values[(i+3)%4]>=0)return i;
 return 0;
}

/** CTaskComplexDiveFromAttachedEntityAndGetUp::CreateFirstSubTask (iOS 0x1003f05bc).
 * A front/back dive along a moving vehicle's speed instead chooses the nearer side; ties choose side 3. */
export function attachedDiveDirection(p:V3,v:AttachedDiveVehicle):V3{
 const corners=attachedDiveFootprint(v,p.z),side=attachedDiveHitSide(p,corners),dirs=[v.forward,neg(v.right),neg(v.forward),v.right];
 let chosen=side;
 if((side===0||side===2)&&dot(dirs[side],v.moveSpeed)>0){
  const distance=(i:number)=>{const start=corners[(i+3)%4],end=corners[i],edge=normal(sub(end.x,start.x),sub(end.y,start.y)),n={x:edge.y,y:f(-edge.x),z:0};return Math.abs(add(dot(n,p),f(-dot(n,start))));};
  chosen=distance(1)<distance(3)?1:3;
 }
 const dir=dirs[chosen];return {x:f(dir.x),y:f(dir.y),z:f(dir.z)};
}
