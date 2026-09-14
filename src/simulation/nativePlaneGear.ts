import {requireAsset} from '../assets/binary';
import type {FlyingHandling} from '../assets/flyingHandling';
/** CPlane::SetGearUp/SetGearDown. These are immediate endpoint operations,
 * not the unreconstructed animated transition or a general helicopter operation. */
export function nativePlaneGear(retracted:boolean,dragMultiplier:number,flying:FlyingHandling){
 requireAsset((flying.handlingId>=186&&flying.handlingId<=197)||flying.handlingId===207,'Landing gear endpoints require a native plane handling profile.');
 const drag=Math.fround(dragMultiplier),up=Math.fround(flying.values.gearUpResistance);
 requireAsset(Number.isFinite(drag)&&drag>=0&&Number.isFinite(up)&&up>=0,'Invalid native landing gear resistance.');
 const base=Math.fround(Math.fround(drag/Math.fround(1000))/Math.fround(2));
 const airResistance=retracted?Math.fround(base*up):base;
 requireAsset(Number.isFinite(airResistance),'Native landing gear resistance overflow.');
 return {landingGearStatus:retracted?1:0,airResistance,wheelStatus:retracted?'missing' as const:'ok' as const};
}
