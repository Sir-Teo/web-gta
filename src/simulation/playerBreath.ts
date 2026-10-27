import {CHEATS} from './nativeCheats';
import {swimBreath} from './nativeSwim';
import {DEFAULT_LUNG_CAPACITY} from './nativeLungCapacity';

export interface PlayerBreathState {
 breath:number;
 /** CPlayerData::m_bRequireHandleBreath; false after ResetPlayerBreath. */
 requireHandleBreath?:boolean;
 /** The timestep left until drowning's next damage event: HandlePlayerBreath deals (int32)(timeStep x mult x 3)
  * once a game frame, so the port pays it per 30 fps frame (50/30 steps) rather than truncating each 60 Hz step. */
 drownClock?:number;
}

/** CPlayerPed::ProcessControl (0x60EA90), before CPed::ProcessControl.
 * Recover only if no task handled breath during the previous frame, then arm
 * the flag for this frame's task/vehicle callbacks. Native timestep = dt * 50.
 * The caller supplies current stat-derived lung capacity. */
export function beginPlayerBreathFrame(player:PlayerBreathState,timeStep:number,lungCapacity=DEFAULT_LUNG_CAPACITY){
 if(player.requireHandleBreath&&player.breath<lungCapacity)player.breath+=timeStep+timeStep;
 player.requireHandleBreath=true;
}

/** Shared CPlayerPed::HandlePlayerBreath state mutation. Damage is returned
 * for the caller's damage-event adapter, never applied to armour here. */
export function handlePlayerBreath(player:PlayerBreathState,decrease:boolean,multiplier:number,timeStep:number,lungCapacity=DEFAULT_LUNG_CAPACITY,infiniteOxygen=CHEATS.isActive('infiniteOxygen'),drownsInWater=true){
 const result=swimBreath(player.breath,decrease,multiplier,timeStep,lungCapacity,infiniteOxygen,drownsInWater);
 player.breath=result.breath;player.requireHandleBreath=false;
 const drowning=decrease&&!infiniteOxygen&&!(player.breath>0&&drownsInWater);
 if(!drowning){player.drownClock=0;return result;}
 // `drownClock` counts down to the next frame's hit: the first drowning frame hits at once.
 let damage=0;
 for(player.drownClock=(player.drownClock??0)-timeStep;player.drownClock<=0;player.drownClock+=50/30)damage+=Math.trunc(50/30*multiplier*3);
 return {...result,damage};
}

/** CVehicle::ProcessBoatControl's occupied-driver breath branch. Input is the
 * pre-response velocity and unscaled native buoyancy force. bIsDrowning is
 * cleared later in that routine, so its final value is not a breath trigger. */
export function boatDriverNeedsBreath(forceZ:number,mass:number,timeStep:number,upZ:number,moveX:number,moveY:number){
 return forceZ>timeStep*mass*.0008&&upZ<-.6&&Math.abs(moveX)<.05&&Math.abs(moveY)<.05;
}
