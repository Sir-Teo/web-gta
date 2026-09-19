/** eBrightLightColor. */
export const BRIGHT_LIGHT={none:0,greenBig:1,yellowBig:2,redBig:3,greenSmall:13,yellowSmall:14,redSmall:15} as const;
/** MAX_NUM_BRIGHTLIGHTS. */
export const MAX_NUM_BRIGHTLIGHTS=32;
type Vec3=readonly [number,number,number];
/** tBrightLight. `right` and `top` keep RegisterOne's swap: `right` holds the pole's up, `top` its right. */
export interface BrightLight {position:Vec3;right:Vec3;top:Vec3;distance:number;color:number}
/** TrafficLightsUp (0x5C0A7C), TrafficLightsSide (0x5C0A94) and the hexagon's indices (0x8D5DBC). */
const UP=[.162,.162,0,-.162,-.162,0],SIDE=[-.09,.09,.162,.09,-.09,-.162],HEXAGON=[0,1,5,1,2,3,1,3,4,1,4,5];
const big=(c:number)=>c>=BRIGHT_LIGHT.greenBig&&c<=BRIGHT_LIGHT.redBig;

/** CBrightLights (BrightLights.cpp, reversed): the lit lenses of traffic lights, registered each frame within 60 units
 * and drawn as flat hexagons (big) or octagons (small) of the lamp's colour with a random flicker. */
export class NativeBrightLights {
 readonly lights:BrightLight[]=[];
 /** CBrightLights::RegisterOne (0x724770). `lodMultiplier` is TheCamera.m_fLODDistMultiplier. */
 registerOne(position:Vec3,up:Vec3,right:Vec3,color:number,camera:Vec3,lodMultiplier=1){
  if(color===BRIGHT_LIGHT.none||this.lights.length>=MAX_NUM_BRIGHTLIGHTS)return;
  const distance=Math.hypot(camera[0]-position[0],camera[1]-position[1],camera[2]-position[2])/lodMultiplier;
  if(distance>60)return;
  this.lights.push({position:[...position],right:[...up],top:[...right],distance,color});
 }
 /** CBrightLights::Render (0x7241C0): each light's triangles as native positions and RGBA colours (tBrightLight::Render
  * and GetColorRGBA), then the list empties. `rand` is CGeneral::GetRandomNumber. */
 render(rand:()=>number){
  const positions:number[]=[],colors:number[]=[];
  for(const l of this.lights){
   const faded=l.distance>=45?Math.trunc((1-(l.distance-45)/15)*255):255;
   const alpha=big(l.color)?faded>>1:faded;
   // R* scaled a random byte by 1/5.
   const rnd=Math.trunc((rand()&255)/5);
   const kind=big(l.color)?l.color-BRIGHT_LIGHT.greenBig:l.color-BRIGHT_LIGHT.greenSmall;
   const rgba=kind===0?[rnd,255,rnd,alpha]:kind===1?[255,128,rnd,alpha]:[255,rnd,rnd,alpha];
   const at=(a:number,b:number):number[]=>[0,1,2].map(k=>l.position[k]+l.right[k]*a+l.top[k]*b);
   let corners:number[][],indices:number[];
   if(big(l.color)){corners=UP.map((u,i)=>at(u,SIDE[i]));indices=HEXAGON;}
   else{
    corners=Array.from({length:8},(_,i)=>{const angle=2*Math.PI/8*i;return at(Math.cos(angle)*.1,Math.sin(angle)*.1);});
    indices=[1,2,3,4,5,6].flatMap(i=>[0,i,i+1]);
   }
   for(const i of indices){positions.push(...corners[i]);colors.push(...rgba);}
  }
  this.lights.length=0;
  return {positions,colors};
 }
}
