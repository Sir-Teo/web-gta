const f=Math.fround;
/** One native shadow-manager update, not a seconds-based fade. */
export function stepNativeShadowIntensity(intensity:number,keepAlive:boolean){
 if(!Number.isInteger(intensity)||intensity<0||intensity>100||typeof keepAlive!=='boolean')throw new Error('Invalid native shadow intensity.');
 return keepAlive?Math.min(100,intensity+3):Math.max(intensity,3)-3;
}
/** StoreRealTimeShadow: horizontal camera distance, then intensity percentage.
 * Returned byte precedes per-receiver lighting attenuation and texture modulation. */
export function nativeShadowStrength(strength:number,distance:number,intensity:number){
 if(!Number.isInteger(strength)||strength<0||strength>255||!Number.isFinite(distance)||distance<0||!Number.isInteger(intensity)||intensity<0||intensity>100)throw new Error('Invalid native shadow strength.');
 const d=f(distance);if(d>15)return 0;
 const distanceStrength=d>=7.5?Math.trunc(f(f(1-f(f(d-7.5)/7.5))*strength)):strength;
 return Math.trunc(f(f(intensity/100)*distanceStrength));
}
