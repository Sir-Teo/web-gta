/* CAutomobile::DoSoftGroundResistance (gta-reversed ead3051): every step a car (not the RC Bandit or the Rhino) with a
 * wheel on a SAND adhesion-group surface loses 0.005 × its planar move speed a time step (the whole of it under 0.3
 * units a step, when it is bogged down; a 0.3-unit push against the direction of travel above that, the rate eased by
 * max(0.2, 1 − 2 × speed)); offroad-ability handling flags cut the loss to 60 % or 30 %, and wet roads over 0.2 scale
 * it by 1.2 − WetRoads. A wheel on SURFACE_RAILTRACK instead applies CVehicle::ms_fRailTrackResistance × the planar
 * speed (iOS 0x100447804; ApplyMoveForce of −resistance × mass × timestep over the planar speed). Native units: units a
 * step. */
/** CVehicle::ms_fRailTrackResistanceDefault, exe data the reference does not carry: 0.003 in the iOS executable
 * (0x100654218). SET_RAILTRACK_RESISTANCE_MULT sets ms_fRailTrackResistance to it times a multiplier above 0, else to
 * it (iOS handler 0x1002081cc). */
export const RAIL_TRACK_RESISTANCE_DEFAULT=Math.fround(.003);
/** The script's multiplier as the host reads it (1 with no script). */
export const railTrackResistance={multiplier:():number=>1,
 get value(){return Math.fround(RAIL_TRACK_RESISTANCE_DEFAULT*this.multiplier());}};
export const SOFT_GROUND_OFFROAD_ABILITY=0.005,SOFT_GROUND_BOGGED_SPEED=0.3,SOFT_GROUND_PUSH=0.3;
export const HANDLING_FLAG_OFFROAD_ABILITY=0x100000,HANDLING_FLAG_OFFROAD_ABILITY2=0x200000;
export const SOFT_GROUND_EXEMPT_MODELS=new Set([441,432]);
export interface SoftGroundInput {
 /** Native move speed (units a step) and the car's up axis. */
 moveSpeed:{x:number;y:number;z:number};up:{x:number;y:number;z:number};
 modelId:number;handlingFlags:number;wetRoads:number;timeStep:number;
 touchingSand:boolean;touchingRailTrack:boolean;railTrackResistance:number;
}
export interface SoftGroundResult {
 /** The change of move speed (native units a step) to apply, if any. */
 delta?:{x:number;y:number;z:number};boggedDown:boolean;touchingSand:boolean;
}
export function softGroundResistance(input:SoftGroundInput):SoftGroundResult{
 const exempt=SOFT_GROUND_EXEMPT_MODELS.has(input.modelId);
 const planar=()=>{const m=input.moveSpeed,u=input.up,d=m.x*u.x+m.y*u.y+m.z*u.z;return {x:m.x-d*u.x,y:m.y-d*u.y,z:m.z-d*u.z};};
 if(input.touchingSand&&!exempt){
  const s=planar();let ability=SOFT_GROUND_OFFROAD_ABILITY,bogged=false;
  const magnitude=Math.hypot(s.x,s.y,s.z);
  if(magnitude*magnitude<=SOFT_GROUND_BOGGED_SPEED*SOFT_GROUND_BOGGED_SPEED)bogged=true;
  else{const k=SOFT_GROUND_PUSH/magnitude;s.x*=k;s.y*=k;s.z*=k;ability*=Math.max(0.2,1-(magnitude+magnitude));}
  if(input.handlingFlags&HANDLING_FLAG_OFFROAD_ABILITY2)ability*=0.3;
  else if(input.handlingFlags&HANDLING_FLAG_OFFROAD_ABILITY)ability*=0.6;
  if(input.wetRoads>0.2)ability*=1.2-input.wetRoads;
  const rate=-ability*input.timeStep;
  return {delta:{x:s.x*rate,y:s.y*rate,z:s.z*rate},boggedDown:bogged,touchingSand:true};
 }
 if(input.touchingRailTrack&&!exempt){
  const s=planar(),rate=-input.timeStep*input.railTrackResistance;
  return {delta:{x:s.x*rate,y:s.y*rate,z:s.z*rate},boggedDown:false,touchingSand:false};
 }
 return {boggedDown:false,touchingSand:false};
}
