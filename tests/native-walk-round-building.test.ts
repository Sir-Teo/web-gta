import {expect,test} from 'vitest';
import {WALK_ROUND_ATTEMPTS,WalkRoundBuildingRoute,buildingCollisionFacing,type V3} from '../src/ped/nativeWalkRoundBuilding';

/** Walls as segments in the plane: the first hit along a line, or nothing. */
function walls(...segments:[number,number,number,number][]){
 return (a:V3,b:V3):V3|undefined=>{
  let best:number|undefined;
  for(const [x1,y1,x2,y2] of segments){
   const dx=b.x-a.x,dy=b.y-a.y,ex=x2-x1,ey=y2-y1,den=dx*ey-dy*ex;if(Math.abs(den)<1e-9)continue;
   const t=((x1-a.x)*ey-(y1-a.y)*ex)/den,u=((x1-a.x)*dy-(y1-a.y)*dx)/den;
   if(t>=0&&t<=1&&u>=0&&u<=1&&(best===undefined||t<best))best=t;
  }
  return best===undefined?undefined:{x:a.x+(b.x-a.x)*best,y:a.y+(b.y-a.y)*best,z:a.z+(b.z-a.z)*best};
 };
}
const middle=()=>.5;

test('walking into a wall, a ped heads along it toward the side its target is on, 0.35 off it',()=>{
 // A wall along y=0 ending at x=2; the ped north of it, its target south and east of the end.
 const hit=walls([-10,0,2,0]),route=new WalkRoundBuildingRoute({x:0,y:0,z:0},{x:0,y:1,z:0},false);
 route.compute({x:0,y:.5,z:1},{x:3,y:-3,z:.5},hit,middle);
 expect(route.routeHasPoints).toBe(true);
 expect(route.route).toHaveLength(1);
 expect(route.route[0].x).toBeCloseTo(3,5);expect(route.route[0].y).toBeCloseTo(.85,5);expect(route.route[0].z).toBeCloseTo(.5,5);
});

test('head on, the other side is tried when the target\'s is walled off',()=>{
 // The wall runs on past the target's side (to x=6) but ends at x=-2 on the other.
 const hit=walls([-2,0,6,0]),route=new WalkRoundBuildingRoute({x:0,y:0,z:0},{x:0,y:1,z:0},true);
 // Three west is past the end, and two back toward the wall from there is clear and sees the target: two points.
 route.compute({x:0,y:.5,z:1},{x:3,y:-3,z:.5},hit,middle);
 expect(route.routeHasPoints).toBe(true);
 expect(route.route).toHaveLength(2);
 expect(route.route[0].x).toBeCloseTo(-3,5);expect(route.route[0].y).toBeCloseTo(.85,5);
 expect(route.route[1].x).toBeCloseTo(-3,5);expect(route.route[1].y).toBeCloseTo(-1.15,5);
 // Not head on, only the target's side is tried, and a first attempt with nothing jumps to the crap route.
 const side=new WalkRoundBuildingRoute({x:0,y:0,z:0},{x:0,y:1,z:0},false);
 side.compute({x:0,y:.5,z:1},{x:3,y:-3,z:.5},hit,middle);
 expect(side.routeHasPoints).toBe(false);expect(side.attempts).toBe(WALK_ROUND_ATTEMPTS);
 side.compute({x:0,y:.5,z:1},{x:3,y:-3,z:.5},hit,middle);
 expect(side.routeHasPoints).toBe(true);expect(side.route).toEqual(side.crap);
 // The crap route steps back off the wall: 1.5 along the normal at the middle of its ranges.
 expect(side.route[0].x).toBeCloseTo(0,5);expect(side.route[0].y).toBeCloseTo(2,5);
});

test('the crap route stops 0.35 short of a wall behind the ped, and gives nothing closer than that',()=>{
 const behind=walls([-5,1.5,5,1.5]),route=new WalkRoundBuildingRoute({x:0,y:0,z:0},{x:0,y:1,z:0},false);
 route.computeCrapRoute({x:0,y:.5,z:1},behind,middle);
 expect(route.crap[0].y).toBeCloseTo(1.15,5);
 const tight=new WalkRoundBuildingRoute({x:0,y:0,z:0},{x:0,y:1,z:0},false);
 tight.computeCrapRoute({x:0,y:.5,z:1},walls([-5,.7,5,.7]),middle);
 expect(tight.crap).toEqual([]);expect(tight.crapHasPoints).toBe(false);
});

test('CEventBuildingCollision affects a ped walking into the wall, head on beyond cos 30°',()=>{
 expect(buildingCollisionFacing({x:0,y:1},{x:0,y:-1})).toEqual({affects:true,headOn:true});
 expect(buildingCollisionFacing({x:0,y:1},{x:Math.sin(.8),y:-Math.cos(.8)})).toEqual({affects:true,headOn:false});
 expect(buildingCollisionFacing({x:0,y:1},{x:1,y:0}).affects).toBe(false);
});
