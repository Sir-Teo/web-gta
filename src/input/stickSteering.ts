/* The iOS port's touch steering stick (its VEHICLE_STEER_ANALOG widget) answers on a curve. CPad::GetSteeringLeftRight
 * and GetSteeringUpDown there (read from the executable) take the stick's deflection a (0 to 1, the pad's 128 being
 * one) and multiply it by a gain: up to the settings' Low Range Max % (MOB_TW1, 35) the gain climbs straight to their
 * Low Range Max Value (MOB_TW2, 70), and beyond it runs straight on to one at full deflection. A tenth of the stick
 * steers 2%, a third 24%, half 38%, full lock all of it: the near-centre corrections a thumb makes stay small. Walking,
 * tilt steering and a pad's stick read straight, as the port's do. */
export const STEER_LOW_RANGE=.35,STEER_LOW_VALUE=.7;
export function stickSteering(value:number,lowRange=STEER_LOW_RANGE,lowValue=STEER_LOW_VALUE){
 if(!Number.isFinite(value))return 0;
 const a=Math.min(1,Math.abs(value)),slope=(1-lowValue)/(1-lowRange);
 const gain=a>=lowRange?a*slope-(slope-1):a*(lowValue/lowRange);
 return Math.max(-1,Math.min(1,value*gain));
}
