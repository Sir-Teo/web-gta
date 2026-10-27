const f=Math.fround;
type V3=readonly number[];
export interface VehicleBumperLookInput {
 vehicleType:number;appearance:number;behind:boolean;right:boolean;driver:boolean;
 neck:V3;source:V3;matrix:{right:V3;forward:V3;up:V3};
}
const cross=(a:V3,b:V3)=>[f(f(a[1]*b[2])-f(a[2]*b[1])),f(f(a[2]*b[0])-f(a[0]*b[2])),f(f(a[0]*b[1])-f(a[1]*b[0]))];
function normalize(input:V3){
 const v=input.map(f),length2=f(f(f(v[0]*v[0])+f(v[1]*v[1]))+f(v[2]*v[2]));
 if(!(length2>0))return [1,v[1],v[2]];
 const scale=f(1/f(Math.sqrt(length2)));return v.map(x=>f(x*scale));
}
/** GetVectorsReadyForRW resets world up, normalizes front and keeps a vertical
 * front from producing a zero right. It does not normalize the final up again. */
function ready(input:V3){
 const front=normalize(input);if(front[0]===0&&front[1]===0)front[0]=front[1]=f(.0001);
 const right=normalize(cross(front,[0,0,1]));return {front,up:cross(right,front)};
}
/** MODE_1STPERSON LookRight/LookBehind, selected native 0x10021f500/0x10021ed60.
 * Automobile, boat and bike appearances; bone and prior normal source are caller inputs. */
export function nativeVehicleBumperLook(input:VehicleBumperLookInput){
 let source=input.source.map(f),front:number[],up:number[];const right=input.matrix.right.map(f),bodyUp=input.matrix.up.map(f);
 if(input.behind){
  front=normalize(input.matrix.forward);if(input.vehicleType===5)source[2]=f(source[2]+f(-.5));
  const distance=f(input.appearance===2?2.3:.25);source=source.map((x,i)=>f(x+f(front[i]*distance)));front=front.map(x=>f(-x));
  if(input.appearance===2)front=ready(front).front;
  ({front,up}=ready(front));
 }else{
  if(input.vehicleType===5){
   if(input.driver){const offset=f(input.right ? .7 : .3);source=input.neck.map((x,i)=>f(f(f(x)+f(right[i]*offset))+f(bodyUp[i]*f(.2))));}
   else source[2]=f(source[2]+f(-.5));
  }
  if(input.vehicleType!==9)source=source.map((x,i)=>f(x-f(right[i]*f(.35))));
  const forward=normalize(input.matrix.forward);up=normalize(bodyUp);front=normalize(input.right?cross(forward,up):cross(up,forward));
  if(input.appearance===2)source=source.map((x,i)=>f(x-f(front[i]*f(1.45))));
 }
 return {source,front,up,near:f(.05)};
}
