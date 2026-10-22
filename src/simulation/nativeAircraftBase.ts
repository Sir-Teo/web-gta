import {Matrix4} from 'three';
/** CAutomobile::SetupSuspensionLines extends the model's min.z to the front-left line end. CPlane constructs
 * that automobile with suspension enabled; CEntity::GetDistanceFromCentreOfMassToBaseOfModel then reads it.
 * Plane GetWheelPosn accumulates the dummy's parents; other vehicle classes read its local matrix. */
export function aircraftBaseOffset(frames:readonly {name:string;parent:number;matrix:readonly number[]}[],minZ:number,lower:number,wheelSize:number|undefined,plane:boolean){
 const index=frames.findIndex(f=>f.name==='wheel_lf_dummy');
 if(index<0||wheelSize===undefined)return -minZ;
 const matrix=new Matrix4().fromArray(frames[index].matrix);
 if(plane){let parent=frames[index].parent;for(let count=0;parent>=0&&count<frames.length;count++){
  matrix.premultiply(new Matrix4().fromArray(frames[parent].matrix));parent=frames[parent].parent;
 }}
 const f=Math.fround,end=f(f(f(matrix.elements[14])+f(lower))-f(f(wheelSize)/2));
 return -Math.min(minZ,end);
}
