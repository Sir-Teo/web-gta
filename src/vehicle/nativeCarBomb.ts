/** CVehicle's bomb (m_nBombOnBoard, m_wBombTimer), as gta-reversed has it: eBombState, ActivateBomb (0x6D24F0),
 * ProcessDelayedExplosion (0x6D1340), CAutomobile::ProcessControl's ignition trigger and CWorld::UseDetonator
 * (0x5660B0). The bomb shops (CGarage::Update's types 2 to 4) fit them; no script does. */
export const BOMB={none:0,timed:1,ignition:2,sticky:3,timedActivated:4,ignitionActivated:5} as const;
export interface CarBomb {
 /** m_nBombOnBoard. */
 bombOnBoard:number;
 /** m_wBombTimer, in ms: the car blows up when it runs out. */
 bombTimerMs:number;
}
/** ActivateBomb: a timed bomb starts its 7 s, an ignition bomb waits for a driver; true when either was armed (the
 * caller shows GA_12, "Bomb armed"). Any other state is left alone. */
export function activateBomb(car:CarBomb){
 if(car.bombOnBoard===BOMB.timed){car.bombOnBoard=BOMB.timedActivated;car.bombTimerMs=7000;return true;}
 if(car.bombOnBoard===BOMB.ignition){car.bombOnBoard=BOMB.ignitionActivated;return true;}
 return false;
}
/** CAutomobile::ProcessControl: a driver aboard who was not last frame sets off an armed ignition bomb in 1 s. */
export function bombDriverEntered(car:CarBomb){
 if(car.bombOnBoard!==BOMB.ignitionActivated)return false;
 car.bombTimerMs=1000;return true;
}
/** CWorld::UseDetonator for one car: a sticky (remote) bomb goes off half a second on. */
export function detonateStickyBomb(car:CarBomb){
 if(car.bombOnBoard!==BOMB.sticky)return false;
 car.bombOnBoard=BOMB.none;car.bombTimerMs=500;return true;
}
/** ProcessDelayedExplosion's tick: the timer less (int16)(timeStep × 100/6) ms (CTimer's step, 1 at 50 frames a
 * second, so 16 ms a frame rather than 20, and 7000 ms run out in 438 frames, 8.76 s), held at 0. True when it has
 * just run out: BlowUpCar. */
export function stepBombTimer(car:CarBomb,timeStep:number){
 if(!car.bombTimerMs)return false;
 car.bombTimerMs=Math.max(car.bombTimerMs-Math.trunc(timeStep*100/6),0);
 return car.bombTimerMs===0;
}
/** What arming tells the game: CGarages::TriggerMessage("GA_12", -1, 3000). */
export const carBombEvents:{armed?:()=>void}={};
