import { wrapMinutes } from './timecycle';

/** TimeCycle::Initialise's fixed illumination vector, converted (x,y,z) -> (x,z,-y).
 * The visible sun orbit is independent. Directional intensity remains a separate input. */
export const NATIVE_LIGHT_DIRECTION = Object.freeze({x:-.5,y:Math.SQRT1_2,z:.5});

/** CTimeCycle's visible sun, rotated from native Z-up into the scene's Y-up coordinates.
 * This is separate from directional illumination and shadow orientation. */
export function sampleSun(minutes:number) {
  const angle=wrapMinutes(minutes)*Math.PI/720;
  const x=.7+Math.sin(angle),y=.2-Math.cos(angle),z=.7;
  const length=Math.hypot(x,y,z);
  const direction={x:x/length,y:y/length,z:z/length};
  return {direction,coreVisible:direction.y>-.1,coronaVisible:direction.y>0};
}
