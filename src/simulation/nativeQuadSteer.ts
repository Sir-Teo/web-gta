/** CAutomobile::ProcessControlInputs's keyboard steering, which the quad (a CAutomobile) shares with cars: the raw
 * steer angle moves a fifth of the way to the pad's deflection each frame and is clamped to ±1. Right is positive
 * here (the game's -x/128 has left positive); the frame step is native 50 Hz steps. */
export function rawSteerTowards(raw:number,pad:number,dt:number){
 const ts=dt*50;
 return Math.max(-1,Math.min(1,raw+(Math.max(-1,Math.min(1,pad))-raw)*Math.min(1,ts/5)));
}
/** m_fSteerAngle = lock × pow(raw, 2) with the raw angle's sign, as the fraction of the steering lock. */
export function steerFraction(raw:number){return Math.sign(raw)*raw*raw;}
/** The player's automobile with the controls disabled (or bApplyBrakes) is held to 0.28 units a frame, 14 m/s, by
 * CAutomobile::ProcessControl: the factor to scale its move speed by. */
export function controlsOffSpeedScale(speed:number){return speed>14?14/speed:1;}
