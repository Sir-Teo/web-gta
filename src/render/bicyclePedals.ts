import {Vector3,type Object3D} from 'three';
import {requireAsset} from '../assets/binary';
import type {DffModel} from '../assets/dff';
/** CBmx::PreRender (iOS 0x10045aca0–0x10045adc8): replace each present frame's basis with RotateX, preserving
 * its translation. Pedals counter-rotate inside the chainset, keeping their treads level. */
export function bindBicyclePedals(root:Object3D,model:Pick<DffModel,'frames'>){
 const targets=['chainset','pedal_r','pedal_l'].flatMap((name,i)=>{
  const index=model.frames.findIndex(f=>f.name===name);if(index<0)return [];
  const matches:Object3D[]=[];root.traverse(f=>{if(f.userData.nativeFrame===index)matches.push(f);});
  requireAsset(matches.length===1&&!matches[0].matrixAutoUpdate,'Expected one imported bicycle pedal frame.');
  const frame=matches[0];return [{frame,position:new Vector3().setFromMatrixPosition(frame.matrix),sign:i===0?1:-1}];
 });
 return {update(previous:number,current:number,alpha:number){
  requireAsset([previous,current,alpha].every(Number.isFinite)&&alpha>=0&&alpha<=1,'Invalid bicycle pedal interpolation.');
  // Association time wraps once per revolution; interpolate across that boundary without reversing a whole turn.
  const delta=Math.atan2(Math.sin(current-previous),Math.cos(current-previous)),angle=previous+delta*alpha;
  for(const {frame,position,sign} of targets){frame.matrix.makeRotationX(angle*sign).setPosition(position);frame.matrixWorldNeedsUpdate=true;}
 }};
}
