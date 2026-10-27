import {Matrix4,type Object3D} from 'three';
import {requireAsset} from '../assets/binary';
import type {BikeWheelFrames} from '../assets/bikeWheelFrames';
/** Roll the imported wheel frames about native X, leaving their centers, parents and original scale intact. */
export function bindBikeWheelRoll(root:Object3D,frames:BikeWheelFrames){
 const indices=[...frames.front,...frames.rear];
 requireAsset(new Set(indices).size===indices.length&&frames.front.length>0&&frames.rear.length>0,'Bike wheels require distinct frames on both axles.');
 const targets=indices.map(index=>{
  const matches:Object3D[]=[];root.traverse(object=>{if(object.userData.nativeFrame===index)matches.push(object);});
  requireAsset(matches.length===1&&!matches[0].matrixAutoUpdate,'Expected one imported bike wheel frame.');
  const frame=matches[0],basis=frame.matrix.clone(),position=[basis.elements[12],basis.elements[13],basis.elements[14]] as const;basis.setPosition(0,0,0);
  return {frame,basis,position};
 });
 const rotation=new Matrix4();
 return {update(previous:readonly number[],current:readonly number[],alpha:number){
  requireAsset(previous.length===targets.length&&current.length===targets.length&&[...previous,...current,alpha].every(Number.isFinite)&&alpha>=0&&alpha<=1,'Invalid bike wheel interpolation.');
  targets.forEach(({frame,basis,position},i)=>{
   rotation.makeRotationX(previous[i]+(current[i]-previous[i])*alpha);
   frame.matrix.copy(rotation).multiply(basis).setPosition(...position);frame.matrixWorldNeedsUpdate=true;
  });
 }};
}
