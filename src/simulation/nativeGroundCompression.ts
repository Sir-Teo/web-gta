import {requireAsset} from '../assets/binary';
const f=(n:number)=>{const r=Math.fround(n);requireAsset(Number.isFinite(r),'Nonfinite ground compression.');return r;};
export interface NativeGroundCompressionInput {
  /** Raw collision-line fraction, BEFORE radius-to-spring conversion. */
  compression:number;springLength:number;lineLength:number;wheelRadius:number;
  status:'normal'|'burst'|'missing';sandGroup:boolean;railTrack:boolean;rhino:boolean;
  forwardSpeed:number;wetRoads:number;handlingFlags:number;rotation:number;wheelSpeed:number;timeStep:number;
  /** Explicit result from the native integer RNG call; required only for burst tires. */
  burstSample?:number;
}
export function burstCompressionRandomUpper(forwardSpeed:number){
  const upper=Math.trunc(f(Math.abs(f(forwardSpeed))*40))+98;
  requireAsset(upper<=2147483647,'Burst random range exceeds signed integer bounds.');return upper;
}
/** Source DoBurstAndSoftGroundRatios for one wheel, including rail-joint pulses.
 * Sampling randomness externally preserves replay ordering and atomic failure. */
export function nativeGroundCompression(input:NativeGroundCompressionInput){
  let compression=f(input.compression);
  const spring=f(input.springLength),line=f(input.lineLength),radius=f(input.wheelRadius),speed=Math.abs(f(input.forwardSpeed));
  const wet=f(input.wetRoads),rotation=f(input.rotation),wheelSpeed=f(input.wheelSpeed),time=f(input.timeStep),flags=input.handlingFlags;
  requireAsset(compression>=0&&compression<=1&&spring>0&&line>=spring&&radius>0&&wet>=0&&wet<=1&&time>=0&&time<=3,'Invalid ground compression parameters.');
  requireAsset(Number.isInteger(flags)&&flags>=0&&flags<=0xffffffff,'Invalid handling flags.');
  const remaining=f(f(line-spring)/line);
  if(input.status==='missing')return 1;
  if(input.status==='burst'){
    const sample=input.burstSample,upper=burstCompressionRandomUpper(speed);
    requireAsset(sample!==undefined&&Number.isInteger(sample)&&sample>=0&&sample<upper,'Burst tire requires a sample within its native random range.');
    return sample<100?Math.min(1,f(compression+f(remaining/4))):compression;
  }
  requireAsset(input.status==='normal','Invalid wheel status.');
  if(compression>=1||!input.sandGroup||input.rhino){
    if(compression<1&&input.railTrack){
      let factor=f(f(1.5)/radius);if(speed>f(.3))factor=f(factor*f(speed/f(.3)));
      const inverse=f(1/factor),old=f(inverse*rotation),next=f(f(f(time*wheelSpeed)+rotation)*inverse);
      const oldFraction=f(old-Math.floor(old)),nextFraction=f(next-Math.floor(next));
      if(wheelSpeed>0&&nextFraction<oldFraction||wheelSpeed<0&&nextFraction>oldFraction)compression=Math.max(f(.2),f(compression-f(remaining*f(.3))));
    }
  }else{
    const offroad=flags&0x200000?f(.15):flags&0x100000?f(.2):f(.3);
    const adhesion=Math.max(f(.4),f(f(1-f(f(speed/f(.3))*f(.7)))-f(wet*f(.7))));
    compression=Math.min(1,f(compression+f(f(offroad*remaining)*adhesion)));
  }
  return compression;
}
