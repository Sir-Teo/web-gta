/* The blob shadow under peds without a real-time shadow, pinned gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166.
 * CPed::PreRenderAfterTest's DrawDummyShadow calls CShadows::StoreShadowForPedObject (0x707B40) with the timecycle's
 * shadow vectors, which CTimeCycle::CalcColoursForPoint fills from CShadows::CalcPedShadowValues (0x7076C0) and the
 * vector to the sun. Native coordinates (x, y, z up). */
import type {LightPool} from '../world/nativeEntityLights';

/** MAX_DISTANCE_PED_SHADOWS (0x8D5240). */
export const MAX_DISTANCE_PED_SHADOWS=15;
type V3=readonly [number,number,number];
/** CShadows::CalcPedShadowValues: the front and side half-vectors of the blob and its displacement away from the sun. */
export function calcPedShadowValues(sun:V3){
 const sunDist=Math.hypot(sun[0],sun[1]),recip=1/sunDist,mult=(sunDist+1)*recip;
 return {front:[-sun[0]*mult/2,-sun[1]*mult/2] as [number,number],side:[-sun[1]*recip/2,sun[0]*recip/2] as [number,number],displacement:[-sun[0]/2,-sun[1]/2] as [number,number]};
}
/** CalculateShadowStrength: full out to half the distance, then linear to none, truncated. */
export function calculateShadowStrength(dist:number,maxDist:number,maxStrength:number){
 const half=maxDist/2;return Math.trunc(dist>=half?(1-(dist-half)/half)*maxStrength:maxStrength);
}
/** StoreShadowForPedObject: SHADOW_DEFAULT `shad_ped` at BONE_ROOT plus the displacement, grey and alpha both the
 * strength, zDistance 4; nothing 15 units or more (2D) from the camera. TheCamera.IsSphereVisible(position, 2) is
 * left to the renderer's own clipping. */
export function pedShadowPool(id:number,root:V3,camera:V3,sun:V3,shadowStrength:number):LightPool|undefined{
 const dist=Math.hypot(root[0]-camera[0],root[1]-camera[1]);if(dist>=MAX_DISTANCE_PED_SHADOWS)return;
 const strength=calculateShadowStrength(dist,MAX_DISTANCE_PED_SHADOWS,shadowStrength)&255;if(!strength)return;
 const v=calcPedShadowValues(sun);
 return {id,position:[root[0]+v.displacement[0],root[1]+v.displacement[1],root[2]],size:0,color:[strength,strength,strength],intensity:strength,maxHeight:4,front:v.front,side:v.side,maxDistance:MAX_DISTANCE_PED_SHADOWS};
}

/** CShadows::RenderExtraPlayerShadows (0x707FA0): the player's car (not a bike, plane or boat, not bike-like, not the RC
 * Bandit) casts a black SHADOW_DEFAULT `shad_car` away from every shadow-casting point light it is inside, half its
 * bounding box in size, strength CalculateShadowStrength(distance, radius, 5/8 of the timecycle's), zDistance 4.5. */
export function extraPlayerShadows(car:{position:V3;forward:readonly [number,number];right:readonly [number,number];upZ:number;boundsMin:V3;boundsMax:V3},
 player:V3,lights:readonly {position:V3;radius:number;color:V3}[],shadowStrength:number,idBase=0):LightPool[]{
 const out:LightPool[]=[];if(!shadowStrength)return out;
 const half=[(car.boundsMax[0]-car.boundsMin[0])/2,(car.boundsMax[1]-car.boundsMin[1])/2];
 const fl=Math.hypot(...car.forward)||1,rl=Math.hypot(...car.right)||1,fwd=[car.forward[0]/fl,car.forward[1]/fl],right=[car.right[0]/rl,car.right[1]/rl];
 lights.forEach((light,i)=>{
  if(!light.color[0]&&!light.color[1]&&!light.color[2])return;
  const d=[light.position[0]-player[0],light.position[1]-player[1],light.position[2]-player[2]],dist=Math.hypot(...d);
  if(dist>=light.radius||dist===0)return;
  const strength=calculateShadowStrength(dist,light.radius,Math.trunc(5*shadowStrength/8))&0xffff;
  // posn - (dir2D × 1.2 - forward2D × (half length - max y)), as the reversed code writes it.
  const k=half[1]-car.boundsMax[1];
  out.push({id:idBase+i,position:[car.position[0]-(d[0]/dist*1.2-fwd[0]*k),car.position[1]-(d[1]/dist*1.2-fwd[1]*k),car.position[2]],size:0,color:[0,0,0],
   intensity:Math.min(255,strength),maxHeight:4.5,front:[fwd[0]*half[1],fwd[1]*half[1]],side:[right[0]*(car.upZ>=0?half[0]:-half[0]),right[1]*(car.upZ>=0?half[0]:-half[0])],maxDistance:Infinity});
 });
 return out;
}
