type Point={x:number;y:number;z:number};
export interface StealableCandidate {handle:number;position:Point;stealable?:boolean}
/** iOS GET_CLOSEST_STEALABLE_OBJECT (0x1001fd6dc): FindObjectsInRange's first sixteen objects inside the
 * strict 2D radius, then the nearest liftable origin in 3D, starting at twice the radius. Candidate ordering
 * is supplied by the caller; non-liftable objects consume buffer entries too. No held/visible/collision gate. */
export function closestStealableObject(objects:Iterable<StealableCandidate>,point:Point,radius:number):number{
 const f=Math.fround,r=f(radius),radiusSq=f(r*r),x=f(point.x),y=f(point.y),z=f(point.z);let count=0,best=-1,bestDistance=f(r+r);
 for(const object of objects){
  const dx=f(f(object.position.x)-x),dy=f(f(object.position.y)-y),sq2=f(f(dx*dx)+f(dy*dy));
  if(!(sq2<radiusSq))continue;
  if(count++>=16)break;
  if(!object.stealable)continue;
  const dz=f(f(object.position.z)-z),distance=f(Math.sqrt(f(sq2+f(dz*dz))));
  if(distance<bestDistance){best=object.handle;bestDistance=distance;}
 }
 return best;
}
