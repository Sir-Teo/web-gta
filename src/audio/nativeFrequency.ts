/** CAESound::CalculateFrequency: additive variance, disabled at or above speed.
 * The caller supplies randomness; this does not reproduce the original PRNG. */
export function nativeSoundFrequency(speed:number,variance:number,random:number):number{
 if(!Number.isFinite(speed)||speed<=0||!Number.isFinite(variance)||!Number.isFinite(random)||random<0||random>1)throw new Error('Invalid native sound frequency inputs.');
 const base=Math.fround(speed),spread=Math.fround(variance);
 if(!Number.isFinite(base)||base<=0||!Number.isFinite(spread))throw new Error('Native sound frequency exceeds float32 range.');
 return spread<=0||spread>=base?base:Math.fround(base+Math.fround(-spread+2*spread*random));
}
