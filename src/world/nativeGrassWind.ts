import {requireAsset} from '../assets/binary';
const f=Math.fround;
const offsets=[1,.5,.2,.7,.4,1,.5,.3,.2,.1,.7,.6,.3,1,.5,.2].map(f);

/** PlantMgr::CalculateWindBending equations with caller-owned timer and seed.
 * The reversed seed-refresh counter is uncertain; do not infer its lifecycle
 * here. milliseconds is the wrapped native uint32 timer, seed a uint16. */
export function nativeGrassWind(milliseconds:number,wind:number,seed:number){
 requireAsset(Number.isInteger(milliseconds)&&milliseconds>=0&&milliseconds<=0xffffffff&&Number.isInteger(seed)&&seed>=0&&seed<=0xffff&&Number.isFinite(wind)&&wind>=0&&wind<=1,'Invalid native grass wind state.');
 wind=f(wind);
 if(wind<.5){
  const angle=f(f(f(6.28)/4096)*(milliseconds%4096));
  return f(f(Math.sin(angle))/(wind>=f(.2)?125:200));
 }
 const phase=(seed+Math.imul(milliseconds,8))>>>0;
 const index=(phase>>>12)&15,contribution=f((phase%4096)/4096);
 // Preserve the source's added 1 in the second term; ordinary interpolation
 // between table entries would change the bend magnitude.
 let bend=f(f(f(1-contribution)*offsets[index])+f(1+f(contribution*offsets[(index+1)%16])));
 bend=f(bend*wind);return f(bend*f(.015));
}
