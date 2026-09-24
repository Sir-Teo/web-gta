import type {LightPool} from '../world/nativeEntityLights';
/* CVehicle::DoHeadLightReflection (gta-reversed ead3051): the additive road pool under a car's lit headlights.
 * DoHeadLightReflectionTwin, when both lamps work, stores one pool textured `headlight`: lightSize = 4 × the
 * headlights dummy's x, centred lightSize × 2 + 1 + dummy.y ahead of the car, 2 units up, front half-vector
 * forward × lightSize × 2 and side half-vector perp-right of forward × lightSize. DoHeadLightReflectionSingle stores
 * `headlight1` per working lamp, offset ± dummy.x along the right (bikes and the Quad use lightSize 1.25). Colour
 * 45, 45, 45 at intensity 128 over 6 units of height. CShadows::StoreCarLightShadow drops pools 27 units from the
 * camera and fades the colour from 18 (27 × 2 / 3) out, and drops a pool more than 7 units behind the camera (the
 * light-to-camera vector along the camera's 2D front, DoHeadLightReflection*'s maxViewAngleCosine of 7). Native
 * coordinates (x, y, z up). */
export const CAR_LIGHT_POOL_MAX_DISTANCE=27,CAR_LIGHT_POOL_COLOUR=45;
export interface CarLightSource {
 id:number;position:{x:number;y:number;z:number};forward:{x:number;y:number};right:{x:number;y:number};
 /** The headlights dummy in native car space. */
 dummy:{x:number;y:number;z:number};
 lamps:readonly [boolean,boolean];bike?:boolean;
}
export function carLightPools(car:CarLightSource,camera:{x:number;y:number;front?:{x:number;y:number}}):{twin:LightPool[];single:LightPool[]}{
 const twin:LightPool[]=[],single:LightPool[]=[];
 const [left,right]=car.lamps;if(!left&&!right)return {twin,single};
 const fl=Math.hypot(car.forward.x,car.forward.y)||1,fwd={x:car.forward.x/fl,y:car.forward.y/fl};
 const rl=Math.hypot(car.right.x,car.right.y)||1,rgt={x:car.right.x/rl,y:car.right.y/rl};
 const fade=(p:{x:number;y:number})=>{const d=Math.hypot(p.x-camera.x,p.y-camera.y);if(d>=CAR_LIGHT_POOL_MAX_DISTANCE)return 0;const start=CAR_LIGHT_POOL_MAX_DISTANCE*2/3;return d>=CAR_LIGHT_POOL_MAX_DISTANCE*.75?1-(d-start)/(CAR_LIGHT_POOL_MAX_DISTANCE-start):1;};
 const store=(list:LightPool[],id:number,centre:{x:number;y:number},lightSize:number)=>{
  const t=fade(centre);if(t<=0)return;
  if(camera.front){const fl=Math.hypot(camera.front.x,camera.front.y)||1;if(((camera.x-centre.x)*camera.front.x+(camera.y-centre.y)*camera.front.y)/fl>7)return;}
  const c=Math.trunc(CAR_LIGHT_POOL_COLOUR*t);
  const front:[number,number]=[fwd.x*lightSize*2,fwd.y*lightSize*2],side:[number,number]=[fwd.y*lightSize,-fwd.x*lightSize];
  list.push({id,position:[centre.x,centre.y,car.position.z+2],size:lightSize*2,color:[c,c,c],intensity:128,maxHeight:6,front,side,maxDistance:CAR_LIGHT_POOL_MAX_DISTANCE});
 };
 if(left&&right){
  const lightSize=Math.abs(car.dummy.x)*4,offset=lightSize*2+1+car.dummy.y;
  store(twin,car.id*4+2,{x:car.position.x+fwd.x*offset,y:car.position.y+fwd.y*offset},lightSize);
 }else{
  const x=right?Math.abs(car.dummy.x):-Math.abs(car.dummy.x),lightSize=car.bike?1.25:Math.abs(car.dummy.x)*4,offset=lightSize*2+1+car.dummy.y;
  store(single,car.id*4+(right?1:0),{x:car.position.x+rgt.x*x+fwd.x*offset,y:car.position.y+rgt.y*x+fwd.y*offset},lightSize);
 }
 return {twin,single};
}
