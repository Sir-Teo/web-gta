import { wrapMinutes } from './timecycle';

/** CTimeCycle's visible sun, rotated from native Z-up into the scene's Y-up coordinates.
 * This is separate from directional illumination and shadow orientation. */
export function sampleSun(minutes:number) {
  const angle=wrapMinutes(minutes)*Math.PI/720;
  const x=.7+Math.sin(angle),y=.2-Math.cos(angle),z=.7;
  const length=Math.hypot(x,y,z);
  const direction={x:x/length,y:y/length,z:z/length};
  return {direction,coreVisible:direction.y>-.1,coronaVisible:direction.y>0};
}
