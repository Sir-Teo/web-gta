/* CWaterLevel::FindNearestWaterAndItsFlow (0x6E9D70 on PC, unreversed in gta-reversed), from the iOS port's executable
 * (0x10048a59c): TheCamera's m_fDistanceToWater and m_fHeightOfNearestWater, which the sea's ambience
 * (audio/NativeAmbienceTracks.ts) and the birds read. CWaterLevel::PreRenderWater calls it every 32nd frame
 * (frame % 32 == 29) where the area can see water (CGame::CanSeeWaterFromCurrArea: the world and area 5).
 * - Off the map (beyond ±3000) the camera is on the open sea: distance and height 0.
 * - Else the nearest quad with waves at any corner, by the 2D distance to its rectangle, gives the distance and the
 *   height of its first corner; with none it is 1e7 away at height 0. Triangles are not searched.
 * - The quads are CWaterLevel's: AddWaterLevelVertex (0x100489214) moves a corner beyond ±2999 to ±3000 with the open
 *   sea's settings (height 0, big waves 1, no small waves), and a corner at the place and height of an earlier one
 *   (of a quad or a triangle) is that one; a quad's corners are sorted by y and then x.
 * The flow it also picks (m_CurrentDesiredFlow, the nearest quad's nearest corner's) is left out: nothing in the port
 * drifts with it. */
import type {WaterPolygon} from '../assets/water';

/** TheCamera.m_fDistanceToWater and m_fHeightOfNearestWater. */
export interface CameraWater {distance:number;height:number}
interface Corner {x:number;y:number;z:number;waves:boolean}
/** The search's start: no water nearer than this. */
const NONE=1e7;

export class NearestWater {
 private readonly quads:{a:Corner;b:Corner;c:Corner;waves:boolean}[]=[];
 constructor(polygons:readonly WaterPolygon[]){
  const corners:Corner[]=[];
  const add=(v:WaterPolygon['vertices'][number]):Corner=>{
   let x=Math.trunc(v.position[0]),y=Math.trunc(v.position[1]),z=Math.fround(v.position[2]),big=v.bigWaves,small=v.smallWaves;
   if(x<-2999||x>2999||y<-2999||y>2999){x=Math.max(-3000,Math.min(3000,x));y=Math.max(-3000,Math.min(3000,y));z=0;big=1;small=0;}
   const found=corners.find(c=>c.x===x&&c.y===y&&c.z===z);if(found)return found;
   const corner={x,y,z,waves:Math.fround(big)!==0||Math.fround(small)!==0};corners.push(corner);return corner;
  };
  for(const polygon of polygons){
   const xs=polygon.vertices.map(v=>Math.trunc(v.position[0])),ys=polygon.vertices.map(v=>Math.trunc(v.position[1]));
   // AddWaterLevelQuad and AddWaterLevelTriangle drop a polygon with every x or every y the same.
   if(xs.every(x=>x===xs[0])||ys.every(y=>y===ys[0]))continue;
   const added=polygon.vertices.map(add);
   if(added.length!==4)continue;
   const [a,b,c,d]=[...added].sort((p,q)=>p.y-q.y||p.x-q.x);
   this.quads.push({a,b,c,waves:a.waves||b.waves||c.waves||d.waves});
  }
 }
 /** The camera's distance to water and that water's height, for the native point (x, y). */
 find(x:number,y:number):CameraWater{
  if(!(y<3000&&x>-3000&&x<3000&&y>-3000))return {distance:0,height:0};
  let distance=NONE,height=0;
  for(const {a,b,c,waves} of this.quads){
   const dx=x<a.x?a.x-x:x<=b.x?0:x-b.x,dy=y<a.y?a.y-y:y<=c.y?0:y-c.y,d=Math.fround(Math.sqrt(dx*dx+dy*dy));
   if(d<distance&&waves){distance=d;height=a.z;}
  }
  return {distance,height};
 }
}
