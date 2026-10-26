const f=Math.fround;
/** CStats modifier 2, selected iOS 0x100266300. PC 0x559AF0 remains a retail delegate.
 * Float stats 21 (fat) and 23 (muscle); native intermediate rounding and lower bound. */
export function nativeLandingStatModifier(fat:number,muscle:number){
 const fatPart=f(Math.max(0,f(f(f(fat)-200)/800))*f(-.2));
 const musclePart=f(f(f(f(muscle)-50)*f(-.1))/950);
 return Math.max(f(.8),f(f(1+fatPart)+musclePart));
}
export const DEFAULT_LANDING_MODIFIER=nativeLandingStatModifier(0,0);
/** CTaskSimpleLand::ProcessPed (PC 0x67D380; selected iOS 0x100416148).
 * Called only on the task's first ped update. The physical sprint button is independent of sprint resource.
 * IDLE_tired skips the stat multiplier; non-player peds keep the association's original speed. */
export function nativeLandingPlayback(input:{initialSpeed:number;modifier:number;sprintState:boolean;sprintHeld:boolean;isPlayer:boolean;tired?:boolean}){
 let speed=f(input.initialSpeed);
 if(!input.isPlayer)return speed;
 if(input.sprintState&&input.sprintHeld)speed=2;
 return input.tired?speed:f(speed*f(input.modifier));
}
