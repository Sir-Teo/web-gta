/* CAutomobile::HydraulicControl (0x6A0510), pinned gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166
 * (Automobile.cpp). A car fitted with hydraulics (handlingFlags.bHydraulicInst, 0x20000) rides on suspension lines the
 * player moves: it squats to its idle stance at a standstill and rises to normal as it drives off, the horn throws it
 * to the extended stance and back, and the car-gun stick lifts each corner. A mission car an AI drives (STATUS_PHYSICS,
 * with its special collision model) takes each corner's change from m_aWheelSuspension, which CONTROL_CAR_HYDRAULICS
 * sets and every step clears. Local native units, Z up. */
import type {CarWheel} from '../simulation/nativeDriveContacts';

export const HANDLING_HYDRAULIC_GEOM=0x10000,HANDLING_HYDRAULIC_INST=0x20000,HANDLING_HYDRAULIC_NONE=0x40000;
const WHEELS:readonly CarWheel[]=['frontLeft','rearLeft','frontRight','rearRight'];

/** CVehicle::m_aSpecialHydraulicData's limits as HydraulicControl first works them out. */
export interface HydraulicLimits {normalUpper:number;normalLower:number;extendedUpper:number;extendedLower:number;idleUpper:number;idleLower:number}
/** The limits from the handling's suspension, the collision's lowest sphere and the front left wheel: normal travel
 * (half again for hydraulic geometry), the extended stance 0.2 (0.4) lower but no lower than the body, and the idle
 * stance the middle 70% of normal, raised so the wheel keeps 0.1 under the body. */
export function hydraulicLimits(upper:number,lower:number,flags:number,lowestSphereZ:number,frontLeftWheelZ:number,wheelRadius:number):HydraulicLimits{
 const limitExtend=lowestSphereZ-frontLeftWheelZ,geom=(flags&HANDLING_HYDRAULIC_GEOM)!==0;
 let spring=upper-lower;if(geom)spring*=1.5;
 const normalLower=lower,normalUpper=spring+normalLower,drop=geom?.4:.2;
 const extendedUpper=Math.max(normalUpper-drop,limitExtend),extendedLower=normalLower-drop;
 const margin=(1-.7)*.5*spring;
 let idleUpper=normalUpper-margin,idleLower=normalLower+margin;
 const wheelHeight=limitExtend+wheelRadius-.1;
 if(wheelHeight<idleLower){const h=idleLower-wheelHeight;idleUpper-=h;idleLower-=h;}
 return {normalUpper,normalLower,extendedUpper,extendedLower,idleUpper,idleLower};
}
/** What a hydraulic car reads each step. `stick` is the car-gun stick, -128 to 128 each way; `prevSpeed` is
 * m_PrevSpeed in units a frame. */
export interface HydraulicInput {player:boolean;hornJustDown:boolean;stick:{leftRight:number;upDown:number};prevSpeed:number;gas:number;
 /** CPad::GetHydraulicJump (ShockButtonR): every corner goes up at once. */
 jump?:boolean;
 /** The frame's CTimer::GetTimeStep, for the line-movement sound thresholds. */
 timeStep?:number;
 /** STATUS_PHYSICS: hydraulicData.m_aWheelSuspension, the script's change for each corner. */
 scripted?:Record<CarWheel,number>}
export type HydraulicSound='suspensionOn'|'suspensionOff'|'suspensionTrigger'|'suspensionHydraulic';
/** Where each suspension line starts (its upper end over the wheel) and how long its spring is. */
export type HydraulicLines=Record<CarWheel,{upper:number;spring:number}>;

export class NativeHydraulics {
 /** m_wMiscComponentAngle: 0 idle, 20-60 driving, 500-504 extended. */
 angle=0;
 /** Each line's lower end (relative to its wheel's rest) as last set, for the movement sounds' maxDelta. */
 private lastEnds?:Record<CarWheel,number>;
 constructor(readonly limits:HydraulicLimits,private wheelRadius=0){}
 /** One HydraulicControl step: the lines to set (relative to each wheel's rest position) and the sounds it raises. */
 step(input:HydraulicInput):{lines?:HydraulicLines;sounds:HydraulicSound[]}{
  const sounds:HydraulicSound[]=[];
  if(!input.player&&!input.scripted)return {sounds};
  const l=this.limits;let normalUpper=l.normalUpper,normalLower=l.normalLower;
  const extendedSpring=l.extendedUpper-l.extendedLower;let normalSpring=normalUpper-normalLower;
  if(this.angle>=20||input.prevSpeed<=.02||input.gas===0){
   if(this.angle&&this.angle<61&&input.prevSpeed<.01){this.angle--;if(this.angle===1)sounds.push('suspensionOff');}
  }else if(this.angle)this.angle++;
  else{this.angle=20;sounds.push('suspensionOn');}
  const lines={} as HydraulicLines;
  if(input.player&&input.hornJustDown){
   this.angle=this.angle<500?500:60;
   if(this.angle>=500){for(const w of WHEELS)lines[w]={upper:l.extendedUpper,spring:extendedSpring};sounds.push('suspensionTrigger');this.remember(lines);return {lines,sounds};}
   for(const w of WHEELS)lines[w]={upper:normalUpper,spring:normalSpring};sounds.push('suspensionHydraulic');
  }
  // Holding the hydraulic jump keeps every corner at 1; otherwise the car-gun stick lifts them.
  const change:Record<CarWheel,number>=input.scripted?{...input.scripted}:{frontLeft:1,rearLeft:1,frontRight:1,rearRight:1};
  if(!input.scripted&&!input.jump){
   const x=input.stick.leftRight,y=input.stick.upDown,jump=Math.hypot(x,y)*1.5/128,a=Math.atan2(x,y)-Math.PI/4;
   const rearRight=Math.cos(a)*jump,frontRight=Math.sin(a)*jump;
   change.frontLeft=Math.max(0,-rearRight);change.rearLeft=Math.max(0,-frontRight);change.frontRight=Math.max(0,frontRight);change.rearRight=Math.max(0,rearRight);
  }
  if(this.angle<500){
   if(WHEELS.every(w=>change[w]===0)){if(this.angle===0){normalUpper=l.idleUpper;normalLower=l.idleLower;normalSpring=normalUpper-normalLower;}}
   else{if(this.angle===0)for(const w of WHEELS)change[w]=0;this.angle=60;}
   for(const w of WHEELS){const c=Math.min(change[w],1);lines[w]={upper:(l.extendedUpper-normalUpper)*c+normalUpper,spring:(extendedSpring-normalSpring)*c+normalSpring};}
  }else{
   if(this.angle<504)this.angle++;
   for(const w of WHEELS){const c=Math.min(change[w],1);lines[w]={upper:(normalUpper-l.extendedUpper)*c+l.extendedUpper,spring:(normalSpring-extendedSpring)*c+extendedSpring};}
  }
  // The lines' movement sounds: the biggest move of a lower end against the extended-to-normal lower limit.
  let maxDelta=0;
  if(this.lastEnds)for(const w of WHEELS){const end=lines[w].upper-(lines[w].spring+this.wheelRadius),d=end-this.lastEnds[w];if(Math.abs(d)>Math.abs(maxDelta))maxDelta=d;}
  this.remember(lines);
  const limitDiff=l.extendedLower-l.normalLower,ts=input.timeStep??50/30;
  if(limitDiff!==0&&Math.abs(maxDelta/limitDiff)>.01){
   const f=Math.min(1,Math.max(0,(limitDiff+Math.abs(maxDelta))*.5/limitDiff));
   if(f<.5-ts*.05)sounds.push('suspensionHydraulic');
   else if(f>ts*.05+.5)sounds.push('suspensionTrigger');
   else if(f>ts*.025+.5)sounds.push('suspensionHydraulic');
  }
  return {lines,sounds};
 }
 private remember(lines:HydraulicLines){const ends={} as Record<CarWheel,number>;for(const w of WHEELS)ends[w]=lines[w].upper-(lines[w].spring+this.wheelRadius);this.lastEnds=ends;}
}
