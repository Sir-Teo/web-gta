/** The CAutomobile fields PlayCarHorn reads and writes. */
export interface NativeCarHornState {
 /** CAutoPilot bHonkAtCar/bHonkAtPed, raised while the AI slows for a car or pedestrian ahead. */
 honkAtCar:boolean;honkAtPed:boolean;
 /** CVehicle::HasCarStoppedBecauseOfLight. */
 stoppedForLight:boolean;
 /** m_nCarHornTimer (signed char). */
 hornTimer:number;
 /** m_HornCounter. */
 horn:{counter:number};
}
/** CAutomobile::PlayHornIfNecessary (0x6A3820) and PlayCarHorn (0x6A3770), called once per frame. While the horn is silent a
 * random signed-char timer (rand % 128 − 106) counts down one call at a time, wrapping below −128, so blocked cars honk
 * 45-frame patterns up to 255 frames apart. Timer remainders 4–7 only make the driver say CTX_GLOBAL_BLOCKED, which is not ported. */
export function playHornIfNecessary(car:NativeCarHornState,random:()=>number=Math.random){
 if(!(car.honkAtPed||car.honkAtCar)||car.stoppedForLight||car.horn.counter)return;
 if(car.hornTimer){car.hornTimer=((car.hornTimer-1)<<24)>>24;return;}
 // CGeneral::GetRandomNumber is rand() (0..32767); C++ remainders keep the dividend's sign.
 car.hornTimer=((Math.floor(random()*32768)%128-106)<<24)>>24;
 if(car.hornTimer%8<4)car.horn.counter=45;
}
