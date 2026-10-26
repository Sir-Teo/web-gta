const f=Math.fround;
/** CTaskSimpleLand::ProcessPed (PC 0x67D380; selected iOS 0x100416148).
 * Called only on the task's first ped update. The physical sprint button is independent of sprint resource.
 * IDLE_tired skips the stat multiplier; non-player peds keep the association's original speed. */
export function nativeLandingPlayback(input:{initialSpeed:number;modifier:number;sprintState:boolean;sprintHeld:boolean;isPlayer:boolean;tired?:boolean}){
 let speed=f(input.initialSpeed);
 if(!input.isPlayer)return speed;
 if(input.sprintState&&input.sprintHeld)speed=2;
 return input.tired?speed:f(speed*f(input.modifier));
}
