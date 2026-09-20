/* CAutomobile::DoHoverSuspensionRatios (gta-reversed ead3051): the Vortex (539), and every car under the unused
 * CARS_ON_WATER cheat, rides its suspension lines on the water surface. With the car's up axis over 0.3 and the
 * car not drowning, each wheel line whose end has a water level above the wheel's ground contact (or above
 * MAP_Z_LOW_LIMIT without one) and within a unit above the line end takes its collision fraction from the water
 * plane: 1 when the water is at or under the line end, (start.z − water)/(start.z − end.z) when it is between the
 * ends, 0 above the start; the contact point is the line at that fraction lifted to the water level, normal up.
 * Native world space: z up, units. */
export type V3={x:number;y:number;z:number};
export const MAP_Z_LOW_LIMIT=-1000;
export const HOVER_MIN_UP=0.3,HOVER_WATER_REACH=1;
export interface HoverWheelInput {start:V3;end:V3;groundContactZ?:number;waterLevel?:number}
export interface HoverWheelContact {fraction:number;point:V3;normal:V3}
export function hoverWheelContact(input:HoverWheelInput):HoverWheelContact|undefined{
 const water=input.waterLevel;if(water===undefined)return undefined;
 const colPointZ=input.groundContactZ??MAP_Z_LOW_LIMIT;
 if(!(water>colPointZ&&input.end.z-HOVER_WATER_REACH<water))return undefined;
 const {start,end}=input;
 const fraction=water<=end.z?1:water<=start.z?(start.z-water)/(start.z-end.z):0;
 return {fraction,point:{x:start.x+(end.x-start.x)*fraction,y:start.y+(end.y-start.y)*fraction,z:water},normal:{x:0,y:0,z:1}};
}
/** Whether the hover ratios run this step: the up axis over 0.3 and the car not drowning. */
export function hoverActive(upZ:number,drowning:boolean){return upZ>=HOVER_MIN_UP&&!drowning;}
