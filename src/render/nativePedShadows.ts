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
