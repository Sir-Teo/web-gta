/** CVehicle::GetVehicleLightsStatus (0x6D55C0, reversed): whether a car wants its lights, decided per car on its
 * m_nRandomSeed. A gang driver with an odd seed in a gang area (the current zone's gangs summing over 20) never
 * lights up. Otherwise they are on from 21:00 to 05:59, over hour 20 from minute seed % 64 and over hour 6 until it,
 * in fog or on wet roads past seed / 50000, and in the dark (contact brightness under 0.05) under a no-rain cull zone. */
export function vehicleLightsStatus(o:{seed:number;gangDriverOddSeed:boolean;gangArea:boolean;hours:number;minutes:number;
 foggyness:number;wetRoads:number;contactBrightness:number;camNoRain:boolean}){
 if(o.gangDriverOddSeed&&o.gangArea)return false;
 if(o.hours>=21||o.hours<6)return true;
 if(o.hours===20&&o.minutes>o.seed%64)return true;
 if(o.hours===6&&o.minutes<o.seed%64)return true;
 const threshold=o.seed/50000;
 if(o.foggyness>threshold||o.wetRoads>threshold)return true;
 return o.contactBrightness<.05&&o.camNoRain;
}
/** CGeneral::GetRandomNumber's range, which CEntity gives m_nRandomSeed. */
export const randomSeed=(random=Math.random)=>Math.floor(random()*32768);
