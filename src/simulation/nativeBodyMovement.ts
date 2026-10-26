const f=Math.fround;
/** CStats modifier 2, selected iOS 0x100266300. PC 0x559AF0 remains a retail delegate.
 * Float stats 21 (fat) and 23 (muscle); native intermediate rounding and lower bound. */
export function nativeBodyMovementModifier(fat:number,muscle:number){
 const fatPart=f(Math.max(0,f(f(f(fat)-200)/800))*f(-.2));
 const musclePart=f(f(f(f(muscle)-50)*f(-.1))/950);
 return Math.max(f(.8),f(f(1+fatPart)+musclePart));
}
export const DEFAULT_BODY_MOVEMENT_MODIFIER=nativeBodyMovementModifier(0,0);
