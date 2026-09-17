import {swimBreath} from './nativeSwim';

export interface PlayerBreathState {
 breath:number;
 /** CPlayerData::m_bRequireHandleBreath; false after ResetPlayerBreath. */
 requireHandleBreath?:boolean;
}

/** CPlayerPed::ProcessControl (0x60EA90), before CPed::ProcessControl.
 * Recover only if no task handled breath during the previous frame, then arm
 * the flag for this frame's task/vehicle callbacks. Native timestep = dt * 50.
 * Lung capacity remains supplied by the caller until its stat modifier exists. */
export function beginPlayerBreathFrame(player:PlayerBreathState,timeStep:number,lungCapacity=100){
 if(player.requireHandleBreath&&player.breath<lungCapacity)player.breath+=timeStep+timeStep;
 player.requireHandleBreath=true;
}

/** Shared CPlayerPed::HandlePlayerBreath state mutation. Damage is returned
 * for the caller's damage-event adapter, never applied to armour here. */
export function handlePlayerBreath(player:PlayerBreathState,decrease:boolean,multiplier:number,timeStep:number,lungCapacity=100,infiniteOxygen=false,drownsInWater=true){
 const result=swimBreath(player.breath,decrease,multiplier,timeStep,lungCapacity,infiniteOxygen,drownsInWater);
 player.breath=result.breath;player.requireHandleBreath=false;
 return result;
}

/** CVehicle::ProcessBoatControl's occupied-driver breath branch. Input is the
 * pre-response velocity and unscaled native buoyancy force. bIsDrowning is
 * cleared later in that routine, so its final value is not a breath trigger. */
export function boatDriverNeedsBreath(forceZ:number,mass:number,timeStep:number,upZ:number,moveX:number,moveY:number){
 return forceZ>timeStep*mass*.0008&&upZ<-.6&&Math.abs(moveX)<.05&&Math.abs(moveY)<.05;
}
