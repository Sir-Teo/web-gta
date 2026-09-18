import {requireAsset} from '../assets/binary';

/* CGeneral range helpers, pinned gta-reversed
 * 0076f9017b4aeef7433957ac2bd8b6988e9df166. Both take one sample of the
 * shared PC CRT stream (0..32767) and interpolate in single precision.
 * Integer ranges lower the upper endpoint by one before interpolating and
 * truncate the result, so the maximum is exclusive. */

export const RANDOM_SAMPLE_MAX=32767;

function factor(sample:number){
 requireAsset(Number.isInteger(sample)&&sample>=0&&sample<=RANDOM_SAMPLE_MAX,'Invalid native random sample.');
 return Math.fround(sample*Math.fround(1/RANDOM_SAMPLE_MAX));
}
function lerp(low:number,high:number,t:number){return Math.fround(Math.fround(high*t)+Math.fround(low*Math.fround(1-t)));}

/** CGeneral::GetRandomNumberInRange(int, int): maximum is exclusive. */
export function randomIntInRange(sample:number,minimum:number,maximum:number){
 requireAsset(Number.isFinite(minimum)&&Number.isFinite(maximum)&&maximum>minimum,'Invalid native integer range.');
 const value=Math.trunc(lerp(Math.fround(minimum),Math.fround(Math.fround(maximum)-1),factor(sample)));
 requireAsset(value>=-2147483648&&value<=2147483647,'Native random integer out of range.');
 return value;
}
/** CGeneral::GetRandomNumberInRange(float, float): maximum is inclusive. */
export function randomFloatInRange(sample:number,minimum:number,maximum:number){
 requireAsset(Number.isFinite(minimum)&&Number.isFinite(maximum)&&maximum>=minimum,'Invalid native float range.');
 return lerp(Math.fround(minimum),maximum,factor(sample));
}
