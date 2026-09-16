/** CAEAudioUtility helpers (gta-reversed 0076f901, Audio/AEAudioUtility.cpp). */
export type AudioRandom=()=>number;
/** CAEAudioUtility::AudioLog10 (0x4D9E50). */
export const audioLog10=(p:number)=>p>=0.00001?Math.log10(p):-5;
/** CAEAudioUtility::GetPiecewiseLinear (0x4D9D90): clamps outside the table, linear inside. */
export function piecewiseLinear(points:readonly (readonly [number,number])[],x:number){
 const last=points[points.length-1];if(x>=last[0])return last[1];if(x<=points[0][0])return points[0][1];
 let i=0;while(i<points.length&&points[i][0]<x)i++;
 const a=points[i-1],b=points[i],t=(x-a[0])/(b[0]-a[0]);return t*(b[1]-a[1])+a[1];
}
/** notsa::step_to without its time-step variant: one fixed step per audio frame. */
export function stepTo(x:number,to:number,stepUp:number,stepDown=stepUp){if(x===to)return to;return x<to?Math.min(to,x+stepUp):Math.max(to,x-stepDown);}
export const stepUpTo=(x:number,to:number,step:number)=>Math.min(to,x+step);
export const stepDownTo=(x:number,to:number,step:number)=>Math.max(to,x-step);
/** CAEAudioUtility::GetRandomNumberInRange (0x4D9C10 int, inclusive; 0x4D9C50 float). */
export const randomInt=(random:AudioRandom,min:number,max:number)=>min+Math.floor(random()*(max-min+1));
export const randomFloat=(random:AudioRandom,min:number,max:number)=>min+(max-min)*random();
/** CAEAudioUtility::ResolveProbability (0x4D9C80). */
export const resolveProbability=(random:AudioRandom,p:number)=>p>=1||random()*100<100*p;
export const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
export const invLerp=(a:number,b:number,v:number)=>(v-a)/(b-a);
export const clamp=(v:number,min:number,max:number)=>Math.min(max,Math.max(min,v));
/** CAEAudioUtility::ConvertFromBytesToMS for mono PCM16. */
export const bytesToMs=(bytes:number,sampleRate:number)=>Math.floor(Math.fround(bytes/Math.fround(sampleRate/500)));
