/** CBike::ProcessControlInputs (iOS 0x100456178, PC 0x6BE310; unreversed in the reference): how a bike reads its
 * pad. The raw steer follows the stick a fifth of the way a step as a car's does (rawSteerTowards), but the wheel's
 * angle is the steering lock times the raw steer itself, not its square as CAutomobile has it. */
export function bikeSteerFraction(raw:number){return Math.max(-1,Math.min(1,raw));}
/** The bike's pedals, which the stick sets with no smoothing. `accelerate` and `brake` are the pad's 0..255 values and
 * `forwardSpeed` the speed along the bike's forward axis in units a step. Below 0.01 a step the bike reverses straight
 * from a standstill, or burns out with both held past 150 (not a BMX); rolling, the opposite pedal brakes it. With the
 * player's controls off it brakes and holds the handbrake (`speedCap`: its move speed is held to 0.28 a step). */
export function bikePedals(input:{accelerate:number;brake:number;forwardSpeed:number;bmx:boolean;controlsDisabled?:boolean}){
 if(input.controlsDisabled)return {gas:0,brake:1,burnout:false,handbrake:true,speedCap:.28};
 const a=(input.accelerate-input.brake)/255,fwd=input.forwardSpeed;
 if(Math.abs(fwd)<.01){
  if(input.accelerate>=151&&input.brake>=151&&!input.bmx)return {gas:input.accelerate/255,brake:input.brake/255,burnout:true,handbrake:false};
  return {gas:a,brake:0,burnout:false,handbrake:false};
 }
 if(fwd<0)return a<0?{gas:a,brake:0,burnout:false,handbrake:false}:{gas:0,brake:a,burnout:false,handbrake:false};
 return a<0?{gas:0,brake:-a,burnout:false,handbrake:false}:{gas:a,brake:0,burnout:false,handbrake:false};
}
