const f=Math.fround;
type V3=readonly number[];
export interface VehicleBumperSourceInput {boat:boolean;dummy:V3;position:V3;matrix:{right:V3;forward:V3;up:V3}}
/** Process_1stPerson dummy/source stage. Selected orientation and body origin
 * are separate inputs; TransformVector excludes the selected matrix position. */
export function nativeVehicleBumperSource(input:VehicleBumperSourceInput){
 const y=f(f(input.dummy[1])+f(.08)),z=f(f(input.dummy[2])+f(.62)),m=input.matrix;
 const source=[0,1,2].map(i=>{
  const rotated=f(f(f(f(m.right[i])*0)+f(f(m.forward[i])*y))+f(f(m.up[i])*z));
  return f(rotated+f(input.position[i]));
 });
 if(input.boat)source[2]=f(source[2]+f(.5));
 return source;
}
