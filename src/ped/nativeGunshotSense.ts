/** CEventGunShot::AffectsPed (iOS 0x1002888e0): ambient peds keep 45; mission peds use the positive global override,
 * otherwise GetPedFOVRange (max of hearing/seeing). SET_SENSE_RANGE sets both of those fields together. */
export const GUN_SHOT_SENSE_RANGE=45;
export function gunshotSenseRange(mission:boolean,override:number,fovRange:number){
 const f=Math.fround;return mission?f(f(override)>0?override:fovRange):GUN_SHOT_SENSE_RANGE;
}
/** Native entity-origin distance and inclusive radius, in native x/y/z order. The executable rejects only `>`;
 * unordered float comparisons therefore pass as well. */
export function gunshotWithinRange(from:{x:number;y:number;z:number},to:{x:number;y:number;z:number},range:number){
 const f=Math.fround,dx=f(f(from.x)-f(to.x)),dy=f(f(from.y)-f(to.y)),dz=f(f(from.z)-f(to.z)),sq=f(f(f(dx*dx)+f(dy*dy))+f(dz*dz)),r=f(range);
 return !(sq>f(r*r));
}
