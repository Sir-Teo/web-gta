import {requireAsset} from '../assets/binary';
type V=[number,number,number];
type Frame={name:string;parent:number;matrix:ArrayLike<number>};
const f=Math.fround;
/** CVehicle::GetPlaneGunsPosition (PC 0x6D4290). Hunter's missing global is captured from its pinned initializer. */
const positions:readonly [number,V][]=[
 [425,[0,4.41,-1.27]],[447,[-.5,2.4,-.785]],[464,[0,.45,0]],[476,[2.19,1.5,-.58]],
 [487,[0,2.85,-.5]],[497,[0,2.85,-.5]],[520,[1.48,.44,-.52]],[548,[0,6.87,-1.65]],[576,[0,0,0]],
];
export const PLANE_GUN_POSITIONS:Readonly<Record<number,Readonly<V>>>=Object.fromEntries(positions.map(([model,point])=>[model,point.map(f) as V]));
export function planeGunPosition(model:number,gunId=0,dummy?:Readonly<V>):V{
 // PC returns the nonzero model dummy before applying the Rustler fallback's hard-point spacing.
 if(dummy?.some(v=>v!==0))return [f(dummy[0]),f(dummy[1]),f(dummy[2])];
 const point=PLANE_GUN_POSITIONS[model]??[0,0,0];
 return [model===476?f(point[0]+f(f(.2)*f(gunId-1))):point[0],point[1],point[2]];
}
/** PreprocessHierarchy's aircraft DUMMY_VEHICLE_GUN (13): miscpos_a, transformed through parents except the clump root. */
export function aircraftGunDummy(frames:readonly Frame[]):V|undefined{
 const index=frames.findIndex(frame=>frame.name.toLowerCase()==='miscpos_a');if(index<0)return undefined;
 const frame=frames[index];let p:V=[frame.matrix[12],frame.matrix[13],frame.matrix[14]],at=frame.parent;
 for(let count=0;at>=0;count++){
  requireAsset(count<frames.length&&at<frames.length,'Invalid aircraft gun dummy hierarchy.');
  const parent=frames[at];if(parent.parent<0)break;const m=parent.matrix;
  p=[0,1,2].map(axis=>f(f(f(f(m[axis]*p[0])+f(m[axis+4]*p[1]))+f(m[axis+8]*p[2]))+m[axis+12])) as V;at=parent.parent;
 }
 return p;
}
