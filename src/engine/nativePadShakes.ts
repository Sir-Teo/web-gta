/* The original's CPad::StartShake requests (pinned gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166), as numbers:
 * the time in ms and the frequency (strength, 0 to 255) each raises. */
/** CAutomobile::VehicleDamage (0x6A7A6E): the player's car over 50 of collision intensity, held off 2 s. */
export function crashShake(intensity:number,mass:number){
 if(!(intensity>50)||!(mass>0))return undefined;
 const frequency=Math.trunc(Math.min(250,intensity/mass*800+100));
 return {time:Math.trunc(40000/frequency),frequency,delayMs:2000};
}
/** CTaskSimpleKillPedWithCar: the player's vehicle killing a ped, by its speed (units a frame) over its mass. */
export function runOverShake(speed:number,mass:number){
 const frequency=Math.trunc(Math.min(250,speed/mass*200000+80));
 return {time:Math.trunc(40000/(frequency%256)),frequency};
}
/** CWeather::Update's thunder, by the lightning's duration. */
export function thunderShake(duration:number){return {time:Math.trunc(40*duration+100),frequency:Math.trunc((duration+40)*2)&255};}
/** CVehicle::FireFixedMachineGuns's GetModelGunInfo frequency (240 ms a burst): the Hunter and Cargobob 160, the
 * Seasparrow, RC Baron and Mavericks 92, the Rustler 225, the Hydra 123. FireUnguidedMissile's is 160. */
export const PLANE_GUN_SHAKE:Readonly<Record<number,number>>={425:160,548:160,447:92,464:92,487:92,497:92,476:225,520:123};
export const ROCKET_SHAKE=160;
