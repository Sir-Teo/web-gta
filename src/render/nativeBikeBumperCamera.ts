const f=Math.fround;
type V3=readonly number[];
export interface BikeBumperCameraInput {
 /** Native XYZ, source after the model dummy transform, and vehicle position. */
 source:V3;position:V3;
 /** Current transformed neck (bone 4), native move speed and CTimer timestep. */
 neck:V3;velocity:V3;timeStep:number;
 /** Camera axes on entry to Process_1stPerson, before its final basis update. */
 front:V3;up:V3;
}
/** Process_1stPerson 0x100217968..0x100217a90: neck lead and the two possible
 * sources around its external building-only line-of-sight query. */
export function nativeBikeBumperCamera(input:BikeBumperCameraInput){
 const neck=f(f(input.neck[2])+f(f(input.velocity[2])*f(input.timeStep))),height=f(neck+f(.15));
 const source=[f(input.source[0]),f(input.source[1]),height];
 const a=input.front.map(f),b=input.up.map(f),right=[f(f(a[1]*b[2])-f(a[2]*b[1])),f(f(a[2]*b[0])-f(a[0]*b[2])),f(f(a[0]*b[1])-f(a[1]*b[0]))];
 return {source,blockedSource:[f(input.position[0]),f(input.position[1]),f(f(neck+f(.62))+f(.15))],
  lineFrom:source.map((n,i)=>f(n+right[i])),lineTo:source.map((n,i)=>f(n-right[i]))};
}
