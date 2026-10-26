/** CStats::GetFatAndMuscleModifier(STAT_MOD_AIR_IN_LUNG), PC 0x559AF0 (retail delegate),
 * selected iOS 0x100266300 mode 8. Lung capacity is integer stat 225; stamina is float stat 22.
 * The native mode adds their float values before division/multiplication; it does not clamp them. */
export function nativeLungCapacity(lung:number,stamina:number){
 const f=Math.fround;return f(f(f(f(f(Math.trunc(lung))+f(stamina))/2000)*3000)+1000);
}
/** CStats::Init starts lung capacity at 0 and stamina at 100. */
export const DEFAULT_LUNG_CAPACITY=nativeLungCapacity(0,100);
