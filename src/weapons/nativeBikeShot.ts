type Vec=readonly number[];
type Point=[number,number,number];
export interface BikeShotInput {
 /** Native right/forward/up/position rows; hand rows keep the bone's local axes. */
 vehicleMatrix:readonly Vec[];handMatrix:readonly Vec[];
 velocity:Vec;fireOffset:Vec;range:number;timeStep:number;
 left:boolean;right:boolean;vehicleType:number;random:readonly number[];
}
/** CWeapon::FireInstantHitFromCar 0x100497a48..0x100498044, before auto-aim.
 * Declared hand lookup, weapon data and three CRT draws; native float32 arithmetic. */
export function nativeBikeShot(input:BikeShotInput){
 const f=Math.fround,offset=input.fireOffset.map(f),m=input.handMatrix,range=f(input.range);
 if(input.vehicleType!==9&&input.right){for(let i=0;i<3;i++)offset[i]=f(offset[i]*f(1.8));offset[2]=f(offset[2]+f(-.1));}
 const start=([0,1,2] as const).map(i=>{
  const transformed=f(f(f(f(offset[0]*f(m[0][i]))+f(offset[1]*f(m[1][i])))+f(offset[2]*f(m[2][i])))+f(m[3][i]));
  return f(f(f(input.timeStep)*f(input.velocity[i]))+transformed);
 }) as Point;
 const axis=input.vehicleMatrix[input.left||input.right?0:1];
 const end=start.map((value,i)=>{
  const step=f(range*f(axis[i])),base=input.left?f(value-step):f(value+step),scatter=f(f((input.random[i]&255)*f(.01))+f(-1.28));
  return f(base+scatter);
 }) as Point;
 return {start,end};
}
