/** CPickups::GenerateNewOne (iOS 0x1001c1be4): float32 coordinates become signed shorts at 1/8-unit precision.
 * FCVTZS scales by eight, truncates and saturates to int32; STRH then retains its low sixteen bits. */
export function nativePickupCoordinate(value:number){
 const scaled=Math.trunc(Math.fround(value)*8),integer=Math.max(-2147483648,Math.min(2147483647,scaled));
 return (integer<<16>>16)/8;
}
