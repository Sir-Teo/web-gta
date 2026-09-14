/** GetSoundHeadroom divides the signed descriptor by 100; CalculateVolume
 * subtracts that dB value. Convert only this adjustment to Web Audio amplitude. */
export function nativeHeadroomGain(raw:number):number{
 if(!Number.isInteger(raw)||raw< -32768||raw>32767)throw new Error('Invalid native sound headroom.');
 return 10**(-Math.fround(raw/100)/20);
}
