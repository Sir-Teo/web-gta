/** CPlayerInfo::EvaluateCarPosition (0x56DAD0), pinned gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166: how
 * strongly a car draws the player's enter button, (1 - |LimitRadianAngle(facing - bearing to the car)| / 2π) ×
 * (10 - distance). Headings and bearings share one convention; only their difference matters. */
export function evaluateCarPosition(facing:number,bearing:number,distance:number){
 let d=facing-bearing;d=Math.atan2(Math.sin(d),Math.cos(d));
 return (1-Math.abs(d)/(2*Math.PI))*(10-distance);
}
