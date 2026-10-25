import {requireAsset} from '../assets/binary';
const NEGATIVE_TAU=Math.fround(-2*Math.PI),REST_KEEP=Math.fround(.97);
/** CBmx::ProcessDrivingAnims (iOS 0x10045a0a8–0x10045a0f0): the active pedal/sprint association owns the crank phase;
 * without one it eases towards zero. The caller supplies the association selected by the port's rider controller. */
export function stepBicycleCrank(previous:number,timeStep:number,animation?:{seconds:number;duration:number}){
 requireAsset(Number.isFinite(previous)&&Number.isFinite(timeStep)&&timeStep>=0,'Invalid bicycle crank step.');
 if(!animation)return Math.fround(previous*Math.fround(Math.pow(REST_KEEP,timeStep)));
 const {seconds,duration}=animation;
 requireAsset(Number.isFinite(seconds)&&seconds>=0&&Number.isFinite(duration)&&duration>0,'Invalid bicycle pedal animation.');
 return Math.fround(Math.fround(Math.fround(seconds%duration)*NEGATIVE_TAU)/Math.fround(duration));
}
